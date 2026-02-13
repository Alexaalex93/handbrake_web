import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { resetProbeCache } from "@/lib/media-probe"

export async function GET() {
  try {
    const db = getDb()
    const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[]

    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.key] = row.value
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("GET /api/settings error:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = getDb()
    const body: Record<string, string> = await request.json()

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be a key-value object" },
        { status: 400 }
      )
    }

    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `)

    const updateMany = db.transaction((entries: [string, string][]) => {
      for (const [key, value] of entries) {
        upsert.run(key, String(value))
      }
    })

    updateMany(Object.entries(body))

    // Reset probe cache if tool paths changed
    if ("handbrake_path" in body || "ffprobe_path" in body) {
      resetProbeCache()
    }

    // Return updated settings
    const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[]
    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.key] = row.value
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("PUT /api/settings error:", error)
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    )
  }
}
