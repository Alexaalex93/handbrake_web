import { type ChildProcess } from "child_process"
import { getDb } from "@/lib/db"
import { buildArgs, spawnHandBrake } from "@/lib/handbrake/cli"
import { parseProgressLine } from "@/lib/handbrake/parser"
import { emitEvent } from "@/lib/events/emitter"
import { isEncodingAllowed } from "./scheduler"
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

    const job: ActiveJob = { taskId, process: proc, startedAt: Date.now() }
    this.activeJobs.set(taskId, job)

    let stderrLastChunks = ""  // Keep last 2KB for error messages
    let loggedFirstProgress = false
    let stdoutChunkCount = 0
    let stderrChunkCount = 0
    let stdoutTotalBytes = 0
    let stderrTotalBytes = 0

    console.log(`[handbrake] Task ${taskId}: encoding started — ${path.basename(sourcePath)}`)
    console.log(`[handbrake] Task ${taskId}: pid=${proc.pid}, stdout=${!!proc.stdout}, stderr=${!!proc.stderr}`)

    // Buffer approach: accumulate ALL stdout/stderr data and scan for JSON patterns.
    // HandBrakeCLI --json outputs progress as JSON blocks. On Windows, the output
    // may come as tiny chunks without clear line delimiters.
    let stdoutBuffer = ""
    let stderrBuffer = ""
    let unparsedLinesSampled = 0

    const processBuffer = (buffer: string, streamName: string): string => {
      // Try splitting on \r, \n, or \r\n
      const parts = buffer.split(/\r\n|\r|\n/)
      const remainder = parts.pop() || "" // Keep incomplete last part

      for (const rawLine of parts) {
        const line = rawLine.trim()
        if (!line) continue

        // Try to parse progress
        const progress = parseProgressLine(line)
        if (progress) {
          if (!loggedFirstProgress) {
            console.log(`[handbrake] Task ${taskId}: FIRST PROGRESS from ${streamName} — ${progress.state} ${Math.round(progress.progress * 100)}%`)
            console.log(`[handbrake] Task ${taskId}: parsed line: ${line.substring(0, 300)}`)
            loggedFirstProgress = true
          }
          this.handleProgress(taskId, progress)
        } else if (unparsedLinesSampled < 10 && line.length > 5) {
          // Log lines that DIDN'T parse so we can see the actual format
          console.log(`[handbrake] Task ${taskId} ${streamName} UNPARSED (${line.length} chars): ${line.substring(0, 400)}`)
          unparsedLinesSampled++
        }
      }

      return remainder
    }

    proc.stdout?.on("data", (chunk: Buffer) => {
      stdoutChunkCount++
      stdoutTotalBytes += chunk.length
      const text = chunk.toString()
      stdoutBuffer += text

      // Log first chunk raw with escape characters visible
      if (stdoutChunkCount === 1) {
        const raw = chunk.toString("hex").substring(0, 200)
        const readable = text.substring(0, 500).replace(/\r/g, "\\r").replace(/\n/g, "\\n")
        console.log(`[handbrake] Task ${taskId} stdout FIRST chunk (${chunk.length}B hex): ${raw}`)
        console.log(`[handbrake] Task ${taskId} stdout FIRST chunk (readable): ${readable}`)
      }

      // Process buffer
      stdoutBuffer = processBuffer(stdoutBuffer, "stdout")

      // Safety: if buffer grows too large without line breaks, force-dump it
      if (stdoutBuffer.length > 100000) {
        console.log(`[handbrake] Task ${taskId}: stdout buffer overflow (${stdoutBuffer.length}B), dumping sample: ${stdoutBuffer.substring(0, 500).replace(/\r/g, "\\r").replace(/\n/g, "\\n")}`)
        // Try to find any JSON in the giant buffer
        const stateMatch = stdoutBuffer.match(/"State"\s*:\s*\d/)
        if (stateMatch) {
          console.log(`[handbrake] Task ${taskId}: found "State" in buffer at offset ${stateMatch.index}`)
        }
        stdoutBuffer = stdoutBuffer.slice(-1000) // Keep last 1KB
      }
    })

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString()
      stderrChunkCount++
      stderrTotalBytes += chunk.length
      stderrLastChunks += text
      if (stderrLastChunks.length > 4096) {
        stderrLastChunks = stderrLastChunks.slice(-2048)
      }
      stderrBuffer += text
      stderrBuffer = processBuffer(stderrBuffer, "stderr")
    })

    // Diagnostic: after 5 seconds dump buffer state
    setTimeout(() => {
      if (this.activeJobs.has(taskId)) {
        console.log(`[handbrake] Task ${taskId}: 5s check — stdout: ${stdoutChunkCount} chunks (${stdoutTotalBytes}B), stderr: ${stderrChunkCount} chunks (${stderrTotalBytes}B), progress: ${loggedFirstProgress}`)
        console.log(`[handbrake] Task ${taskId}: stdout buffer size: ${stdoutBuffer.length}, last 200 chars: ${stdoutBuffer.slice(-200).replace(/\r/g, "\\r").replace(/\n/g, "\\n")}`)
      }
    }, 5000)

    // Second diagnostic at 15 seconds
    setTimeout(() => {
      if (this.activeJobs.has(taskId)) {
        console.log(`[handbrake] Task ${taskId}: 15s check — stdout: ${stdoutChunkCount} chunks (${stdoutTotalBytes}B), progress: ${loggedFirstProgress}`)
        if (!loggedFirstProgress && stdoutBuffer.length > 0) {
          console.log(`[handbrake] Task ${taskId}: NO PROGRESS PARSED! Buffer sample (first 500): ${stdoutBuffer.substring(0, 500).replace(/\r/g, "\\r").replace(/\n/g, "\\n")}`)
          console.log(`[handbrake] Task ${taskId}: Buffer sample (last 500): ${stdoutBuffer.slice(-500).replace(/\r/g, "\\r").replace(/\n/g, "\\n")}`)
        }
      }
    }, 15000)

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

        db.prepare(`
          UPDATE tasks SET status = 'completed', progress = 1, completed_at = datetime('now'), file_size = ?
          WHERE id = ?
        `).run(fileSize, taskId)

        // Delete source file if requested and output exists with valid size
        const taskRow = db.prepare("SELECT delete_source, source_path FROM tasks WHERE id = ?").get(taskId) as any
        if (taskRow?.delete_source && fileSize > 0) {
          try {
            fs.unlinkSync(taskRow.source_path)
            console.log(`[handbrake] Task ${taskId}: deleted source file ${taskRow.source_path}`)
          } catch (err: any) {
            console.error(`[handbrake] Task ${taskId}: failed to delete source: ${err.message}`)
          }
        }

        emitEvent({ type: "task:status", taskId, data: { status: "completed" } })
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

    let fileSizeIn = 0
    try { fileSizeIn = fs.statSync(task.source_path).size } catch {}

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
