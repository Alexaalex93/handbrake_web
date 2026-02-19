"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Plus,
  FolderSearch,
  Loader2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Library,
  X,
} from "lucide-react"
import { FileBrowser } from "@/components/shared/file-browser"
import type { WatchedFolder } from "@/types/watcher"
import type { Preset } from "@/types/preset"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function AddWatcherDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [path, setPath] = useState("")
  const [recursive, setRecursive] = useState(true)
  const [scanInterval, setScanInterval] = useState(60)
  const [fileExtensions, setFileExtensions] = useState(".mkv,.mp4,.avi,.mov,.wmv,.flv,.ts,.m4v,.webm")
  const [outputMode, setOutputMode] = useState<"fixed" | "beside_source">("beside_source")
  const [outputDir, setOutputDir] = useState("")
  const [outputPattern, setOutputPattern] = useState("{name}_encoded.{ext}")
  const [presetId, setPresetId] = useState<number | null>(null)
  const [codecFilter, setCodecFilter] = useState<string[]>([])
  const [deleteSource, setDeleteSource] = useState(false)
  const [replaceSource, setReplaceSource] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showBrowser, setShowBrowser] = useState(false)
  const [showOutputBrowser, setShowOutputBrowser] = useState(false)

  const { data: presetsData } = useSWR<Preset[]>("/api/presets", fetcher)
  const presets = Array.isArray(presetsData) ? presetsData : []

  const handleSave = async () => {
    if (!path.trim()) {
      setError("Path is required")
      return
    }
    if (outputMode === "fixed" && !outputDir.trim()) {
      setError("Output directory is required when using fixed output")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/watchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: path.trim(),
          recursive,
          scanInterval,
          fileExtensions,
          outputMode,
          outputDir: outputMode === "fixed" ? outputDir : null,
          outputPattern,
          presetId,
          codecFilter: codecFilter.join(","),
          deleteSource,
          replaceSource,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to create watcher")
        return
      }
      onCreated()
    } catch {
      setError("Failed to create watcher")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mx-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <h2 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">Add Watcher</h2>
          <button onClick={onClose} className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Watch Path</label>
            <div className="flex gap-2">
              <input type="text" value={path} onChange={(e) => setPath(e.target.value)}
                placeholder="/media/movies"
                className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]" />
              <button onClick={() => setShowBrowser(true)}
                className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90">
                Browse
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Scan Interval (min)</label>
              <input type="number" value={scanInterval} onChange={(e) => setScanInterval(Number(e.target.value))} min={1}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
                <input type="checkbox" checked={recursive} onChange={(e) => setRecursive(e.target.checked)}
                  className="accent-[hsl(var(--primary))]" />
                Recursive scan
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">File Extensions</label>
            <input type="text" value={fileExtensions} onChange={(e) => setFileExtensions(e.target.value)}
              placeholder=".mkv,.mp4,.avi"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Codec Filter</label>
            <p className="mb-2 text-xs text-[hsl(var(--muted-foreground))]">
              Only pick up files with these video codecs. Leave unchecked for all.
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {["H.264", "H.265", "AV1", "VP9", "VP8", "MPEG-2", "MPEG-4", "VC-1"].map((codec) => (
                <label key={codec} className="flex items-center gap-1.5 text-sm text-[hsl(var(--card-foreground))]">
                  <input
                    type="checkbox"
                    checked={codecFilter.includes(codec)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCodecFilter([...codecFilter, codec])
                      } else {
                        setCodecFilter(codecFilter.filter((c) => c !== codec))
                      }
                    }}
                    className="accent-[hsl(var(--primary))]"
                  />
                  {codec}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Preset</label>
            <select value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]">
              <option value="">Default settings</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[hsl(var(--card-foreground))]">After Encoding</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
                <input type="radio" name="watcherPostAction" value="keep"
                  checked={!deleteSource && !replaceSource}
                  onChange={() => { setDeleteSource(false); setReplaceSource(false) }}
                  className="accent-[hsl(var(--primary))]" />
                Keep original
              </label>
              <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
                <input type="radio" name="watcherPostAction" value="delete"
                  checked={deleteSource && !replaceSource}
                  onChange={() => { setDeleteSource(true); setReplaceSource(false) }}
                  className="accent-[hsl(var(--primary))]" />
                Delete original
              </label>
              <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
                <input type="radio" name="watcherPostAction" value="replace"
                  checked={replaceSource}
                  onChange={() => { setDeleteSource(false); setReplaceSource(true) }}
                  className="accent-[hsl(var(--primary))]" />
                Replace original
              </label>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[hsl(var(--card-foreground))]">Output Location</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
                <input type="radio" name="watcherOutput" value="beside_source" checked={outputMode === "beside_source"}
                  onChange={() => setOutputMode("beside_source")} className="accent-[hsl(var(--primary))]" />
                Beside Source
              </label>
              <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
                <input type="radio" name="watcherOutput" value="fixed" checked={outputMode === "fixed"}
                  onChange={() => setOutputMode("fixed")} className="accent-[hsl(var(--primary))]" />
                Fixed Directory
              </label>
            </div>
          </div>

          {outputMode === "fixed" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Output Directory</label>
              <div className="flex gap-2">
                <input type="text" value={outputDir} onChange={(e) => setOutputDir(e.target.value)}
                  placeholder="/media/output"
                  className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]" />
                <button onClick={() => setShowOutputBrowser(true)}
                  className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90">
                  Browse
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Output Pattern</label>
            <input type="text" value={outputPattern} onChange={(e) => setOutputPattern(e.target.value)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]" />
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              Tokens: {"{name}"}, {"{ext}"}, {"{date}"}, {"{encoder}"}, {"{quality}"}
            </p>
          </div>

          {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[hsl(var(--border))] px-6 py-4">
          <button onClick={onClose}
            className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-4 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </button>
        </div>

        {showBrowser && (
          <FileBrowser directoryOnly onSelect={(p) => { setPath(p); setShowBrowser(false) }} onClose={() => setShowBrowser(false)} />
        )}
        {showOutputBrowser && (
          <FileBrowser directoryOnly onSelect={(p) => { setOutputDir(p); setShowOutputBrowser(false) }} onClose={() => setShowOutputBrowser(false)} />
        )}
      </div>
    </div>
  )
}

