import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getQueueManager } from "@/lib/queue/manager"
import { emitEvent } from "@/lib/events/emitter"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const taskId = Number(id)
    const db = getDb()
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as any

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const body = await request.json()
    const { action } = body

    if (!action || !["start", "pause", "resume", "cancel", "retry"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be one of: start, pause, resume, cancel, retry" },
        { status: 400 }
      )
    }

    const queueManager = getQueueManager()

    switch (action) {
      case "start": {
        if (task.status !== "pending" && task.status !== "queued") {
          return NextResponse.json(
            { error: "Can only start a pending or queued task" },
            { status: 409 }
          )
        }
        db.prepare("UPDATE tasks SET status = 'queued' WHERE id = ?").run(taskId)
        emitEvent({ type: "task:status", taskId, data: { status: "queued" } })
        emitEvent({ type: "queue:changed" })
        queueManager.processQueue()
        break
      }

      case "pause": {
        if (task.status !== "encoding") {
          return NextResponse.json(
            { error: "Can only pause an encoding task" },
            { status: 409 }
          )
        }
        queueManager.pauseTask(taskId)
        break
      }

      case "resume": {
        if (task.status !== "paused") {
          return NextResponse.json(
            { error: "Can only resume a paused task" },
            { status: 409 }
          )
        }
        queueManager.resumeTask(taskId)
        break
      }

      case "cancel": {
        if (task.status === "encoding" || task.status === "paused") {
          queueManager.cancelTask(taskId)
        } else if (task.status === "queued" || task.status === "pending") {
          db.prepare("UPDATE tasks SET status = 'cancelled', completed_at = datetime('now') WHERE id = ?").run(taskId)
          emitEvent({ type: "task:status", taskId, data: { status: "cancelled" } })
        } else {
          return NextResponse.json(
            { error: "Cannot cancel a task with status: " + task.status },
            { status: 409 }
          )
        }
        break
      }

      case "retry": {
        if (task.status !== "failed" && task.status !== "cancelled") {
          return NextResponse.json(
            { error: "Can only retry a failed or cancelled task" },
            { status: 409 }
          )
        }
        db.prepare(`
          UPDATE tasks SET status = 'queued', progress = 0, eta_seconds = 0, fps = 0, avg_fps = 0,
            pass_current = 0, pass_total = 0, error_message = NULL, started_at = NULL, completed_at = NULL
          WHERE id = ?
        `).run(taskId)
        emitEvent({ type: "task:status", taskId, data: { status: "queued" } })
        emitEvent({ type: "queue:changed" })
        break
      }
    }

    const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as any
    return NextResponse.json({
      success: true,
      status: updated?.status ?? task.status,
    })
  } catch (error) {
    console.error("POST /api/tasks/[id]/actions error:", error)
    return NextResponse.json(
      { error: "Failed to perform action" },
      { status: 500 }
    )
  }
}
