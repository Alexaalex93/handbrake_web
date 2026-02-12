import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export async function GET() {
  try {
    const db = getDb()
    const libraries = db.prepare(`
      SELECT l.*,
        (SELECT COUNT(*) FROM library_items WHERE library_id = l.id) as item_count
      FROM libraries l
      ORDER BY l.name
    `).all() as any[]

    const result = libraries.map((l) => ({
      id: l.id,
      name: l.name,
      path: l.path,
      recursive: !!l.recursive,
      fileExtensions: l.file_extensions,
      autoScan: !!l.auto_scan,
      scanInterval: l.scan_interval,
      lastScanAt: l.last_scan_at,
      createdAt: l.created_at,
      itemCount: l.item_count,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("GET /api/libraries error:", error)
    return NextResponse.json({ error: "Failed to fetch libraries" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, path, recursive = true, fileExtensions, autoScan = false, scanInterval = 3600 } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }
    if (!path?.trim()) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 })
    }

    const db = getDb()
    const result = db.prepare(`
      INSERT INTO libraries (name, path, recursive, file_extensions, auto_scan, scan_interval)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      path.trim(),
      recursive ? 1 : 0,
      fileExtensions || ".mkv,.mp4,.avi,.mov,.wmv,.flv,.ts,.m4v,.webm",
      autoScan ? 1 : 0,
      scanInterval
    )

    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
  } catch (error: any) {
    if (error?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return NextResponse.json({ error: "A library with that name already exists" }, { status: 409 })
    }
    console.error("POST /api/libraries error:", error)
    return NextResponse.json({ error: "Failed to create library" }, { status: 500 })
  }
}