export default function WatchersPage() {
  const { data, isLoading, mutate } = useSWR<WatchedFolder[]>(
    "/api/watchers",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )
  const [scanningId, setScanningId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [creatingLibId, setCreatingLibId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const watchers = Array.isArray(data) ? data : []

  const handleToggle = async (id: number, enabled: boolean) => {
    await fetch(`/api/watchers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    })
    mutate()
  }

  const handleScanNow = async (id: number) => {
    setScanningId(id)
    try {
      await fetch(`/api/watchers/${id}/scan`, { method: "POST" })
      mutate()
    } finally {
      setScanningId(null)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await fetch(`/api/watchers/${id}`, { method: "DELETE" })
      mutate()
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreateLibrary = async (watcher: WatchedFolder) => {
    setCreatingLibId(watcher.id)
    try {
      const pathParts = watcher.path.replace(/[\\/]+$/, "").split(/[\\/]/)
      const name = pathParts[pathParts.length - 1] || watcher.path
      const res = await fetch("/api/libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          path: watcher.path,
          recursive: watcher.recursive,
          fileExtensions: watcher.fileExtensions,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Failed to create library")
      }
    } catch {
      alert("Failed to create library")
    } finally {
      setCreatingLibId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Folder Watchers</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Watcher
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : watchers.length === 0 ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
          <FolderSearch className="mx-auto mb-4 h-12 w-12 text-[hsl(var(--muted-foreground))]" />
          <p className="text-[hsl(var(--muted-foreground))]">
            No folder watchers configured. Add one to automatically queue files for encoding.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {watchers.map((watcher) => (
            <div
              key={watcher.id}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[hsl(var(--card-foreground))]">
                    {watcher.path}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Scan every {watcher.scanInterval} minutes
                    {watcher.recursive ? " (recursive)" : ""}
                  </p>
                </div>
                <div className="ml-2 flex items-center gap-1">
                  <button
                    onClick={() => handleCreateLibrary(watcher)}
                    disabled={creatingLibId === watcher.id}
                    title="Add as Library"
                    className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"
                  >
                    {creatingLibId === watcher.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Library className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggle(watcher.id, watcher.enabled)}
                    title={watcher.enabled ? "Disable" : "Enable"}
                  >
                    {watcher.enabled ? (
                      <ToggleRight className="h-6 w-6 text-[hsl(var(--primary))]" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(watcher.id)}
                    disabled={deletingId === watcher.id}
                    className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                  >
                    {deletingId === watcher.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="mb-3 space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                <div className="flex justify-between">
                  <span>Extensions</span>
                  <span className="text-[hsl(var(--card-foreground))]">
                    {watcher.fileExtensions || "All"}
                  </span>
                </div>
                {watcher.codecFilter && (
                  <div className="flex justify-between">
                    <span>Codec filter</span>
                    <span className="text-[hsl(var(--card-foreground))]">
                      {watcher.codecFilter}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Output</span>
                  <span className="text-[hsl(var(--card-foreground))]">
                    {watcher.outputMode === "fixed" ? watcher.outputDir : "Beside source"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>After encoding</span>
                  <span className="text-[hsl(var(--card-foreground))]">
                    {watcher.replaceSource
                      ? "Replace original"
                      : watcher.deleteSource
                        ? "Delete original"
                        : "Keep original"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Last scan</span>
                  <span className="text-[hsl(var(--card-foreground))]">
                    {watcher.lastScanAt
                      ? new Date(watcher.lastScanAt).toLocaleString()
                      : "Never"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleScanNow(watcher.id)}
                disabled={scanningId === watcher.id}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90 disabled:opacity-50"
              >
                {scanningId === watcher.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Scan Now
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddWatcherDialog
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false)
            mutate()
          }}
        />
      )}
    </div>
  )
}
