import { getDb } from "@/lib/db"
import { scanDirectory } from "./scanner"
import { emitEvent } from "@/lib/events/emitter"
import { resolveOutputPath } from "@/lib/utils"
import { probeMediaFile, normalizeCodec } from "@/lib/media-probe"
import type { EncodingOptions } from "@/types/handbrake"
import { DEFAULT_ENCODING_OPTIONS } from "@/types/handbrake"
import path from "path"

const globalForWatcher = globalThis as unknown as {
  __watcherManager: WatcherManager | undefined
}

class WatcherManager {
  private intervals: Map<number, ReturnType<typeof setInterval>> = new Map()
  private startTimeouts: Map<number, ReturnType<typeof setTimeout>> = new Map()

  constructor() {
    this.initializeWatchers()
  }

  private initializeWatchers() {
    const db = getDb()
    const watchers = db.prepare("SELECT * FROM watched_folders WHERE enabled = 1").all() as any[]
    for (const w of watchers) {
      this.scheduleWatcher(w)
    }
  }

  /** Schedule a watcher: if it has a start_time, wait until that time; otherwise start immediately */
  private scheduleWatcher(watcher: any) {
    this.stopWatcher(watcher.id)

    const startTime = watcher.start_time // HH:MM format or null
    if (startTime) {
      const delayMs = this.msUntilTime(startTime)
      console.log(`[watcher] ${watcher.id}: scheduled first scan at ${startTime} (in ${Math.round(delayMs / 60000)} min)`)

      const timeout = setTimeout(() => {
        this.startTimeouts.delete(watcher.id)
        this.startRepeatingScans(watcher.id, watcher.scan_interval)
      }, delayMs)

      this.startTimeouts.set(watcher.id, timeout)
    } else {
      this.startRepeatingScans(watcher.id, watcher.scan_interval)
    }
  }

  /** Start the repeating scan interval + run first scan immediately */
  private startRepeatingScans(watcherId: number, intervalMinutes: number) {
    // Clear any existing interval
    const existing = this.intervals.get(watcherId)
    if (existing) clearInterval(existing)

    const interval = setInterval(() => {
      this.runScan(watcherId)
    }, intervalMinutes * 60 * 1000)

    this.intervals.set(watcherId, interval)

    // Run first scan after short delay
    setTimeout(() => this.runScan(watcherId), 3000)
  }

