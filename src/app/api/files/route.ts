import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { execSync } from "child_process"

interface FileEntry {
  name: string
  path: string
  type: "file" | "directory"
  size?: number
  modified?: string
}

function getWindowsDrives(): FileEntry[] {
  try {
    // Use wmic to list drives on Windows
    const output = execSync("wmic logicaldisk get name", {
      encoding: "utf-8",
      timeout: 5000,
    })
    const drives: FileEntry[] = []
    for (const line of output.split("\n")) {
      const drive = line.trim()
      if (/^[A-Z]:$/i.test(drive)) {
        drives.push({
          name: drive + "\\",
          path: drive + "\\",
          type: "directory",
        })
      }
    }
    return drives
  } catch {
    // Fallback: try common drive letters
    const drives: FileEntry[] = []
    for (const letter of "CDEFGHIJKLMNOPQRSTUVWXYZ") {
      const drivePath = `${letter}:\\`
      try {
        fs.accessSync(drivePath)
        drives.push({
          name: drivePath,
          path: drivePath,
          type: "directory",
        })
      } catch {
        // Drive doesn't exist
      }
    }
    return drives
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dirPath = searchParams.get("path")

    if (!dirPath) {
      return NextResponse.json(
        { error: "path query parameter is required" },
        { status: 400 }
      )
    }

    const isWindows = process.platform === "win32"

    // Handle root path on Windows: list available drives
    if (isWindows && (dirPath === "/" || dirPath === "\\")) {
      const drives = getWindowsDrives()
      return NextResponse.json(drives)
    }

    // Resolve to absolute path to prevent traversal issues
    const resolvedPath = path.resolve(dirPath)

    // Check the path exists and is a directory
    let stat: fs.Stats
    try {
      stat = fs.statSync(resolvedPath)
    } catch {
      return NextResponse.json(
        { error: "Path does not exist" },
        { status: 404 }
      )
    }

    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "Path is not a directory" },
        { status: 400 }
      )
    }

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true })
    const items: FileEntry[] = []

    for (const entry of entries) {
      // Skip hidden files/directories (starting with .)
      if (entry.name.startsWith(".")) continue

      const fullPath = path.join(resolvedPath, entry.name)
      const item: FileEntry = {
        name: entry.name,
        path: fullPath,
        type: entry.isDirectory() ? "directory" : "file",
      }

      if (entry.isFile()) {
        try {
          const fileStat = fs.statSync(fullPath)
          item.size = fileStat.size
          item.modified = fileStat.mtime.toISOString()
        } catch {
          // Skip files we can't stat
        }
      }

      items.push(item)
    }

    // Sort: directories first, then files, both alphabetically
    items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error("GET /api/files error:", error)
    return NextResponse.json(
      { error: "Failed to list directory" },
      { status: 500 }
    )
  }
}
