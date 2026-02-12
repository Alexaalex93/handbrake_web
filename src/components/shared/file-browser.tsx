"use client"

import { useState, useEffect } from "react"
import {
  X,
  Folder,
  File,
  ChevronRight,
  Loader2,
  ArrowUp,
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

export function FileBrowser({ onSelect, onClose, directoryOnly = false }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState("/")
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [pathInput, setPathInput] = useState("/")

  useEffect(() => {
    loadDirectory(currentPath)
  }, [currentPath])

  const loadDirectory = async (path: string) => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to load directory")
        setEntries([])
      } else if (Array.isArray(data)) {
        setEntries(data)
      } else {
        setEntries([])
      }
      setPathInput(path)
    } catch {
      setError("Failed to load directory")
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  const breadcrumbs = currentPath.split("/").filter(Boolean)

  const goUp = () => {
    const parts = currentPath.split("/").filter(Boolean)
    parts.pop()
    setCurrentPath("/" + parts.join("/"))
  }

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPath(pathInput)
  }

  const isDir = (entry: FileEntry) => entry.type === "directory"

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
            placeholder="Type path..."
          />
        </form>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] px-4 py-2 text-xs">
          <button
            onClick={goUp}
            className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            onClick={() => setCurrentPath("/")}
            className="text-[hsl(var(--primary))] hover:underline"
          >
            /
          </button>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
              <button
                onClick={() =>
                  setCurrentPath("/" + breadcrumbs.slice(0, i + 1).join("/"))
                }
                className="text-[hsl(var(--primary))] hover:underline"
              >
                {crumb}
              </button>
            </span>
          ))}
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
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
                  {isDir(entry) ? (
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
              className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
            >
              Select This Directory
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
