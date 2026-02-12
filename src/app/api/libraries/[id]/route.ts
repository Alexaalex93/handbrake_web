import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const lib = db.prepare("SELECT * FROM libraries WHERE id = ?").get(Number(id)) as any

    if (!lib) {
      return NextResponse.json({ error: "Library not found" }, { status: 404 })
    }

    // Get items with optional filtering
    const url = new URL(_request.url)
    const codec = url.searchParams.get("codec")
    const search = url.searchParams.get("search")
    const page = parseInt(url.searchParams.get("page") || "1")
    const limit = parseInt(url.searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    let whereClause = "WHERE library_id = ?"
    const queryParams: any[] = [Number(id)]

    if (codec && codec !== "all") {
      whereClause += " AND video_codec = ?"
      queryParams.push(codec)
    }
    if (search) {
      whereClause += " AND file_name LIKE ?"
      queryParams.push(`%${search}%`)
    }

    const total = (db.prepare(
      `SELECT COUNT(*) as count FROM library_items ${whereClause}`
    ).get(...queryParams) as any).count

    const items = db.prepare(
      `SELECT * FROM library_items ${whereClause} ORDER BY file_name ASC LIMIT ? OFFSET ?`
    ).all(...queryParams, limit, offset) as any[]

    // Get codec distribution for this library
    const codecs = db.prepare(
      `SELECT video_codec as codec, COUNT(*) as count FROM library_items
       WHERE library_id = ? AND video_codec IS NOT NULL
       GROUP BY video_codec ORDER BY count DESC`
    ).all(Number(id)) as any[]

    const mappedItems = items.map((i) => ({
      id: i.id,
      libraryId: i.library_id,
      filePath: i.file_path,
      fileName: i.file_name,
      fileSize: i.file_size,
      fileMtime: i.file_mtime,
      duration: i.duration,
      width: i.width,
      height: i.height,
      videoCodec: i.video_codec,
      videoBitrate: i.video_bitrate,
      audioCodec: i.audio_codec,
      audioChannels: i.audio_channels,
      audioBitrate: i.audio_bitrate,
      subtitleCount: i.subtitle_count,
      container: i.container,
      scanStatus: i.scan_status,
      scanError: i.scan_error,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
    }))

    return NextResponse.json({
      library: {
        id: lib.id,
        name: lib.name,
        path: lib.path,
        recursive: !!lib.recursive,
        fileExtensions: lib.file_extensions,
        autoScan: !!lib.auto_scan,
        scanInterval: lib.scan_interval,
        lastScanAt: lib.last_scan_at,
        createdAt: lib.created_at,
      },
      items: mappedItems,
      total,
      page,
      limit,
      codecs,
    })
  } catch (error) {
    console.error("GET /api/libraries/[id] error:", error)
    return NextResponse.json({ error: "Failed to fetch library" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const db = getDb()

    const existing = db.prepare("SELECT id FROM libraries WHERE id = ?").get(Number(id))
    if (!existing) {
      return NextResponse.json({ error: "Library not found" }, { status: 404 })
    }

    const updates: string[] = []
    const values: any[] = []

    if (body.name !== undefined) { updates.push("name = ?"); values.push(body.name.trim()) }
    if (body.path !== undefined) { updates.push("path = ?"); values.push(body.path.trim()) }
    if (body.recursive !== undefined) { updates.push("recursive = ?"); values.push(body.recursive ? 1 : 0) }
    if (body.fileExtensions !== undefined) { updates.push("file_extensions = ?"); values.push(body.fileExtensions) }
    if (body.autoScan !== undefined) { updates.push("auto_scan = ?"); values.push(body.autoScan ? 1 : 0) }
    if (body.scanInterval !== undefined) { updates.push("scan_interval = ?"); values.push(body.scanInterval) }

    if (updates.length > 0) {
      values.push(Number(id))
      db.prepare(`UPDATE libraries SET ${updates.join(", ")} WHERE id = ?`).run(...values)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("PUT /api/libraries/[id] error:", error)
    return NextResponse.json({ error: "Failed to update library" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    db.prepare("DELETE FROM libraries WHERE id = ?").run(Number(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/libraries/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete library" }, { status: 500 })
  }
}
