import { type ChildProcess } from "child_process"
import { getDb } from "@/lib/db"
import { buildArgs, spawnHandBrake } from "@/lib/handbrake/cli"
import { parseProgressLine } from "@/lib/handbrake/parser"
import { emitEvent } from "@/lib/events/emitter"
import { isEncodingAllowed } from "./scheduler"
import { notifyEncodingStart, notifyEncodingComplete, notifyEncodingError } from "@/lib/notifications"
import { updateLibraryAfterEncoding } from "@/lib/library-updater"
import type { EncodingOptions } from "@/types/handbrake"
import fs from "fs"
import path from "path"

interface ActiveJob {
  taskId: number
  process: ChildProcess
  startedAt: number
}

const globalForQueue = globalThis as unknown as {
  __queueManager: QueueManager | undefined
}

class QueueManager {
  private activeJobs: Map<number, ActiveJob> = new Map()
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private progressThrottle: Map<number, number> = new Map()
  private processingQueue = false  // mutex to prevent concurrent processQueue calls

  constructor() {
    // Recovery: reset any tasks stuck in "encoding" state (no active process)
    // This happens when the server restarts or HMR reloads modules in dev mode
    try {
      const db = getDb()
      const stuck = db.prepare(
        "SELECT id, title FROM tasks WHERE status = 'encoding'"
      ).all() as any[]
      if (stuck.length > 0) {
        db.prepare(
          "UPDATE tasks SET status = 'queued', progress = 0, eta_seconds = 0, fps = 0, avg_fps = 0 WHERE status = 'encoding'"
        ).run()
        console.log(`[handbrake] Recovery: reset ${stuck.length} stuck task(s) to queued: ${stuck.map(t => t.title).join(", ")}`)
      }
    } catch (err) {
      console.error("[handbrake] Recovery check failed:", err)
    }
    this.startPolling()
  }

  private startPolling() {
    // Poll every 3 seconds for new work
    this.pollInterval = setInterval(() => {
      this.processQueue()
    }, 3000)
  }

  private getConcurrentLimit(): number {
    const db = getDb()
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("concurrent_limit") as { value: string } | undefined
    return parseInt(row?.value || "1", 10)
  }

  private isAutoStartEnabled(): boolean {
    const db = getDb()
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("auto_start_queue") as { value: string } | undefined
    return row?.value !== "false"
  }

  processQueue() {
    // Mutex: prevent concurrent calls from poll + API triggers racing
    if (this.processingQueue) return
    this.processingQueue = true
    try {
      if (!this.isAutoStartEnabled()) return
      if (!isEncodingAllowed()) return

      const limit = this.getConcurrentLimit()
      const available = limit - this.activeJobs.size
      if (available <= 0) return

      const db = getDb()
      const nextTasks = db.prepare(`
        SELECT id, source_path, output_path, options_json, preset_id
        FROM tasks
        WHERE status = 'queued'
        ORDER BY priority DESC, sort_order ASC, id ASC
        LIMIT ?
      `).all(available) as any[]

      for (const task of nextTasks) {
        this.startEncoding(task.id, task.source_path, task.output_path, JSON.parse(task.options_json))
      }
    } finally {
      this.processingQueue = false
    }
  }

