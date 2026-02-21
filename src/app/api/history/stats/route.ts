import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export async function GET() {
  try {
    const db = getDb()

    // Overall stats
    const overall = db.prepare(`
      SELECT
        COUNT(*) as total_encoded,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as total_completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(CASE WHEN status = 'completed' THEN COALESCE(file_size_in, 0) ELSE 0 END) as total_size_in,
        SUM(CASE WHEN status = 'completed' THEN COALESCE(file_size_out, 0) ELSE 0 END) as total_size_out,
        AVG(CASE WHEN status = 'completed' AND encoding_time > 0 THEN encoding_time ELSE NULL END) as avg_encoding_time,
        SUM(CASE WHEN status = 'completed' THEN COALESCE(encoding_time, 0) ELSE 0 END) as total_encoding_time
      FROM task_history
    `).get() as any

    // Biggest savings (top 5)
    const biggestSavings = db.prepare(`
      SELECT title, file_size_in, file_size_out,
        (file_size_in - file_size_out) as saved,
        ROUND(CAST(file_size_out AS REAL) / NULLIF(file_size_in, 0) * 100, 1) as ratio
      FROM task_history
      WHERE status = 'completed' AND file_size_in > 0 AND file_size_out > 0
      ORDER BY saved DESC
      LIMIT 5
    `).all() as any[]

    // Best compression ratio (top 5)
    const bestRatio = db.prepare(`
      SELECT title, file_size_in, file_size_out,
        ROUND(CAST(file_size_out AS REAL) / NULLIF(file_size_in, 0) * 100, 1) as ratio
      FROM task_history
      WHERE status = 'completed' AND file_size_in > 0 AND file_size_out > 0
      ORDER BY ratio ASC
      LIMIT 5
    `).all() as any[]

    // Daily stats for the last 14 days
    const dailyStats = db.prepare(`
      SELECT
        DATE(completed_at) as date,
        COUNT(*) as count,
        SUM(COALESCE(file_size_in, 0) - COALESCE(file_size_out, 0)) as saved
      FROM task_history
      WHERE status = 'completed' AND completed_at >= datetime('now', '-14 days')
      GROUP BY DATE(completed_at)
      ORDER BY date ASC
    `).all() as any[]

    const totalSaved = (overall?.total_size_in || 0) - (overall?.total_size_out || 0)

    return NextResponse.json({
      totalEncoded: overall?.total_completed || 0,
      totalFailed: overall?.total_failed || 0,
      totalSizeIn: overall?.total_size_in || 0,
      totalSizeOut: overall?.total_size_out || 0,
      totalSaved,
      avgEncodingTime: Math.round(overall?.avg_encoding_time || 0),
      totalEncodingTime: overall?.total_encoding_time || 0,
      biggestSavings,
      bestRatio,
      dailyStats,
    })
  } catch (error) {
    console.error("GET /api/history/stats error:", error)
    return NextResponse.json({ error: "Failed to fetch history stats" }, { status: 500 })
  }
}
