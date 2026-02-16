"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import {
  Plus,
  Library,
  Loader2,
  Trash2,
  X,
  Film,
  FolderOpen,
} from "lucide-react"
import { FileBrowser } from "@/components/shared/file-browser"
import type { Library as LibraryType } from "@/types/library"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ─── Add Library Dialog ────────────────────────────────────────────────────
function AddLibraryDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("")
  const [path, setPath] = useState("")
  const [recursive, setRecursive] = useState(true)
  const [fileExtensions, setFileExtensions] = useState(".mkv,.mp4,.avi,.mov,.wmv,.flv,.ts,.m4v,.webm")
  const [showBrowser, setShowBrowser] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return }
    if (!path.trim()) { setError("Path is required"); return }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), path: path.trim(), recursive, fileExtensions }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to create library")
        return
      }
      onCreated()
    } catch {
      setError("Failed to create library")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mx-4 w-full max-w-lg rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <h2 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">Add Library</h2>
          <button onClick={onClose} className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Movies, TV Shows"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="Z:\media\movies"
                className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
              <button
                onClick={() => setShowBrowser(true)}
                className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90"
              >
                Browse
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
              <input
                type="checkbox"
                checked={recursive}
                onChange={(e) => setRecursive(e.target.checked)}
                className="rounded border-[hsl(var(--border))]"
              />
              Scan subdirectories
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">File Extensions</label>
            <input
              type="text"
              value={fileExtensions}
              onChange={(e) => setFileExtensions(e.target.value)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
            />
          </div>

          {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[hsl(var(--border))] px-6 py-4">
          <button onClick={onClose} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-4 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </button>
        </div>
      </div>

      {showBrowser && (
        <FileBrowser
          directoryOnly
          onSelect={(p) => { setPath(p); setShowBrowser(false) }}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </div>
  )
}

// ─── Main Libraries Page ────────────────────────────────────────────────────
export default function LibrariesPage() {
  const { data, isLoading, mutate } = useSWR<LibraryType[]>("/api/libraries", fetcher)
  const [showAdd, setShowAdd] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const libraries = Array.isArray(data) ? data : []

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await fetch(`/api/libraries/${id}`, { method: "DELETE" })
      mutate()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Libraries</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Library
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : libraries.length === 0 ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
          <Library className="mx-auto mb-4 h-12 w-12 text-[hsl(var(--muted-foreground))]" />
          <p className="text-[hsl(var(--muted-foreground))]">
            No libraries configured. Add a folder to scan your media collection.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {libraries.map((lib) => (
            <div
              key={lib.id}
              className="group rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition-colors hover:border-[hsl(var(--primary))]/50"
            >
              <div className="flex items-start justify-between">
                <Link
                  href={`/libraries/${lib.id}`}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FolderOpen className="h-5 w-5 text-[hsl(var(--primary))]" />
                    <h3 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
                      {lib.name}
                    </h3>
                  </div>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] truncate mb-3" title={lib.path}>
                    {lib.path}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                    <span className="flex items-center gap-1">
                      <Film className="h-3.5 w-3.5" />
                      {lib.itemCount ?? 0} items
                    </span>
                    {lib.lastScanAt && (
                      <span>
                        Scanned {new Date(lib.lastScanAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(lib.id)}
                  disabled={deletingId === lib.id}
                  className="rounded p-1.5 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--destructive))] transition-opacity"
                >
                  {deletingId === lib.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddLibraryDialog
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); mutate() }}
        />
      )}
    </div>
  )
}