  startEncoding(taskId: number, sourcePath: string, outputPath: string, options: EncodingOptions) {
    if (this.activeJobs.has(taskId)) return

    const db = getDb()

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const args = buildArgs(sourcePath, outputPath, options)
    const proc = spawnHandBrake(args)

    db.prepare("UPDATE tasks SET status = 'encoding', started_at = datetime('now') WHERE id = ?").run(taskId)
    emitEvent({ type: "task:status", taskId, data: { status: "encoding" } })

    // Send encoding start notification
    let sourceSize = 0
    try { sourceSize = fs.statSync(sourcePath).size } catch {}
    notifyEncodingStart({ title: path.basename(sourcePath), sourcePath, fileSize: sourceSize }).catch(() => {})

    const job: ActiveJob = { taskId, process: proc, startedAt: Date.now() }
    this.activeJobs.set(taskId, job)

    let stderrLastChunks = ""  // Keep last 2KB for error messages
    let loggedFirstProgress = false

    const limit = this.getConcurrentLimit()
    console.log(`[handbrake] Task ${taskId}: encoding started — ${path.basename(sourcePath)} (slot ${this.activeJobs.size}/${limit})`)

    // ── Multiline JSON block parser ─────────────────────────────────────
    // HandBrakeCLI --json outputs MULTILINE JSON blocks like:
    //   Progress: {\r\n    "State": "WORKING",\r\n    "Working": { ... }\r\n}\r\n
    // We accumulate lines, track brace depth, and parse when complete.
    let buffer = ""
    let jsonBlock = ""
    let braceDepth = 0
    let currentMarker = ""
    const self = this

    const processStdout = (text: string) => {
      buffer += text

      const lines = buffer.split(/\r\n|\r|\n/)
      buffer = lines.pop() || ""

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue

        // If accumulating a JSON block
        if (braceDepth > 0) {
          jsonBlock += " " + line
          for (const ch of line) {
            if (ch === "{") braceDepth++
            else if (ch === "}") braceDepth--
          }
          if (braceDepth <= 0) {
            if (currentMarker === "Progress") {
              const progress = parseProgressLine(jsonBlock)
              if (progress) {
                if (!loggedFirstProgress) {
                  console.log(`[handbrake] Task ${taskId}: progress OK — ${progress.state} ${Math.round(progress.progress * 100)}%`)
                  loggedFirstProgress = true
                }
                self.handleProgress(taskId, progress)
              }
            }
            jsonBlock = ""
            braceDepth = 0
            currentMarker = ""
          }
          continue
        }

        // Check if this line starts a new JSON block: "Marker: {"
        const markerMatch = line.match(/^(\w+)\s*:\s*\{/)
        if (markerMatch) {
          currentMarker = markerMatch[1]
          const braceStart = line.indexOf("{")
          jsonBlock = line.substring(braceStart)
          braceDepth = 0
          for (const ch of jsonBlock) {
            if (ch === "{") braceDepth++
            else if (ch === "}") braceDepth--
          }
          if (braceDepth <= 0) {
            if (currentMarker === "Progress") {
              const progress = parseProgressLine(jsonBlock)
              if (progress) {
                if (!loggedFirstProgress) {
                  console.log(`[handbrake] Task ${taskId}: progress OK — ${progress.state} ${Math.round(progress.progress * 100)}%`)
                  loggedFirstProgress = true
                }
                self.handleProgress(taskId, progress)
              }
            }
            jsonBlock = ""
            braceDepth = 0
            currentMarker = ""
          }
          continue
        }

        // Standalone { starting a block
        if (line === "{") {
          jsonBlock = "{"
          braceDepth = 1
          currentMarker = "unknown"
        }
      }
    }

    proc.stdout?.on("data", (chunk: Buffer) => {
      processStdout(chunk.toString())
    })

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString()
      stderrLastChunks += text
      if (stderrLastChunks.length > 4096) {
        stderrLastChunks = stderrLastChunks.slice(-2048)
      }
    })

    proc.on("close", (code) => {
      this.activeJobs.delete(taskId)
      this.progressThrottle.delete(taskId)
      this.progressLogThrottle.delete(taskId)

      if (code === 0) {
        console.log(`[handbrake] Task ${taskId}: completed successfully`)
        let fileSize = 0
        try {
          const stat = fs.statSync(outputPath)
          fileSize = stat.size
        } catch {}

        // Capture source file size BEFORE any post-encode operations (delete/replace)
        let sourceSizeIn = 0
        const taskRow = db.prepare("SELECT delete_source, replace_source, source_path, output_path, skip_if_larger, fallback_preset_id, is_fallback_retry, preset_id, title FROM tasks WHERE id = ?").get(taskId) as any
        if (taskRow) {
          try { sourceSizeIn = fs.statSync(taskRow.source_path).size } catch {}
        }

        // ── Skip-if-larger check ────────────────────────────────────────
        if (taskRow && taskRow.skip_if_larger && fileSize > 0 && sourceSizeIn > 0 && fileSize >= sourceSizeIn) {
          const pctLarger = ((fileSize / sourceSizeIn - 1) * 100).toFixed(1)
          console.log(`[handbrake] Task ${taskId}: output (${(fileSize / 1048576).toFixed(1)} MB) >= source (${(sourceSizeIn / 1048576).toFixed(1)} MB) — ${pctLarger}% larger`)

          // Delete the larger output file
          try { fs.unlinkSync(outputPath) } catch {}

          if (!taskRow.is_fallback_retry && taskRow.fallback_preset_id) {
            // Retry with fallback preset
            const fallbackPreset = db.prepare("SELECT id, name, options_json FROM presets WHERE id = ?").get(taskRow.fallback_preset_id) as any
            if (fallbackPreset) {
              console.log(`[handbrake] Task ${taskId}: retrying with fallback preset "${fallbackPreset.name}"`)

              // Mark current task as skipped and move to history
              db.prepare(`
                UPDATE tasks SET status = 'skipped', progress = 1, completed_at = datetime('now'), file_size = ?, file_size_in = ?, error_message = ?
                WHERE id = ?
              `).run(fileSize, sourceSizeIn, `Output larger than source (${pctLarger}%), retrying with fallback preset "${fallbackPreset.name}"`, taskId)
              emitEvent({ type: "task:status", taskId, data: { status: "skipped" } })
              this.moveToHistory(taskId)

              // Create a new task with the fallback preset
              const maxOrder = db.prepare("SELECT COALESCE(MAX(sort_order), 0) as max_order FROM tasks").get() as { max_order: number }
              const fallbackOptions = JSON.parse(fallbackPreset.options_json)
              // Recompute output path with fallback format
              const fallbackFormat = fallbackOptions.container?.format || "mkv"
              const srcDir = path.dirname(taskRow.source_path)
              const srcExt = path.extname(taskRow.source_path)
              const srcBase = path.basename(taskRow.source_path, srcExt)
              const fallbackOutput = path.join(srcDir, `${srcBase}_encoded.${fallbackFormat}`)

              db.prepare(`
                INSERT INTO tasks (title, source_path, output_path, status, priority, sort_order, preset_id, options_json, delete_source, replace_source, skip_if_larger, fallback_preset_id, is_fallback_retry)
                VALUES (?, ?, ?, 'queued', 1, ?, ?, ?, ?, ?, 1, NULL, 1)
              `).run(
                taskRow.title,
                taskRow.source_path,
                fallbackOutput,
                maxOrder.max_order + 1,
                fallbackPreset.id,
                JSON.stringify(fallbackOptions),
                taskRow.delete_source || 0,
                taskRow.replace_source || 0
              )
              console.log(`[handbrake] Task ${taskId}: fallback task created for "${taskRow.title}"`)
              emitEvent({ type: "queue:changed" })
              setTimeout(() => this.processQueue(), 500)
              return
            }
          }

          // No fallback or already retried — discard
          const reason = taskRow.is_fallback_retry
            ? `Fallback also larger than source (${pctLarger}%), discarded`
            : `Output larger than source (${pctLarger}%), discarded`
          console.log(`[handbrake] Task ${taskId}: ${reason}`)

          db.prepare(`
            UPDATE tasks SET status = 'skipped', progress = 1, completed_at = datetime('now'), file_size = ?, file_size_in = ?, error_message = ?
            WHERE id = ?
          `).run(fileSize, sourceSizeIn, reason, taskId)
          emitEvent({ type: "task:status", taskId, data: { status: "skipped" } })

          // Send notification about skip
          notifyEncodingComplete({
            title: `⏭ ${path.basename(sourcePath)}`,
            sourcePath,
            sizeIn: sourceSizeIn,
            sizeOut: fileSize,
            duration: Math.round((Date.now() - job.startedAt) / 1000),
          }).catch(() => {})

          this.moveToHistory(taskId)
          emitEvent({ type: "queue:changed" })
          setTimeout(() => this.processQueue(), 500)
          return
        }

        db.prepare(`
          UPDATE tasks SET status = 'completed', progress = 1, completed_at = datetime('now'), file_size = ?, file_size_in = ?
          WHERE id = ?
        `).run(fileSize, sourceSizeIn, taskId)

        // Post-encode file operations
        if (taskRow && fileSize > 0) {
          if (taskRow.replace_source) {
            // Replace source: delete original, rename output to original name
            try {
              fs.unlinkSync(taskRow.source_path)
              fs.renameSync(outputPath, taskRow.source_path)
              console.log(`[handbrake] Task ${taskId}: replaced source file ${taskRow.source_path}`)
            } catch (err: any) {
              console.error(`[handbrake] Task ${taskId}: failed to replace source: ${err.message}`)
            }
          } else if (taskRow.delete_source) {
            // Delete source: just remove the original, keep encoded as _encoded
            try {
              fs.unlinkSync(taskRow.source_path)
              console.log(`[handbrake] Task ${taskId}: deleted source file ${taskRow.source_path}`)
            } catch (err: any) {
              console.error(`[handbrake] Task ${taskId}: failed to delete source: ${err.message}`)
            }
          }
        }

        // Update libraries that contain this source file
        try {
          updateLibraryAfterEncoding(
            taskRow?.source_path || sourcePath,
            taskRow?.output_path || outputPath,
            !!taskRow?.delete_source,
            !!taskRow?.replace_source,
          )
        } catch (err: any) {
          console.error(`[handbrake] Task ${taskId}: library update failed: ${err.message}`)
        }

        emitEvent({ type: "task:status", taskId, data: { status: "completed" } })

        // Send encoding complete notification
        const encTime = taskRow?.started_at
          ? Math.round((Date.now() - new Date(taskRow.started_at || job.startedAt).getTime()) / 1000)
          : Math.round((Date.now() - job.startedAt) / 1000)
        notifyEncodingComplete({
          title: path.basename(sourcePath),
          sourcePath,
          sizeIn: sourceSizeIn,
          sizeOut: fileSize,
          duration: encTime,
        }).catch(() => {})

        this.moveToHistory(taskId)
      } else {
        // Check if it was cancelled
        const task = db.prepare("SELECT status FROM tasks WHERE id = ?").get(taskId) as any
        if (task?.status === "cancelled") {
          this.moveToHistory(taskId)
        } else {
          const errorMsg = stderrLastChunks.slice(-500) || `Process exited with code ${code}`
          db.prepare("UPDATE tasks SET status = 'failed', error_message = ?, completed_at = datetime('now') WHERE id = ?")
            .run(errorMsg, taskId)
          emitEvent({ type: "task:status", taskId, data: { status: "failed", errorMessage: errorMsg } })

          // Send encoding error notification
          notifyEncodingError({
            title: path.basename(sourcePath),
            sourcePath,
            error: errorMsg.slice(0, 200),
          }).catch(() => {})

          this.moveToHistory(taskId)
        }
      }

      emitEvent({ type: "queue:changed" })
      // Trigger next job
      setTimeout(() => this.processQueue(), 500)
    })

    proc.on("error", (err) => {
      this.activeJobs.delete(taskId)
      db.prepare("UPDATE tasks SET status = 'failed', error_message = ? WHERE id = ?")
        .run(err.message, taskId)
      emitEvent({ type: "task:status", taskId, data: { status: "failed", errorMessage: err.message } })
      this.moveToHistory(taskId)
      emitEvent({ type: "queue:changed" })
    })
  }

  private progressLogThrottle: Map<number, number> = new Map()

  private handleProgress(taskId: number, progress: import("@/types/handbrake").EncodeProgress) {
    // Throttle DB updates to max 1 per second per task
    const now = Date.now()
    const lastUpdate = this.progressThrottle.get(taskId) || 0
    if (now - lastUpdate < 1000) return
    this.progressThrottle.set(taskId, now)

    const db = getDb()
    db.prepare(`
      UPDATE tasks SET progress = ?, eta_seconds = ?, fps = ?, avg_fps = ?, pass_current = ?, pass_total = ?
      WHERE id = ?
    `).run(progress.progress, progress.eta, progress.rate, progress.rateAvg, progress.pass, progress.passCount, taskId)

    emitEvent({
      type: "task:progress",
      taskId,
      data: {
        progress: progress.progress,
        eta: progress.eta,
        fps: progress.rate,
        avgFps: progress.rateAvg,
        pass: progress.pass,
        passCount: progress.passCount,
      },
    })

    // Log to console every 30 seconds so user can monitor from terminal
    const lastLog = this.progressLogThrottle.get(taskId) || 0
    if (now - lastLog >= 30000) {
      this.progressLogThrottle.set(taskId, now)
      const pct = Math.round(progress.progress * 100)
      const etaMin = Math.floor(progress.eta / 60)
      const etaSec = Math.round(progress.eta % 60)
      const task = db.prepare("SELECT title FROM tasks WHERE id = ?").get(taskId) as any
      const title = task?.title || `Task ${taskId}`
      console.log(`[handbrake] ${title}: ${pct}% | ${progress.rate.toFixed(1)} fps | ETA ${etaMin}m ${etaSec}s`)
    }
  }

  private moveToHistory(taskId: number) {
    const db = getDb()
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as any
    if (!task) return

    // Use pre-captured source size if available, fall back to reading file
    let fileSizeIn = task.file_size_in || 0
    if (!fileSizeIn) {
      try { fileSizeIn = fs.statSync(task.source_path).size } catch {}
    }

    let presetName: string | null = null
    if (task.preset_id) {
      const preset = db.prepare("SELECT name FROM presets WHERE id = ?").get(task.preset_id) as any
      presetName = preset?.name || null
    }

    let watcherName: string | null = null
    if (task.watcher_id) {
      const watcher = db.prepare("SELECT path FROM watched_folders WHERE id = ?").get(task.watcher_id) as any
      watcherName = watcher?.path || null
    }

    const encodingTime = task.started_at
      ? Math.round((new Date(task.completed_at || new Date()).getTime() - new Date(task.started_at).getTime()) / 1000)
      : null

    db.prepare(`
      INSERT INTO task_history (original_task_id, title, source_path, output_path, status, options_json, preset_name, file_size_in, file_size_out, encoding_time, error_message, watcher_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id, task.title, task.source_path, task.output_path, task.status,
      task.options_json, presetName, fileSizeIn, task.file_size,
      encodingTime, task.error_message, watcherName, task.created_at
    )

    db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId)
  }

  cancelTask(taskId: number) {
    const job = this.activeJobs.get(taskId)
    if (job) {
      const db = getDb()
      db.prepare("UPDATE tasks SET status = 'cancelled' WHERE id = ?").run(taskId)
      job.process.kill("SIGTERM")
      // Give it 5 seconds then force kill
      setTimeout(() => {
        try { job.process.kill("SIGKILL") } catch {}
      }, 5000)
    }
  }

  pauseTask(taskId: number) {
    const job = this.activeJobs.get(taskId)
    if (job) {
      job.process.kill("SIGSTOP")
      const db = getDb()
      db.prepare("UPDATE tasks SET status = 'paused' WHERE id = ?").run(taskId)
      emitEvent({ type: "task:status", taskId, data: { status: "paused" } })
    }
  }

  resumeTask(taskId: number) {
    const job = this.activeJobs.get(taskId)
    if (job) {
      job.process.kill("SIGCONT")
      const db = getDb()
      db.prepare("UPDATE tasks SET status = 'encoding' WHERE id = ?").run(taskId)
      emitEvent({ type: "task:status", taskId, data: { status: "encoding" } })
    }
  }

  getActiveTaskIds(): number[] {
    return Array.from(this.activeJobs.keys())
  }

  isTaskActive(taskId: number): boolean {
    return this.activeJobs.has(taskId)
  }

  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
    }
    for (const job of this.activeJobs.values()) {
      try { job.process.kill("SIGTERM") } catch {}
    }
    this.activeJobs.clear()
  }
}

export function getQueueManager(): QueueManager {
  if (!globalForQueue.__queueManager) {
    globalForQueue.__queueManager = new QueueManager()
  }
  return globalForQueue.__queueManager
}
