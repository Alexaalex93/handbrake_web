import { getDb } from "@/lib/db"
import { scanDirectory } from "./scanner"
import { emitEvent } from "@/lib/events/emitter"
import { resolveOutputPath } from "@/lib/utils"
import type { EncodingOptions } from "@/types/handbrake"
import { DEFAULT_ENCODING_OPTIONS } from "@/types/handbrake"
import path from "path"

const globalForWatcher = globalThis as unknown as {
  __watcherManager: WatcherManager | undefined
}

class WatcherManager {
  private intervals: Map<number, ReturnType<typeof setInterval>> = new Map()

  constructor() {
    this.initializeWatchers()
  }

  private initializeWatchers() {
    const db = getDb()
    const watchers = db.prepare("SELECT * FROM watched_folders WHERE enabled = 1").all() as any[]
    for (const w of watchers) {
      this.startWatcher(w.id, w.scan_interval)
    }
  }

  startWatcher(watcherId: number, intervalMinutes: number) {
    this.stopWatcher(watcherId)

    const interval = setInterval(() => {
      this.runScan(watcherId)
    }, intervalMinutes * 60 * 1000)

    this.intervals.set(watcherId, interval)

    // Run initial scan after short delay
    setTimeout(() => this.runScan(watcherId), 5000)
  }

  stopWatcher(watcherId: number) {
    const existing = this.intervals.get(watcherId)
    if (existing) {
      clearInterval(existing)
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
      .filter((e: string) => e.startsWith(".") ? e : `.${e}`)

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
        "SELECT id, file_size, file_mtime FROM scanned_files WHERE watcher_id = ? AND file_path = ?"
      ).get(watcherId, file.filePath) as any

      if (existing) {
        // Update if file changed
        if (existing.file_size !== file.fileSize || existing.file_mtime !== file.fileMtime) {
          db.prepare(
            "UPDATE scanned_files SET file_size = ?, file_mtime = ?, status = 'detected' WHERE id = ?"
          ).run(file.fileSize, file.fileMtime, existing.id)
        }
        continue
      }

      // New file detected
      db.prepare(
        "INSERT INTO scanned_files (watcher_id, file_path, file_size, file_mtime) VALUES (?, ?, ?, ?)"
      ).run(watcherId, file.filePath, file.fileSize, file.fileMtime)

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

      // Create task
      const result = db.prepare(`
        INSERT INTO tasks (title, source_path, output_path, status, options_json, preset_id, watcher_id)
        VALUES (?, ?, ?, 'queued', ?, ?, ?)
      `).run(title, file.filePath, outputPath, JSON.stringify(options), watcher.preset_id, watcherId)

      // Update scanned file status
      db.prepare(
        "UPDATE scanned_files SET status = 'queued', task_id = ? WHERE watcher_id = ? AND file_path = ?"
      ).run(result.lastInsertRowid, watcherId, file.filePath)

      newFiles++
    }

    // Update last scan time
    db.prepare("UPDATE watched_folders SET last_scan_at = datetime('now') WHERE id = ?").run(watcherId)

    if (newFiles > 0) {
      emitEvent({ type: "watcher:scan", watcherId, data: { newFiles } })
      emitEvent({ type: "queue:changed" })
    }
  }

  restartWatcher(watcherId: number) {
    const db = getDb()
    const watcher = db.prepare("SELECT * FROM watched_folders WHERE id = ?").get(watcherId) as any
    if (!watcher) return

    if (watcher.enabled) {
      this.startWatcher(watcherId, watcher.scan_interval)
    } else {
      this.stopWatcher(watcherId)
    }
  }

  destroy() {
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
