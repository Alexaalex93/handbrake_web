"use client"

import { useState, useEffect } from "react"
import {
  X,
  Folder,
  File,
  ChevronRight,
  Loader2,
  ArrowUp,
  HardDrive,
} from "lucide-react"

interface FileEntry {
  name: string
  path: string
  type: "file" | "directory"
  size?: number
  modified?: string
}

interface FileBrowserProps {
  onSelect: (path: string) => void
  onClose: () => void
  directoryOnly?: boolean
}

// Check if a path looks like a Windows drive root (e.g. "C:\")
function isDriveRoot(p: string): boolean {
  return /^[A-Za-z]:[/\\]?$/.test(p)
}

// Get parent of a path, handling both Unix and Windows
function getParentPath(p: string): string {
  // If at root "/" or a drive root "C:\", go to drive list
  if (p === "/" || p === "\\" || isDriveRoot(p)) {
    return "/"
  }
  // Normalize to forward slashes for splitting
  const normalized = p.replace(/\\/g, "/").replace(/\/+$/, "")
  const parts = normalized.split("/").filter(Boolean)
  if (parts.length <= 1) {
    // e.g. "C:" → go to root (drive list)
    return "/"
  }
  parts.pop()
  const parent = parts.join("/")
  // If parent is just "C:", make it "C:/"
  if (/^[A-Za-z]:$/.test(parent)) {
    return parent + "/"
  }
  // If it started with "/" (Unix), keep the leading /
  if (normalized.startsWith("/")) {
    return "/" + parent
  }
  return parent
}

// Split a path into breadcrumb parts
function getBreadcrumbs(p: string): { label: string; path: string }[] {
  if (p === "/" || p === "\\") return []
  const normalized = p.replace(/\\/g, "/").replace(/\/+$/, "")
  const parts = normalized.split("/").filter(Boolean)
  const crumbs: { label: string; path: string }[] = []
  for (let i = 0; i < parts.length; i++) {
    const segment = parts.slice(0, i + 1).join("/")
    // For Windows drive like "C:", make path "C:/"
    const crumbPath = /^[A-Za-z]:$/.test(segment) ? segment + "/" :
      (normalized.startsWith("/") ? "/" + segment : segment)
    crumbs.push({ label: parts[i], path: crumbPath })
  }
  return crumbs
}

export function FileBrowser({ onSelect, onClose, directoryOnly = false }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState("/")
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [pathInput, setPathInput] = useState("/")

  useEffect(() => {
    loadDirectory(currentPath)
  }, [currentPath])

  const loadDirectory = async (dirPath: string) => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to load directory")
        setEntries([])
      } else if (Array.isArray(data)) {
        setEntries(data)
      } else {
        setEntries([])
      }
      setPathInput(dirPath)
    } catch {
      setError("Failed to load directory")
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  const isAtRoot = currentPath === "/" || currentPath === "\\"
  const breadcrumbs = getBreadcrumbs(currentPath)

  const goUp = () => {
    setCurrentPath(getParentPath(currentPath))
  }

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPath(pathInput)
  }

  const isDir = (entry: FileEntry) => entry.type === "directory"
  const isDrive = (entry: FileEntry) => isDriveRoot(entry.path)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-xl flex-col rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
          <h3 className="text-sm font-semibold text-[hsl(var(--card-foreground))]">
            {directoryOnly ? "Select Directory" : "Select File"}
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Path input */}
        <form onSubmit={handlePathSubmit} className="border-b border-[hsl(var(--border))] px-4 py-2">
          <input
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
            placeholder="Type path... (e.g. C:\Users or /home)"
          />
        </form>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] px-4 py-2 text-xs">
          <button
            onClick={goUp}
            disabled={isAtRoot}
            className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] disabled:opacity-30"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            onClick={() => setCurrentPath("/")}
            className={`hover:underline ${isAtRoot ? "text-[hsl(var(--card-foreground))] font-semibold" : "text-[hsl(var(--primary))]"}`}
          >
            {isAtRoot ? "Drives" : "/"}
          </button>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
              <button
                onClick={() => setCurrentPath(crumb.path)}
                className={`hover:underline ${
                  i === breadcrumbs.length - 1
                    ? "text-[hsl(var(--card-foreground))] font-semibold"
                    : "text-[hsl(var(--primary))]"
                }`}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>

        {/* File list */}
        <div className="min-h-[200px] flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--destructive))]">
              {error}
            </p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              Empty directory
            </p>
          ) : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => {
                    if (isDir(entry)) {
                      setCurrentPath(entry.path)
                    } else if (!directoryOnly) {
                      onSelect(entry.path)
                    }
                  }}
                  onDoubleClick={() => {
                    if (isDir(entry) && directoryOnly) {
                      onSelect(entry.path)
                    }
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-[hsl(var(--accent))] ${
                    !isDir(entry) && directoryOnly
                      ? "opacity-50 cursor-default"
                      : ""
                  }`}
                >
                  {isDrive(entry) ? (
                    <HardDrive className="h-4 w-4 shrink-0 text-blue-400" />
                  ) : isDir(entry) ? (
                    <Folder className="h-4 w-4 shrink-0 text-yellow-500" />
                  ) : (
                    <File className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                  )}
                  <span className="flex-1 truncate text-[hsl(var(--card-foreground))]">
                    {entry.name}
                  </span>
                  {entry.size != null && !isDir(entry) && (
                    <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                      {(entry.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {directoryOnly && (
          <div className="flex justify-end border-t border-[hsl(var(--border))] px-4 py-3">
            <button
              onClick={() => onSelect(currentPath)}
              disabled={isAtRoot}
              className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
            >
              Select This Directory
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
