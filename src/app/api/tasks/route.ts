import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getQueueManager } from "@/lib/queue/manager"
import type { Task, CreateTaskInput } from "@/types/task"

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
    watcherId: row.watcher_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }
}

export async function GET(request: NextRequest) {
  try {
    // Eagerly initialize QueueManager singleton on first API call
    // This ensures the 3s poll loop starts as soon as the dashboard loads
    getQueueManager()

    const db = getDb()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    let rows: any[]
    if (status) {
      rows = db
        .prepare("SELECT * FROM tasks WHERE status = ? ORDER BY priority DESC, sort_order ASC, id ASC")
        .all(status)
    } else {
      rows = db
        .prepare("SELECT * FROM tasks ORDER BY priority DESC, sort_order ASC, id ASC")
        .all()
    }

    const tasks = rows.map(rowToTask)
    return NextResponse.json(tasks)
  } catch (error) {
    console.error("GET /api/tasks error:", error)
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body: CreateTaskInput = await request.json()

    if (!body.sourcePath || !body.outputPath || !body.options) {
      return NextResponse.json(
        { error: "sourcePath, outputPath, and options are required" },
        { status: 400 }
      )
    }

    const title = body.title || body.sourcePath.split(/[/\\]/).pop() || "Untitled"
    const priority = body.priority ?? 0
    const presetId = body.presetId ?? null

    // Auto-assign sort_order as max + 1
    const maxOrder = db
      .prepare("SELECT COALESCE(MAX(sort_order), 0) as max_order FROM tasks")
      .get() as { max_order: number }
    const sortOrder = maxOrder.max_order + 1

    const deleteSource = body.deleteSource ? 1 : 0

    const result = db.prepare(`
      INSERT INTO tasks (title, source_path, output_path, status, priority, sort_order, preset_id, options_json, delete_source)
      VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?)
    `).run(
      title,
      body.sourcePath,
      body.outputPath,
      priority,
      sortOrder,
      presetId,
      JSON.stringify(body.options),
      deleteSource
    )

    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid)
    const task = rowToTask(row)

    // Trigger immediate queue processing for the new task
    getQueueManager().processQueue()

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error("POST /api/tasks error:", error)
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    )
  }
}
