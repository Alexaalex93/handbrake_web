import { getDb } from "@/lib/db"
import { probeMediaFile } from "@/lib/media-probe"
import fs from "fs"
import path from "path"

/**
 * After encoding completes, update any library that contains the source file.
 * - replaceSource: source path unchanged (content replaced) → re-probe existing item
 * - deleteSource: source removed, output is new _encoded file → remove old item, add new
 * - keep (neither): source unchanged, output is new file → add output as new item if within library path
 */
export function updateLibraryAfterEncoding(
  sourcePath: string,
  outputPath: string,
  deleteSource: boolean,
  replaceSource: boolean,
): void {
  const db = getDb()

  // Find all libraries that contain the source file
  const libraries = db.prepare("SELECT * FROM libraries").all() as any[]

  for (const lib of libraries) {
    const libPath = lib.path.replace(/\\/g, "/").replace(/\/$/, "")
    const normalizedSource = sourcePath.replace(/\\/g, "/")
    const normalizedOutput = outputPath.replace(/\\/g, "/")

    // Check if the source file belongs to this library
    const sourceInLib = normalizedSource.startsWith(libPath + "/") || normalizedSource === libPath
    if (!sourceInLib) continue

    // Check recursion: if library is not recursive, source must be directly in libPath
    if (!lib.recursive) {
      const relPath = normalizedSource.slice(libPath.length + 1)
      if (relPath.includes("/")) continue // nested file, skip non-recursive library
    }

    console.log(`[library-updater] Updating library "${lib.name}" (id=${lib.id}) after encoding`)

    if (replaceSource) {
      // Source was replaced in-place — re-probe the same file path
      updateExistingItem(db, lib.id, sourcePath)
    } else if (deleteSource) {
      // Source was deleted — remove library item for source
      removeItem(db, lib.id, sourcePath)
      // Add the output file if it's within this library's path
      if (normalizedOutput.startsWith(libPath + "/")) {
        addNewItem(db, lib.id, outputPath)
      }
    } else {
      // Keep both — source is unchanged, add output if within library path
      if (normalizedOutput.startsWith(libPath + "/")) {
        addNewItem(db, lib.id, outputPath)
      }
    }
  }
}

function updateExistingItem(db: ReturnType<typeof getDb>, libraryId: number, filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`[library-updater] File no longer exists: ${filePath}`)
      removeItem(db, libraryId, filePath)
      return
    }

    const stat = fs.statSync(filePath)
    const info = probeMediaFile(filePath)

    db.prepare(`
      UPDATE library_items SET
        file_size = ?, file_mtime = ?, duration = ?, width = ?, height = ?,
        video_codec = ?, video_bitrate = ?, audio_codec = ?, audio_channels = ?,
        audio_bitrate = ?, subtitle_count = ?, container = ?,
        scan_status = 'scanned', scan_error = NULL, updated_at = datetime('now')
      WHERE library_id = ? AND file_path = ?
    `).run(
      stat.size, stat.mtime.toISOString(), info.duration, info.width, info.height,
      info.videoCodec, info.videoBitrate, info.audioCodec, info.audioChannels,
      info.audioBitrate, info.subtitleCount, info.container,
      libraryId, filePath,
    )

    console.log(`[library-updater] Updated item: ${path.basename(filePath)} → ${info.videoCodec}`)
  } catch (err: any) {
    console.error(`[library-updater] Failed to update item ${filePath}: ${err.message}`)
  }
}

function removeItem(db: ReturnType<typeof getDb>, libraryId: number, filePath: string): void {
  try {
    db.prepare("DELETE FROM library_items WHERE library_id = ? AND file_path = ?").run(libraryId, filePath)
    console.log(`[library-updater] Removed item: ${path.basename(filePath)}`)
  } catch (err: any) {
    console.error(`[library-updater] Failed to remove item ${filePath}: ${err.message}`)
  }
}

function addNewItem(db: ReturnType<typeof getDb>, libraryId: number, filePath: string): void {
  try {
    // Check if it already exists
    const existing = db.prepare(
      "SELECT id FROM library_items WHERE library_id = ? AND file_path = ?"
    ).get(libraryId, filePath)

    if (existing) {
      // Already tracked — just re-probe
      updateExistingItem(db, libraryId, filePath)
      return
    }

    if (!fs.existsSync(filePath)) {
      console.log(`[library-updater] Output file doesn't exist yet: ${filePath}`)
      return
    }

    const stat = fs.statSync(filePath)
    const fileName = path.basename(filePath)
    const info = probeMediaFile(filePath)

    db.prepare(`
      INSERT INTO library_items (
        library_id, file_path, file_name, file_size, file_mtime,
        duration, width, height, video_codec, video_bitrate,
        audio_codec, audio_channels, audio_bitrate, subtitle_count, container,
        scan_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scanned')
    `).run(
      libraryId, filePath, fileName, stat.size, stat.mtime.toISOString(),
      info.duration, info.width, info.height, info.videoCodec, info.videoBitrate,
      info.audioCodec, info.audioChannels, info.audioBitrate, info.subtitleCount, info.container,
    )

    console.log(`[library-updater] Added new item: ${fileName} → ${info.videoCodec}`)
  } catch (err: any) {
    console.error(`[library-updater] Failed to add item ${filePath}: ${err.message}`)
  }
}
