import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getWatcherManager } from "@/lib/watcher/manager"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const watcher = db.prepare("SELECT * FROM watched_folders WHERE id = ?").get(id)

    if (!watcher) {
      return NextResponse.json({ error: "Watcher not found" }, { status: 404 })
    }

    const manager = getWatcherManager()
    manager.runScan(Number(id))

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("POST /api/watchers/[id]/scan error:", error)
    return NextResponse.json(
      { error: "Failed to run scan" },
      { status: 500 }
    )
  }
}
