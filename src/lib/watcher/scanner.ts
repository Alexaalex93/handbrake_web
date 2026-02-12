import fs from "fs"
import path from "path"

export interface ScanFileResult {
  filePath: string
  fileSize: number
  fileMtime: string
}

export function scanDirectory(
  dirPath: string,
  extensions: string[],
  recursive: boolean,
  minFileSize: number
): ScanFileResult[] {
  const results: ScanFileResult[] = []

  function walk(dir: string) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory() && recursive) {
        walk(fullPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (!extensions.includes(ext)) continue

        try {
          const stat = fs.statSync(fullPath)
          if (stat.size < minFileSize) continue

          results.push({
            filePath: fullPath,
            fileSize: stat.size,
            fileMtime: stat.mtime.toISOString(),
          })
        } catch {
          // Skip files we can't stat
        }
      }
    }
  }

  walk(dirPath)
  return results
}
