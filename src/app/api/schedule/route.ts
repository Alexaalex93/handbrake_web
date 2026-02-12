import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import type { Schedule } from "@/types/settings"

function rowToSchedule(row: any): Schedule {
  return {
    id: row.id,
    enabled: !!row.enabled,
    mode: row.mode,
    timeStart: row.time_start,
    timeEnd: row.time_end,
    daysOfWeek: row.days_of_week,
    cronExpr: row.cron_expr,
    updatedAt: row.updated_at,
  }
}

export async function GET() {
  try {
    const db = getDb()
    const row = db.prepare("SELECT * FROM schedule WHERE id = 1").get()

    if (!row) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
    }

    return NextResponse.json(rowToSchedule(row))
  } catch (error) {
    console.error("GET /api/schedule error:", error)
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()

    const existing = db.prepare("SELECT * FROM schedule WHERE id = 1").get() as any
    if (!existing) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
    }

    const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled
    const mode = body.mode ?? existing.mode
    const timeStart = body.timeStart !== undefined ? body.timeStart : existing.time_start
    const timeEnd = body.timeEnd !== undefined ? body.timeEnd : existing.time_end
    const daysOfWeek = body.daysOfWeek ?? existing.days_of_week
    const cronExpr = body.cronExpr !== undefined ? body.cronExpr : existing.cron_expr

    if (!["always", "time_window", "cron"].includes(mode)) {
      return NextResponse.json(
        { error: "mode must be one of: always, time_window, cron" },
        { status: 400 }
      )
    }

    db.prepare(`
      UPDATE schedule SET enabled = ?, mode = ?, time_start = ?, time_end = ?, days_of_week = ?, cron_expr = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(enabled, mode, timeStart, timeEnd, daysOfWeek, cronExpr)

    const updated = db.prepare("SELECT * FROM schedule WHERE id = 1").get()
    return NextResponse.json(rowToSchedule(updated))
  } catch (error) {
    console.error("PUT /api/schedule error:", error)
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    )
  }
}
