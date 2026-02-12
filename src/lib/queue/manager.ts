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

    let stdoutBuffer = ""

    proc.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString()
      const lines = stdoutBuffer.split("\n")
      stdoutBuffer = lines.pop() || ""

      for (const line of lines) {
        const progress = parseProgressLine(line)
        if (progress) {
          this.handleProgress(taskId, progress)
        }
      }
    })

    let stderrBuffer = ""
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString()
    })

    proc.on("close", (code) => {
      this.activeJobs.delete(taskId)
      this.progressThrottle.delete(taskId)

      if (code === 0) {
        let fileSize = 0
        try {
          const stat = fs.statSync(outputPath)
          fileSize = stat.size
        } catch {}

        db.prepare(`
          UPDATE tasks SET status = 'completed', progress = 1, completed_at = datetime('now'), file_size = ?
          WHERE id = ?
        `).run(fileSize, taskId)

        emitEvent({ type: "task:status", taskId, data: { status: "completed" } })
        this.moveToHistory(taskId)
      } else {
        // Check if it was cancelled
        const task = db.prepare("SELECT status FROM tasks WHERE id = ?").get(taskId) as any
        if (task?.status === "cancelled") {
          this.moveToHistory(taskId)
        } else {
          const errorMsg = stderrBuffer.slice(-500) || `Process exited with code ${code}`
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

  private handleProgress(taskId: number, progress: import("@/types/handbrake").EncodeProgress) {
    // Throttle to max 1 update per second per task
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
