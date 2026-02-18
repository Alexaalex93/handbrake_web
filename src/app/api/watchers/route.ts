import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getWatcherManager } from "@/lib/watcher/manager"
import type { WatchedFolder } from "@/types/watcher"

function rowToWatcher(row: any): WatchedFolder {
  return {
    id: row.id,
    path: row.path,
    enabled: !!row.enabled,
    recursive: !!row.recursive,
    scanInterval: row.scan_interval,
    fileExtensions: row.file_extensions,
    presetId: row.preset_id,
    outputMode: row.output_mode,
    outputDir: row.output_dir,
    outputPattern: row.output_pattern,
    minFileSize: row.min_file_size,
    deleteSource: !!row.delete_source,
    replaceSource: !!row.replace_source,
    lastScanAt: row.last_scan_at,
    createdAt: row.created_at,
  }
}

export async function GET() {
  try {
    const db = getDb()
    const rows = db.prepare("SELECT * FROM watched_folders ORDER BY created_at DESC").all()
    const watchers = rows.map(rowToWatcher)
    return NextResponse.json(watchers)
  } catch (error) {
    console.error("GET /api/watchers error:", error)
    return NextResponse.json(
      { error: "Failed to fetch watchers" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()

    if (!body.path) {
      return NextResponse.json(
        { error: "path is required" },
        { status: 400 }
      )
    }

    if (!body.outputMode || !["fixed", "beside_source"].includes(body.outputMode)) {
      return NextResponse.json(
        { error: "outputMode must be 'fixed' or 'beside_source'" },
        { status: 400 }
      )
    }

    if (body.outputMode === "fixed" && !body.outputDir) {
      return NextResponse.json(
        { error: "outputDir is required when outputMode is 'fixed'" },
        { status: 400 }
      )
    }

    const recursive = body.recursive !== undefined ? (body.recursive ? 1 : 0) : 1
    const scanInterval = body.scanInterval ?? 60
    const fileExtensions = body.fileExtensions || ".mkv,.mp4,.avi,.mov,.wmv,.flv,.ts,.m4v,.webm"
    const presetId = body.presetId ?? null
    const outputDir = body.outputDir ?? null
    const outputPattern = body.outputPattern || "{name}_encoded.{ext}"
    const minFileSize = body.minFileSize ?? 0
    const deleteSource = body.deleteSource ? 1 : 0
    const replaceSource = body.replaceSource ? 1 : 0

    const result = db.prepare(`
      INSERT INTO watched_folders (path, recursive, scan_interval, file_extensions, preset_id, output_mode, output_dir, output_pattern, min_file_size, delete_source, replace_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.path,
      recursive,
      scanInterval,
      fileExtensions,
      presetId,
      body.outputMode,
      outputDir,
      outputPattern,
      minFileSize,
      deleteSource,
      replaceSource
    )

    const watcherId = Number(result.lastInsertRowid)

    // Start the watcher
    const watcherManager = getWatcherManager()
    watcherManager.startWatcher(watcherId, scanInterval)

    const row = db.prepare("SELECT * FROM watched_folders WHERE id = ?").get(watcherId)
    return NextResponse.json(rowToWatcher(row), { status: 201 })
  } catch (error: any) {
    if (error?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return NextResponse.json(
        { error: "A watcher for this path already exists" },
        { status: 409 }
      )
    }
    console.error("POST /api/watchers error:", error)
    return NextResponse.json(
      { error: "Failed to create watcher" },
      { status: 500 }
    )
  }
}
