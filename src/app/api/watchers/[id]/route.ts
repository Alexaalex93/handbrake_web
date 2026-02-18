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
    codecFilter: row.codec_filter || "",
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const row = db.prepare("SELECT * FROM watched_folders WHERE id = ?").get(id)

    if (!row) {
      return NextResponse.json({ error: "Watcher not found" }, { status: 404 })
    }

    return NextResponse.json(rowToWatcher(row))
  } catch (error) {
    console.error("GET /api/watchers/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to fetch watcher" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const existing = db.prepare("SELECT * FROM watched_folders WHERE id = ?").get(id) as any

    if (!existing) {
      return NextResponse.json({ error: "Watcher not found" }, { status: 404 })
    }

    const body = await request.json()

    const path = body.path ?? existing.path
    const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled
    const recursive = body.recursive !== undefined ? (body.recursive ? 1 : 0) : existing.recursive
    const scanInterval = body.scanInterval ?? existing.scan_interval
    const fileExtensions = body.fileExtensions ?? existing.file_extensions
    const codecFilter = body.codecFilter !== undefined ? body.codecFilter : (existing.codec_filter || "")
    const presetId = body.presetId !== undefined ? body.presetId : existing.preset_id
    const outputMode = body.outputMode ?? existing.output_mode
    const outputDir = body.outputDir !== undefined ? body.outputDir : existing.output_dir
    const outputPattern = body.outputPattern ?? existing.output_pattern
    const minFileSize = body.minFileSize ?? existing.min_file_size
    const deleteSource = body.deleteSource !== undefined ? (body.deleteSource ? 1 : 0) : existing.delete_source
    const replaceSource = body.replaceSource !== undefined ? (body.replaceSource ? 1 : 0) : existing.replace_source

    db.prepare(`
      UPDATE watched_folders SET path = ?, enabled = ?, recursive = ?, scan_interval = ?,
        file_extensions = ?, codec_filter = ?, preset_id = ?, output_mode = ?, output_dir = ?, output_pattern = ?, min_file_size = ?,
        delete_source = ?, replace_source = ?
      WHERE id = ?
    `).run(path, enabled, recursive, scanInterval, fileExtensions, codecFilter, presetId, outputMode, outputDir, outputPattern, minFileSize, deleteSource, replaceSource, id)

    // Restart the watcher with new settings
    const watcherManager = getWatcherManager()
    watcherManager.restartWatcher(Number(id))

    const updated = db.prepare("SELECT * FROM watched_folders WHERE id = ?").get(id)
    return NextResponse.json(rowToWatcher(updated))
  } catch (error) {
    console.error("PUT /api/watchers/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to update watcher" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const existing = db.prepare("SELECT * FROM watched_folders WHERE id = ?").get(id)

    if (!existing) {
      return NextResponse.json({ error: "Watcher not found" }, { status: 404 })
    }

    // Stop the watcher first
    const watcherManager = getWatcherManager()
    watcherManager.stopWatcher(Number(id))

    db.prepare("DELETE FROM watched_folders WHERE id = ?").run(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/watchers/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to delete watcher" },
      { status: 500 }
    )
  }
}
