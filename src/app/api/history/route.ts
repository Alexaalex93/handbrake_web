import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import type { TaskHistory } from "@/types/task"

function rowToHistory(row: any): TaskHistory {
  return {
    id: row.id,
    originalTaskId: row.original_task_id,
    title: row.title,
    sourcePath: row.source_path,
    outputPath: row.output_path,
    status: row.status,
    options: JSON.parse(row.options_json),
    presetName: row.preset_name,
    fileSizeIn: row.file_size_in,
    fileSizeOut: row.file_size_out,
    encodingTime: row.encoding_time,
    errorMessage: row.error_message,
    watcherName: row.watcher_name,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))
    const status = searchParams.get("status")
    const offset = (page - 1) * limit

    let countQuery = "SELECT COUNT(*) as total FROM task_history"
    let dataQuery = "SELECT * FROM task_history"
    const params: any[] = []

    if (status) {
      countQuery += " WHERE status = ?"
      dataQuery += " WHERE status = ?"
      params.push(status)
    }

    dataQuery += " ORDER BY completed_at DESC LIMIT ? OFFSET ?"

    const countRow = db.prepare(countQuery).get(...params) as { total: number }
    const total = countRow.total

    const rows = db.prepare(dataQuery).all(...params, limit, offset) as any[]
    const items = rows.map(rowToHistory)

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("GET /api/history error:", error)
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const db = getDb()
    db.prepare("DELETE FROM task_history").run()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/history error:", error)
    return NextResponse.json(
      { error: "Failed to clear history" },
      { status: 500 }
    )
  }
}
