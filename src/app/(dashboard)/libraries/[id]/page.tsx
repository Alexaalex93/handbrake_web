"use client"

import { useState, useEffect, use } from "react"
import useSWR from "swr"
import Link from "next/link"
import {
  Loader2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Scan,
  Filter,
} from "lucide-react"
import type { LibraryItem } from "@/types/library"

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
  if (w >= 3840 || h >= 2160) return "4K"
  if (w >= 1920 || h >= 1080) return "1080p"
  if (w >= 1280 || h >= 720) return "720p"
  if (w >= 854 || h >= 480) return "480p"
  return `${w}x${h}`
}

interface ProbeProgress {
  status: "idle" | "scanning" | "probing" | "done" | "error"
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

export default function LibraryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const libraryId = Number(id)
  const [codecFilter, setCodecFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [probeProgress, setProbeProgress] = useState<ProbeProgress | null>(null)
  const limit = 50

  const queryParams = new URLSearchParams({ page: page.toString(), limit: limit.toString() })
  if (codecFilter !== "all") queryParams.set("codec", codecFilter)
  if (searchTerm) queryParams.set("search", searchTerm)

  const { data, isLoading, mutate } = useSWR(
    `/api/libraries/${libraryId}?${queryParams.toString()}`,
    fetcher
  )

  // Check if there's an ongoing probe when we first load
  useEffect(() => {
    let cancelled = false
    async function checkProgress() {
      try {
        const res = await fetch(`/api/libraries/${libraryId}/scan/progress`)
        const data = await res.json()
        if (!cancelled && (data.status === "probing" || data.status === "scanning")) {
          setProbeProgress(data)
        }
      } catch {
        // ignore
      }
    }
    checkProgress()
    return () => { cancelled = true }
  }, [libraryId])

  // Poll for probe progress when probing is active
  useEffect(() => {
    if (!probeProgress || probeProgress.status === "done" || probeProgress.status === "error" || probeProgress.status === "idle") {
      return
    }
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/libraries/${libraryId}/scan/progress`)
        const data = await res.json()
        setProbeProgress(data)
        if (data.status === "done" || data.status === "error") {
          mutate() // Refresh library data when done
        }
      } catch {
        // ignore
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [probeProgress?.status, libraryId, mutate])

  const library = data?.library
  const items: LibraryItem[] = data?.items ?? []
  const total = data?.total ?? 0
  const codecs: { codec: string; count: number }[] = data?.codecs ?? []
  const totalPages = Math.ceil(total / limit)

  const isProbing = probeProgress?.status === "probing" || probeProgress?.status === "scanning"

  const handleScan = async (probe: boolean, forceRescan = false) => {
    setScanning(true)
    setScanResult(null)
    setProbeProgress(null)
    try {
      const res = await fetch(`/api/libraries/${libraryId}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ probe, forceRescan }),
      })
      const result = await res.json()

      if (result.background) {
        // Probe is running in background — start polling
        setProbeProgress({
          status: "probing",
          totalFiles: result.totalFiles,
          newFiles: result.newFiles,
          updatedFiles: result.updatedFiles,
          removedFiles: result.removedFiles,
          probedFiles: 0,
          probedTotal: result.pendingCount ?? result.totalFiles,
          probeErrors: 0,
          currentFile: null,
        })
        setScanResult(null)
      } else {
        setScanResult(result)
        mutate()
      }
    } catch {
      setScanResult({ error: "Scan failed" })
    } finally {
      setScanning(false)
    }
  }

  const probePercent = probeProgress && probeProgress.probedTotal > 0
    ? Math.round(((probeProgress.probedFiles + probeProgress.probeErrors) / probeProgress.probedTotal) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/libraries" className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{library?.name ?? "Library"}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{library?.path}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleScan(false)}
            disabled={scanning || isProbing}
            className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90 disabled:opacity-50"
            title="Only discover new/removed files on disk (no media analysis)"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Scan Files
          </button>
          <button
            onClick={() => handleScan(true, false)}
            disabled={scanning || isProbing}
            className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
            title="Discover new files and analyze only new/unscanned ones (fast, incremental)"
          >
            {(scanning || isProbing) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
            Scan New
          </button>
          <button
            onClick={() => handleScan(true, true)}
            disabled={scanning || isProbing}
            className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            title="Re-analyze ALL files from scratch (slow, use only when needed)"
          >
            {(scanning || isProbing) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Re-scan All
          </button>
        </div>
      </div>

      {/* Probe progress bar */}
      {probeProgress && (probeProgress.status === "probing" || probeProgress.status === "scanning") && (
        <div className="rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-[hsl(var(--primary))]">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Probing {probeProgress.probedTotal < probeProgress.totalFiles ? "new" : "all"} media files... {probeProgress.probedFiles + probeProgress.probeErrors} / {probeProgress.probedTotal}
              {probeProgress.probedTotal < probeProgress.totalFiles && (
                <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                  ({probeProgress.totalFiles - probeProgress.probedTotal} already scanned, skipped)
                </span>
              )}
            </span>
            <span className="font-mono text-[hsl(var(--muted-foreground))]">{probePercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
            <div
              className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-300"
              style={{ width: `${probePercent}%` }}
            />
          </div>
          {probeProgress.currentFile && (
            <p className="mt-2 truncate text-xs text-[hsl(var(--muted-foreground))]">
              {probeProgress.currentFile}
            </p>
          )}
          {probeProgress.probeErrors > 0 && (
            <p className="mt-1 text-xs text-yellow-400">
              {probeProgress.probeErrors} errors
            </p>
          )}
        </div>
      )}

      {/* Probe completed */}
      {probeProgress && probeProgress.status === "done" && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
          ✓ Probe complete — {probeProgress.probedFiles} files analyzed
          {probeProgress.probeErrors > 0 && `, ${probeProgress.probeErrors} errors`}
        </div>
      )}
      {probeProgress && probeProgress.status === "error" && (
        <div className="rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-3 text-sm text-[hsl(var(--destructive))]">
          Probe error: {probeProgress.error || "Unknown error"}
        </div>
      )}

      {/* Scan result (non-probe) */}
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
