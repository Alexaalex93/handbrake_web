import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getQueueManager } from "@/lib/queue/manager"
import type { Task } from "@/types/task"

function rowToTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    sourcePath: row.source_path,
    outputPath: row.output_path,
    status: row.status,
    priority: row.priority,
    sortOrder: row.sort_order,
    presetId: row.preset_id,
    options: JSON.parse(row.options_json),
    progress: row.progress,
    etaSeconds: row.eta_seconds,
    fps: row.fps,
    avgFps: row.avg_fps,
    passCurrent: row.pass_current,
    passTotal: row.pass_total,
    fileSize: row.file_size,
    errorMessage: row.error_message,
    sourceInfo: row.source_info ? JSON.parse(row.source_info) : null,
    deleteSource: !!row.delete_source,
    replaceSource: !!row.replace_source,
    watcherId: row.watcher_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id)

    if (!row) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json(rowToTask(row))
  } catch (error) {
    console.error("GET /api/tasks/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    if (existing.status !== "pending" && existing.status !== "queued") {
      return NextResponse.json(
        { error: "Can only update tasks that are pending or queued" },
        { status: 409 }
      )
    }

    const body = await request.json()

    const title = body.title ?? existing.title
    const sourcePath = body.sourcePath ?? existing.source_path
    const outputPath = body.outputPath ?? existing.output_path
    const priority = body.priority ?? existing.priority
    const presetId = body.presetId !== undefined ? body.presetId : existing.preset_id
    const options = body.options ? JSON.stringify(body.options) : existing.options_json

    db.prepare(`
      UPDATE tasks SET title = ?, source_path = ?, output_path = ?, priority = ?, preset_id = ?, options_json = ?
      WHERE id = ?
    `).run(title, sourcePath, outputPath, priority, presetId, options, id)

    const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id)
    return NextResponse.json(rowToTask(updated))
  } catch (error) {
    console.error("PUT /api/tasks/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // If encoding, cancel it first
    if (existing.status === "encoding" || existing.status === "paused") {
      const queueManager = getQueueManager()
      queueManager.cancelTask(Number(id))
    }

    db.prepare("DELETE FROM tasks WHERE id = ?").run(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/tasks/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    )
  }
}
