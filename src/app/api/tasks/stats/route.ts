import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export async function GET() {
  try {
    const db = getDb()

    const counts = db.prepare(`
      SELECT status, COUNT(*) as count FROM tasks
      WHERE status IN ('pending', 'queued', 'encoding', 'paused')
      GROUP BY status
    `).all() as { status: string; count: number }[]

    const stats: Record<string, number> = { pending: 0, queued: 0, encoding: 0, paused: 0 }
    for (const row of counts) {
      stats[row.status] = row.count
    }

    const nextTask = db.prepare(`
      SELECT title FROM tasks
      WHERE status = 'queued'
      ORDER BY priority DESC, sort_order ASC, id ASC
      LIMIT 1
    `).get() as { title: string } | undefined

    return NextResponse.json({
      pending: stats.pending,
      queued: stats.queued,
      encoding: stats.encoding,
      paused: stats.paused,
      nextTask: nextTask?.title ?? null,
    })
  } catch (error) {
    console.error("GET /api/tasks/stats error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