  /** Calculate milliseconds until next occurrence of HH:MM */
  private msUntilTime(timeStr: string): number {
    const [h, m] = timeStr.split(":").map(Number)
    const now = new Date()
    const target = new Date(now)
    target.setHours(h, m, 0, 0)

    // If the time already passed today, schedule for tomorrow
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1)
    }

    return target.getTime() - now.getTime()
  }

  startWatcher(watcherId: number, intervalMinutes: number) {
    const db = getDb()
    const watcher = db.prepare("SELECT * FROM watched_folders WHERE id = ?").get(watcherId) as any
    if (watcher) {
      this.scheduleWatcher(watcher)
    } else {
      // Fallback: start without schedule
      this.stopWatcher(watcherId)
      this.startRepeatingScans(watcherId, intervalMinutes)
    }
  }

  stopWatcher(watcherId: number) {
    const existingTimeout = this.startTimeouts.get(watcherId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      this.startTimeouts.delete(watcherId)
    }
    const existingInterval = this.intervals.get(watcherId)
    if (existingInterval) {
      clearInterval(existingInterval)
      this.intervals.delete(watcherId)
    }
  }

  runScan(watcherId: number) {
    const db = getDb()
    const watcher = db.prepare("SELECT * FROM watched_folders WHERE id = ?").get(watcherId) as any
    if (!watcher || !watcher.enabled) return

    const extensions = watcher.file_extensions
      .split(",")
      .map((e: string) => e.trim().toLowerCase())
      .map((e: string) => e.startsWith(".") ? e : `.${e}`)

    // Normalize codec filter values so "h264", "H.264", "x264", "avc" all match
    const codecFilterList = watcher.codec_filter
      ? watcher.codec_filter.split(",").map((c: string) => normalizeCodec(c.trim())).filter(Boolean)
      : []

    const files = scanDirectory(
      watcher.path,
      extensions,
      !!watcher.recursive,
      watcher.min_file_size || 0
    )

    let newFiles = 0

    for (const file of files) {
      // Check if already tracked
      const existing = db.prepare(
        "SELECT id, file_size, file_mtime, status FROM scanned_files WHERE watcher_id = ? AND file_path = ?"
      ).get(watcherId, file.filePath) as any

      if (existing) {
        const fileChanged = existing.file_size !== file.fileSize || existing.file_mtime !== file.fileMtime

        if (!fileChanged) continue // Nothing changed, skip

        // File changed — update metadata
        db.prepare(
          "UPDATE scanned_files SET file_size = ?, file_mtime = ?, status = 'detected' WHERE id = ?"
        ).run(file.fileSize, file.fileMtime, existing.id)

        // Skip if there's already an active task for this file
        const activeTask = db.prepare(
          "SELECT id FROM tasks WHERE source_path = ? AND status IN ('queued', 'encoding', 'paused')"
        ).get(file.filePath) as any
        if (activeTask) continue

        // Re-probe codec for changed files
        if (codecFilterList.length > 0) {
          try {
            const mediaInfo = probeMediaFile(file.filePath)
            if (!mediaInfo.videoCodec || !codecFilterList.includes(mediaInfo.videoCodec)) {
              console.log(`[watcher] Changed file ${path.basename(file.filePath)}: codec ${mediaInfo.videoCodec || "unknown"} not in filter — skipping`)
              db.prepare("UPDATE scanned_files SET status = 'skipped' WHERE id = ?").run(existing.id)
              continue
            }
          } catch {
            console.log(`[watcher] Changed file ${path.basename(file.filePath)}: failed to probe codec — skipping`)
            db.prepare("UPDATE scanned_files SET status = 'skipped' WHERE id = ?").run(existing.id)
            continue
          }
        }

        // File changed and passes codec filter — create new task
        console.log(`[watcher] File changed: ${path.basename(file.filePath)} — re-queuing`)
        this.createTaskForFile(db, watcher, watcherId, file, existing.id)
        newFiles++
        continue
      }

      // NEW file — apply codec filter
      if (codecFilterList.length > 0) {
        try {
          const mediaInfo = probeMediaFile(file.filePath)
          if (!mediaInfo.videoCodec || !codecFilterList.includes(mediaInfo.videoCodec)) {
            console.log(`[watcher] Skipped ${path.basename(file.filePath)}: codec ${mediaInfo.videoCodec || "unknown"} not in filter [${codecFilterList.join(", ")}]`)
            db.prepare(
              "INSERT INTO scanned_files (watcher_id, file_path, file_size, file_mtime, status) VALUES (?, ?, ?, ?, 'skipped')"
            ).run(watcherId, file.filePath, file.fileSize, file.fileMtime)
            continue
          }
        } catch {
          console.log(`[watcher] Skipped ${path.basename(file.filePath)}: failed to probe codec`)
          db.prepare(
            "INSERT INTO scanned_files (watcher_id, file_path, file_size, file_mtime, status) VALUES (?, ?, ?, ?, 'skipped')"
          ).run(watcherId, file.filePath, file.fileSize, file.fileMtime)
          continue
        }
      }

      // New file detected — insert scanned record
      db.prepare(
        "INSERT INTO scanned_files (watcher_id, file_path, file_size, file_mtime) VALUES (?, ?, ?, ?)"
      ).run(watcherId, file.filePath, file.fileSize, file.fileMtime)

      this.createTaskForFile(db, watcher, watcherId, file, null)
      newFiles++
    }

    // Update last scan time
    db.prepare("UPDATE watched_folders SET last_scan_at = datetime('now') WHERE id = ?").run(watcherId)

    if (newFiles > 0) {
      emitEvent({ type: "watcher:scan", watcherId, data: { newFiles } })
      emitEvent({ type: "queue:changed" })
    }
  }

  private createTaskForFile(db: any, watcher: any, watcherId: number, file: { filePath: string; fileSize: number; fileMtime: string }, scannedFileId: number | null) {
    // Get preset options
    let options: EncodingOptions = DEFAULT_ENCODING_OPTIONS
    if (watcher.preset_id) {
      const preset = db.prepare("SELECT options_json FROM presets WHERE id = ?").get(watcher.preset_id) as any
      if (preset) {
        try { options = JSON.parse(preset.options_json) } catch {}
      }
    }

    // Resolve output path
    const outputPath = resolveOutputPath(
      file.filePath,
      watcher.output_mode,
      watcher.output_dir,
      watcher.output_pattern || "{name}_encoded.{ext}",
      options.container.format,
      options.video.encoder,
      options.video.quality
    )

    const title = path.basename(file.filePath, path.extname(file.filePath))

    // Create task (inherit settings from watcher config)
    const result = db.prepare(`
      INSERT INTO tasks (title, source_path, output_path, status, options_json, preset_id, watcher_id, delete_source, replace_source, skip_if_larger, fallback_preset_id)
      VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?)
    `).run(title, file.filePath, outputPath, JSON.stringify(options), watcher.preset_id, watcherId, watcher.delete_source || 0, watcher.replace_source || 0, watcher.skip_if_larger || 0, watcher.fallback_preset_id || null)

    // Update scanned file status
    if (scannedFileId) {
      db.prepare("UPDATE scanned_files SET status = 'queued', task_id = ? WHERE id = ?").run(result.lastInsertRowid, scannedFileId)
    } else {
      db.prepare(
        "UPDATE scanned_files SET status = 'queued', task_id = ? WHERE watcher_id = ? AND file_path = ?"
      ).run(result.lastInsertRowid, watcherId, file.filePath)
    }
  }

  restartWatcher(watcherId: number) {
    const db = getDb()
    const watcher = db.prepare("SELECT * FROM watched_folders WHERE id = ?").get(watcherId) as any
    if (!watcher) return

    if (watcher.enabled) {
      this.scheduleWatcher(watcher)
    } else {
      this.stopWatcher(watcherId)
    }
  }

  destroy() {
    for (const timeout of this.startTimeouts.values()) {
      clearTimeout(timeout)
    }
    this.startTimeouts.clear()
    for (const interval of this.intervals.values()) {
      clearInterval(interval)
    }
    this.intervals.clear()
  }
}

export function getWatcherManager(): WatcherManager {
  if (!globalForWatcher.__watcherManager) {
    globalForWatcher.__watcherManager = new WatcherManager()
  }
  return globalForWatcher.__watcherManager
}
