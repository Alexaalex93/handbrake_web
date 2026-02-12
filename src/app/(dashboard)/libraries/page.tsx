"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import {
  Plus,
  Library,
  Loader2,
  Trash2,
  RefreshCw,
  X,
  Search,
  Film,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Scan,
  Filter,
} from "lucide-react"
import { FileBrowser } from "@/components/shared/file-browser"
import type { Library as LibraryType, LibraryItem } from "@/types/library"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatResolution(w: number | null, h: number | null): string {
  if (!w || !h) return "-"
  if (h >= 2160) return "4K"
  if (h >= 1080) return "1080p"
  if (h >= 720) return "720p"
  if (h >= 480) return "480p"
  return `${w}x${h}`
}

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

// ─── Library Detail View ────────────────────────────────────────────────────
function LibraryDetail({ libraryId, onBack }: { libraryId: number; onBack: () => void }) {
  const [codecFilter, setCodecFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const limit = 50

  const queryParams = new URLSearchParams({ page: page.toString(), limit: limit.toString() })
  if (codecFilter !== "all") queryParams.set("codec", codecFilter)
  if (searchTerm) queryParams.set("search", searchTerm)

  const { data, isLoading, mutate } = useSWR(
    `/api/libraries/${libraryId}?${queryParams.toString()}`,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )

  const library = data?.library
  const items: LibraryItem[] = data?.items ?? []
  const total = data?.total ?? 0
  const codecs: { codec: string; count: number }[] = data?.codecs ?? []
  const totalPages = Math.ceil(total / limit)

  const handleScan = async (probe: boolean) => {
    setScanning(true)
    setScanResult(null)
    try {
      const res = await fetch(`/api/libraries/${libraryId}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ probe }),
      })
      const result = await res.json()
      setScanResult(result)
      mutate()
    } catch {
      setScanResult({ error: "Scan failed" })
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{library?.name ?? "Library"}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{library?.path}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleScan(false)}
            disabled={scanning}
            className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90 disabled:opacity-50"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Scan Files
          </button>
          <button
            onClick={() => handleScan(true)}
            disabled={scanning}
            className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
            Scan + Probe
          </button>
        </div>
      </div>

      {/* Scan result */}
      {scanResult && (
        <div className={`rounded-md p-3 text-sm ${scanResult.error
          ? "border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]"
          : "border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
        }`}>
          {scanResult.error
            ? scanResult.error
            : `Found ${scanResult.totalFiles} files. New: ${scanResult.newFiles}, Updated: ${scanResult.updatedFiles}, Removed: ${scanResult.removedFiles}${scanResult.probedFiles > 0 ? `, Probed: ${scanResult.probedFiles}` : ""}`
          }
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <select
            value={codecFilter}
            onChange={(e) => { setCodecFilter(e.target.value); setPage(1) }}
            className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))]"
          >
            <option value="all">All Codecs ({total})</option>
            {codecs.map((c) => (
              <option key={c.codec} value={c.codec}>
                {c.codec} ({c.count})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 items-center gap-2">
          <Search className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
            placeholder="Search by filename..."
            className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
          />
        </div>
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {total} items
        </span>
      </div>

      {/* Codec chips */}
      {codecs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {codecs.map((c) => (
            <button
              key={c.codec}
              onClick={() => { setCodecFilter(codecFilter === c.codec ? "all" : c.codec); setPage(1) }}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                codecFilter === c.codec
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:opacity-80"
              }`}
            >
              {c.codec} <span className="opacity-70">({c.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Items table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
          <p className="text-[hsl(var(--muted-foreground))]">
            {total === 0 ? 'No items found. Click "Scan Files" to discover media files.' : "No items match the current filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Name</th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Video</th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Resolution</th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Audio</th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Duration</th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Size</th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Subs</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--accent))]/50"
                >
                  <td className="max-w-[300px] truncate px-4 py-3 font-medium text-[hsl(var(--card-foreground))]" title={item.filePath}>
                    {item.fileName}
                  </td>
                  <td className="px-4 py-3">
                    {item.videoCodec ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.videoCodec === "H.265" ? "bg-green-500/20 text-green-400" :
                        item.videoCodec === "AV1" ? "bg-blue-500/20 text-blue-400" :
                        item.videoCodec === "H.264" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-gray-500/20 text-gray-400"
                      }`}>
                        {item.videoCodec}
                      </span>
                    ) : (
                      <span className="text-[hsl(var(--muted-foreground))]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {formatResolution(item.width, item.height)}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {item.audioCodec ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {formatDuration(item.duration)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[hsl(var(--muted-foreground))]">
                    {formatSize(item.fileSize)}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {item.subtitleCount > 0 ? item.subtitleCount : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="rounded p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Libraries Page ────────────────────────────────────────────────────
export default function LibrariesPage() {
  const { data, isLoading, mutate } = useSWR<LibraryType[]>(
    "/api/libraries",
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )
  const [showAdd, setShowAdd] = useState(false)
  const [selectedLibrary, setSelectedLibrary] = useState<number | null>(null)
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

  // Show library detail view
  if (selectedLibrary !== null) {
    return (
      <LibraryDetail
        libraryId={selectedLibrary}
        onBack={() => setSelectedLibrary(null)}
      />
    )
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
                <button
                  onClick={() => setSelectedLibrary(lib.id)}
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
                </button>
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
