import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import fs from "fs"
import path from "path"
import { probeMediaFile } from "@/lib/media-probe"

function scanDirectory(
  dirPath: string,
  recursive: boolean,
  extensions: string[]
): { filePath: string; fileSize: number; mtime: string }[] {
  const results: { filePath: string; fileSize: number; mtime: string }[] = []

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue

      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory() && recursive) {
        try {
          results.push(...scanDirectory(fullPath, recursive, extensions))
        } catch {
          // Permission denied or other error, skip
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (extensions.includes(ext)) {
          try {
            const stat = fs.statSync(fullPath)
            results.push({
              filePath: fullPath,
              fileSize: stat.size,
              mtime: stat.mtime.toISOString(),
            })
          } catch {
            // Skip files we can't stat
          }
        }
      }
    }
  } catch {
    // Permission denied or path doesn't exist
  }

  return results
}

export async function POST(
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

    // Parse body for options
    let probeMedia = false
    try {
      const body = await _request.json()
      probeMedia = body.probe === true
    } catch {
      // No body, just do file scan
    }

    // Scan filesystem for media files
    const extensions = lib.file_extensions.split(",").map((e: string) => e.trim().toLowerCase())
    const files = scanDirectory(lib.path, !!lib.recursive, extensions)

    // Get existing items for this library
    const existingItems = db.prepare(
      "SELECT file_path, file_size, file_mtime FROM library_items WHERE library_id = ?"
    ).all(Number(id)) as any[]
    const existingMap = new Map(existingItems.map((i: any) => [i.file_path, i]))

    // Insert new files, update changed ones
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO library_items (library_id, file_path, file_name, file_size, file_mtime, container, scan_status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `)

    const updateStmt = db.prepare(`
      UPDATE library_items SET file_size = ?, file_mtime = ?, updated_at = datetime('now'), scan_status = 'pending'
      WHERE library_id = ? AND file_path = ?
    `)

    let newCount = 0
    let updatedCount = 0

    const insertMany = db.transaction(() => {
      for (const file of files) {
        const existing = existingMap.get(file.filePath)
        const ext = path.extname(file.filePath).toLowerCase().replace(".", "")

        if (!existing) {
          insertStmt.run(Number(id), file.filePath, path.basename(file.filePath), file.fileSize, file.mtime, ext)
          newCount++
        } else if (existing.file_size !== file.fileSize || existing.file_mtime !== file.mtime) {
          updateStmt.run(file.fileSize, file.mtime, Number(id), file.filePath)
          updatedCount++
        }
      }
    })
    insertMany()

    // Remove items that no longer exist on disk
    const currentPaths = new Set(files.map(f => f.filePath))
    const removeStmt = db.prepare("DELETE FROM library_items WHERE library_id = ? AND file_path = ?")
    let removedCount = 0
    for (const existing of existingItems) {
      if (!currentPaths.has(existing.file_path)) {
        removeStmt.run(Number(id), existing.file_path)
        removedCount++
      }
    }

    // Probe media info for pending items (if requested)
    let probedCount = 0
    if (probeMedia) {
      const pendingItems = db.prepare(
        "SELECT id, file_path FROM library_items WHERE library_id = ? AND scan_status = 'pending' LIMIT 200"
      ).all(Number(id)) as any[]

      const probeStmt = db.prepare(`
        UPDATE library_items SET
          duration = ?, width = ?, height = ?, video_codec = ?, video_bitrate = ?,
          audio_codec = ?, audio_channels = ?, audio_bitrate = ?, subtitle_count = ?,
          container = ?, scan_status = 'scanned', scan_error = NULL, updated_at = datetime('now')
        WHERE id = ?
      `)
      const errorStmt = db.prepare(
        "UPDATE library_items SET scan_status = 'error', scan_error = ?, updated_at = datetime('now') WHERE id = ?"
      )

      for (const item of pendingItems) {
        try {
          const info = probeMediaFile(item.file_path)
          probeStmt.run(
            info.duration, info.width, info.height, info.videoCodec, info.videoBitrate,
            info.audioCodec, info.audioChannels, info.audioBitrate, info.subtitleCount,
            info.container, item.id
          )
          probedCount++
        } catch (err: any) {
          errorStmt.run(err?.message || "Probe failed", item.id)
        }
      }
    }

    // Update last scan timestamp
    db.prepare("UPDATE libraries SET last_scan_at = datetime('now') WHERE id = ?").run(Number(id))

    return NextResponse.json({
      success: true,
      totalFiles: files.length,
      newFiles: newCount,
      updatedFiles: updatedCount,
      removedFiles: removedCount,
      probedFiles: probedCount,
    })
  } catch (error) {
    console.error("POST /api/libraries/[id]/scan error:", error)
    return NextResponse.json({ error: "Failed to scan library" }, { status: 500 })
  }
}
