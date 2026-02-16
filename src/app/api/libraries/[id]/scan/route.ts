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

// ─── Background scan tracking ──────────────────────────────────────────────
interface ScanProgress {
  status: "scanning" | "probing" | "done" | "error"
  totalFiles: number
  newFiles: number
  updatedFiles: number
  removedFiles: number
  probedFiles: number
  probedTotal: number
  probeErrors: number
  currentFile: string | null
  error?: string
}

// In-memory progress store per library
const scanProgress = new Map<number, ScanProgress>()

export function getScanProgress(libraryId: number): ScanProgress | null {
  return scanProgress.get(libraryId) ?? null
}

async function runProbeInBackground(libraryId: number) {
  const progress = scanProgress.get(libraryId)
  if (!progress) return

  const db = getDb()
  const pendingItems = db.prepare(
    "SELECT id, file_path FROM library_items WHERE library_id = ? AND scan_status = 'pending'"
  ).all(libraryId) as any[]

  progress.probedTotal = pendingItems.length
  progress.status = "probing"

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

  // Process in batches of 10 inside a transaction for better perf, but commit between batches
  const BATCH_SIZE = 10
  for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
    const batch = pendingItems.slice(i, i + BATCH_SIZE)

    for (const item of batch) {
      progress.currentFile = path.basename(item.file_path)
      try {
        const info = probeMediaFile(item.file_path)
        probeStmt.run(
          info.duration, info.width, info.height, info.videoCodec, info.videoBitrate,
          info.audioCodec, info.audioChannels, info.audioBitrate, info.subtitleCount,
          info.container, item.id
        )
        progress.probedFiles++
      } catch (err: any) {
        errorStmt.run(err?.message || "Probe failed", item.id)
        progress.probeErrors++
      }
    }

    // Yield to event loop between batches so progress requests can be served
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  progress.status = "done"
  progress.currentFile = null

  // Update last scan timestamp
  db.prepare("UPDATE libraries SET last_scan_at = datetime('now') WHERE id = ?").run(libraryId)
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const libraryId = Number(id)
    const db = getDb()
    const lib = db.prepare("SELECT * FROM libraries WHERE id = ?").get(libraryId) as any

    if (!lib) {
      return NextResponse.json({ error: "Library not found" }, { status: 404 })
    }

    // Check if scan is already running
    const existing = scanProgress.get(libraryId)
    if (existing && (existing.status === "scanning" || existing.status === "probing")) {
      return NextResponse.json({ error: "Scan already in progress", progress: existing }, { status: 409 })
    }

    // Parse body for options
    let probeMedia = false
    let forceRescan = false
    try {
      const body = await _request.json()
      probeMedia = body.probe === true
      forceRescan = body.forceRescan === true
    } catch {
      // No body, just do file scan
    }

    // Initialize progress
    const progress: ScanProgress = {
      status: "scanning",
      totalFiles: 0,
      newFiles: 0,
      updatedFiles: 0,
      removedFiles: 0,
      probedFiles: 0,
      probedTotal: 0,
      probeErrors: 0,
      currentFile: null,
    }
    scanProgress.set(libraryId, progress)

    // Scan filesystem for media files
    const extensions = lib.file_extensions.split(",").map((e: string) => e.trim().toLowerCase())
    const files = scanDirectory(lib.path, !!lib.recursive, extensions)
    progress.totalFiles = files.length

    // Get existing items for this library
    const existingItems = db.prepare(
      "SELECT file_path, file_size, file_mtime FROM library_items WHERE library_id = ?"
    ).all(libraryId) as any[]
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

    const insertMany = db.transaction(() => {
      for (const file of files) {
        const existing = existingMap.get(file.filePath)
        const ext = path.extname(file.filePath).toLowerCase().replace(".", "")

        if (!existing) {
          insertStmt.run(libraryId, file.filePath, path.basename(file.filePath), file.fileSize, file.mtime, ext)
          progress.newFiles++
        } else if (existing.file_size !== file.fileSize || existing.file_mtime !== file.mtime) {
          updateStmt.run(file.fileSize, file.mtime, libraryId, file.filePath)
          progress.updatedFiles++
        }
      }
    })
    insertMany()

    // Remove items that no longer exist on disk
    const currentPaths = new Set(files.map(f => f.filePath))
    const removeStmt = db.prepare("DELETE FROM library_items WHERE library_id = ? AND file_path = ?")
    for (const existing of existingItems) {
      if (!currentPaths.has(existing.file_path)) {
        removeStmt.run(libraryId, existing.file_path)
        progress.removedFiles++
      }
    }

    // If force rescan, reset all existing items to pending
    if (forceRescan && probeMedia) {
      db.prepare(
        "UPDATE library_items SET scan_status = 'pending', scan_error = NULL WHERE library_id = ? AND scan_status != 'pending'"
      ).run(libraryId)
    }

    // If probe requested, start background probing (non-blocking)
    if (probeMedia) {
      // Count how many files actually need probing (pending status)
      const pendingRow = db.prepare(
        "SELECT COUNT(*) as count FROM library_items WHERE library_id = ? AND scan_status = 'pending'"
      ).get(libraryId) as any
      const pendingCount = pendingRow?.count ?? 0

      // Don't await — let it run in background
      runProbeInBackground(libraryId).catch((err) => {
        const p = scanProgress.get(libraryId)
        if (p) {
          p.status = "error"
          p.error = err?.message || "Background probe failed"
        }
      })

      return NextResponse.json({
        success: true,
        background: true,
        totalFiles: files.length,
        newFiles: progress.newFiles,
        updatedFiles: progress.updatedFiles,
        removedFiles: progress.removedFiles,
        pendingCount,
      })
    }

    // No probe — just finish
    progress.status = "done"
    db.prepare("UPDATE libraries SET last_scan_at = datetime('now') WHERE id = ?").run(libraryId)

    return NextResponse.json({
      success: true,
      totalFiles: files.length,
      newFiles: progress.newFiles,
      updatedFiles: progress.updatedFiles,
      removedFiles: progress.removedFiles,
      probedFiles: 0,
    })
  } catch (error) {
    console.error("POST /api/libraries/[id]/scan error:", error)
    return NextResponse.json({ error: "Failed to scan library" }, { status: 500 })
  }
}
