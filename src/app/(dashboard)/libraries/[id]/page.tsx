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
  ListPlus,
  X,
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FolderSearch,
  List,
  FolderTree,
  Folder,
  FolderOpen,
  FileVideo,
  ChevronDown,
} from "lucide-react"
import type { LibraryItem } from "@/types/library"
import type { Preset } from "@/types/preset"

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
  const [sortBy, setSortBy] = useState("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [probeProgress, setProbeProgress] = useState<ProbeProgress | null>(null)
  const [selectedMap, setSelectedMap] = useState<Map<number, string>>(new Map()) // id -> filePath
  const [addingToQueue, setAddingToQueue] = useState(false)
  const [batchResult, setBatchResult] = useState<{ created: number; errors: string[] } | null>(null)
  const [limit, setLimit] = useState(50)
  const [showBatchDialog, setShowBatchDialog] = useState(false)
  const [batchPresetId, setBatchPresetId] = useState<number | null>(null)
  const [batchReplaceSource, setBatchReplaceSource] = useState(false)
  const [batchDeleteSource, setBatchDeleteSource] = useState(false)
  const [showWatcherDialog, setShowWatcherDialog] = useState(false)
  const [watcherSaving, setWatcherSaving] = useState(false)
  const [watcherPresetId, setWatcherPresetId] = useState<number | null>(null)
  const [watcherInterval, setWatcherInterval] = useState(60)
  const [watcherOutputMode, setWatcherOutputMode] = useState<"fixed" | "beside_source">("beside_source")
  const [watcherOutputDir, setWatcherOutputDir] = useState("")
  const [watcherOutputPattern, setWatcherOutputPattern] = useState("{name}_encoded.{ext}")
  const [watcherDeleteSource, setWatcherDeleteSource] = useState(false)
  const [watcherReplaceSource, setWatcherReplaceSource] = useState(false)
  const [watcherError, setWatcherError] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "tree">("table")
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // In tree mode, fetch all items (no pagination) so the full folder structure is visible
  const effectiveLimit = viewMode === "tree" ? 0 : limit
  const queryParams = new URLSearchParams({ page: page.toString(), limit: effectiveLimit.toString(), sort: sortBy, order: sortOrder })
  if (codecFilter !== "all") queryParams.set("codec", codecFilter)
  if (searchTerm) queryParams.set("search", searchTerm)

  const { data, isLoading, mutate } = useSWR(
    `/api/libraries/${libraryId}?${queryParams.toString()}`,
    fetcher
  )

  const { data: presetsData } = useSWR<Preset[]>("/api/presets", fetcher)
  const presets = Array.isArray(presetsData) ? presetsData : []

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
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 1

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

  // Selection helpers
  const allOnPageSelected = items.length > 0 && items.every(item => selectedMap.has(item.id))

  const toggleSelect = (item: LibraryItem) => {
    setSelectedMap(prev => {
      const next = new Map(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.set(item.id, item.filePath)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedMap(prev => {
        const next = new Map(prev)
        for (const item of items) next.delete(item.id)
        return next
      })
    } else {
      setSelectedMap(prev => {
        const next = new Map(prev)
        for (const item of items) next.set(item.id, item.filePath)
        return next
      })
    }
  }

  const clearSelection = () => setSelectedMap(new Map())

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortOrder("asc")
    }
    setPage(1)
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />
    return sortOrder === "asc"
      ? <ArrowUp className="ml-1 inline h-3 w-3" />
      : <ArrowDown className="ml-1 inline h-3 w-3" />
  }

  // ---- Tree view logic ----
  interface TreeNode {
    name: string
    path: string // full relative path for this folder
    children: Map<string, TreeNode>
    items: LibraryItem[]
  }

  const buildTree = (fileItems: LibraryItem[], basePath: string): TreeNode => {
    const root: TreeNode = { name: "root", path: "", children: new Map(), items: [] }
    const normalizedBase = basePath.replace(/\\/g, "/").replace(/\/$/, "")

    for (const item of fileItems) {
      const normalizedPath = item.filePath.replace(/\\/g, "/")
      // Get relative path, strip base and leading /
      let rel = normalizedPath
      if (normalizedPath.startsWith(normalizedBase)) {
        rel = normalizedPath.slice(normalizedBase.length)
      }
      if (rel.startsWith("/")) rel = rel.slice(1)

      const parts = rel.split("/")
      const fileName = parts.pop()! // last segment is the filename
      let current = root

      // Navigate/create folder nodes
      let pathSoFar = ""
      for (const part of parts) {
        pathSoFar = pathSoFar ? `${pathSoFar}/${part}` : part
        if (!current.children.has(part)) {
          current.children.set(part, { name: part, path: pathSoFar, children: new Map(), items: [] })
        }
        current = current.children.get(part)!
      }

      current.items.push(item)
    }

    return root
  }

  const treeRoot = viewMode === "tree" && library ? buildTree(items, library.path) : null

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const expandAll = () => {
    if (!treeRoot) return
    const allPaths = new Set<string>()
    const collect = (node: TreeNode) => {
      if (node.path) allPaths.add(node.path)
      for (const child of node.children.values()) collect(child)
    }
    collect(treeRoot)
    setExpandedFolders(allPaths)
  }

  const collapseAll = () => setExpandedFolders(new Set())

  // Count total files under a node (including nested)
  const countFiles = (node: TreeNode): number => {
    let count = node.items.length
    for (const child of node.children.values()) count += countFiles(child)
    return count
  }

  // Count total size under a node
  const sumSize = (node: TreeNode): number => {
    let size = node.items.reduce((s, i) => s + i.fileSize, 0)
    for (const child of node.children.values()) size += sumSize(child)
    return size
  }

  // Select all items under a tree node
  const selectTreeNode = (node: TreeNode) => {
    setSelectedMap(prev => {
      const next = new Map(prev)
      const addAll = (n: TreeNode) => {
        for (const item of n.items) next.set(item.id, item.filePath)
        for (const child of n.children.values()) addAll(child)
      }
      addAll(node)
      return next
    })
  }

  // Render a tree node
  const renderTreeNode = (node: TreeNode, depth: number) => {
    const isExpanded = expandedFolders.has(node.path)
    const fileCount = countFiles(node)
    const totalSize = sumSize(node)
    const sortedChildren = Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    const sortedItems = node.items // already sorted from API

    return (
      <div key={node.path || "root"}>
        {/* Folder header (skip for root) */}
        {node.path && (
          <div
            className="group flex items-center gap-1 border-b border-[hsl(var(--border))]/50 py-2 hover:bg-[hsl(var(--accent))]/30"
            style={{ paddingLeft: `${depth * 20 + 8}px` }}
          >
            <button
              onClick={() => toggleFolder(node.path)}
              className="flex items-center gap-1.5 text-[hsl(var(--card-foreground))] hover:text-[hsl(var(--primary))]"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
              {isExpanded ? <FolderOpen className="h-4 w-4 text-yellow-500" /> : <Folder className="h-4 w-4 text-yellow-600" />}
              <span className="font-medium">{node.name}</span>
            </button>
            <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
              {fileCount} file{fileCount !== 1 ? "s" : ""} · {formatSize(totalSize)}
            </span>
            <button
              onClick={() => selectTreeNode(node)}
              className="ml-auto mr-3 hidden rounded px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] group-hover:inline-flex"
              title="Select all files in this folder"
            >
              Select all
            </button>
          </div>
        )}

        {/* Children (folders + files) */}
        {(isExpanded || !node.path) && (
          <>
            {sortedChildren.map(child => renderTreeNode(child, node.path ? depth + 1 : depth))}
            {sortedItems.map(item => (
              <div
                key={item.id}
                className={`flex items-center gap-2 border-b border-[hsl(var(--border))]/30 py-1.5 text-sm hover:bg-[hsl(var(--accent))]/50 ${
                  selectedMap.has(item.id) ? "bg-[hsl(var(--primary))]/10" : ""
                }`}
                style={{ paddingLeft: `${(node.path ? depth + 1 : depth) * 20 + 8}px` }}
              >
                <button onClick={() => toggleSelect(item)} className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                  {selectedMap.has(item.id) ? <CheckSquare className="h-3.5 w-3.5 text-[hsl(var(--primary))]" /> : <Square className="h-3.5 w-3.5" />}
                </button>
                <FileVideo className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                <span className="min-w-0 flex-1 truncate font-medium text-[hsl(var(--card-foreground))]" title={item.filePath}>
                  {item.fileName}
                </span>
                {item.videoCodec && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.videoCodec === "H.265" ? "bg-green-500/20 text-green-400" :
                    item.videoCodec === "AV1" ? "bg-blue-500/20 text-blue-400" :
                    item.videoCodec === "H.264" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-gray-500/20 text-gray-400"
                  }`}>
                    {item.videoCodec}
                  </span>
                )}
                <span className="hidden shrink-0 text-xs text-[hsl(var(--muted-foreground))] sm:inline">
                  {formatResolution(item.width, item.height)}
                </span>
                <span className="hidden shrink-0 text-xs text-[hsl(var(--muted-foreground))] md:inline">
                  {formatDuration(item.duration)}
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-xs text-[hsl(var(--muted-foreground))]">
                  {formatSize(item.fileSize)}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    )
  }

  const openBatchDialog = () => {
    setBatchPresetId(null)
    setBatchReplaceSource(false)
    setBatchDeleteSource(false)
    setShowBatchDialog(true)
  }

  const handleAddToQueue = async () => {
    if (selectedMap.size === 0) return
    setAddingToQueue(true)
    setBatchResult(null)
    setShowBatchDialog(false)
    try {
      const batchItems = Array.from(selectedMap.values()).map(filePath => ({ sourcePath: filePath }))
      const body: any = { items: batchItems }
      if (batchPresetId) body.presetId = batchPresetId
      if (batchReplaceSource) body.replaceSource = true
      else if (batchDeleteSource) body.deleteSource = true

      const res = await fetch("/api/tasks/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await res.json()
      setBatchResult({ created: result.created, errors: result.errors || [] })
      if (result.created > 0) {
        clearSelection()
      }
    } catch {
      setBatchResult({ created: 0, errors: ["Failed to add to queue"] })
    } finally {
      setAddingToQueue(false)
    }
  }

  const handleCreateWatcher = async () => {
    if (!library) return
    setWatcherSaving(true)
    setWatcherError("")
    try {
      const res = await fetch("/api/watchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: library.path,
          recursive: library.recursive,
          scanInterval: watcherInterval,
          fileExtensions: library.fileExtensions,
          outputMode: watcherOutputMode,
          outputDir: watcherOutputMode === "fixed" ? watcherOutputDir : null,
          outputPattern: watcherOutputPattern,
          presetId: watcherPresetId,
          codecFilter: codecFilter !== "all" ? codecFilter : "",
          deleteSource: watcherDeleteSource,
          replaceSource: watcherReplaceSource,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setWatcherError(data.error || "Failed to create watcher")
        return
      }
      setShowWatcherDialog(false)
    } catch {
      setWatcherError("Failed to create watcher")
    } finally {
      setWatcherSaving(false)
    }
  }

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
            onClick={() => {
              setWatcherPresetId(null)
              setWatcherDeleteSource(false)
              setWatcherReplaceSource(false)
              setWatcherError("")
              setShowWatcherDialog(true)
            }}
            className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90"
            title={`Create a watcher for this path${codecFilter !== "all" ? ` filtering ${codecFilter}` : ""}`}
          >
            <FolderSearch className="h-4 w-4" />
            Create Watcher
          </button>
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
        {/* View mode toggle */}
        <div className="flex rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
          <button
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1 rounded-l-md px-2.5 py-1.5 text-sm ${
              viewMode === "table"
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
            title="Table view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setViewMode("tree")
              // Auto-expand first level when switching to tree
              if (viewMode !== "tree" && library) {
                const tempRoot = buildTree(items, library.path)
                const firstLevel = new Set<string>()
                for (const child of tempRoot.children.values()) {
                  firstLevel.add(child.path)
                }
                setExpandedFolders(firstLevel)
              }
            }}
            className={`inline-flex items-center gap-1 rounded-r-md px-2.5 py-1.5 text-sm ${
              viewMode === "tree"
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
            title="Folder tree view"
          >
            <FolderTree className="h-4 w-4" />
          </button>
        </div>
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

      {/* Items table / tree view */}
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
      ) : viewMode === "tree" && treeRoot ? (
        /* Tree View */
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          {/* Tree toolbar */}
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2">
            <button
              onClick={expandAll}
              className="rounded px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
            >
              Expand all
            </button>
            <button
              onClick={collapseAll}
              className="rounded px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
            >
              Collapse all
            </button>
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
              {treeRoot.children.size} folder{treeRoot.children.size !== 1 ? "s" : ""}
              {treeRoot.items.length > 0 && ` · ${treeRoot.items.length} root file${treeRoot.items.length !== 1 ? "s" : ""}`}
            </span>
          </div>
          {/* Tree content */}
          <div className="max-h-[70vh] overflow-y-auto">
            {renderTreeNode(treeRoot, 0)}
          </div>
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="w-10 px-3 py-3">
                  <button onClick={toggleSelectAll} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                    {allOnPageSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
                  <button onClick={() => handleSort("name")} className="inline-flex items-center hover:text-[hsl(var(--foreground))]">
                    Name<SortIcon column="name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
                  <button onClick={() => handleSort("codec")} className="inline-flex items-center hover:text-[hsl(var(--foreground))]">
                    Video<SortIcon column="codec" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
                  <button onClick={() => handleSort("resolution")} className="inline-flex items-center hover:text-[hsl(var(--foreground))]">
                    Resolution<SortIcon column="resolution" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
                  <button onClick={() => handleSort("audio")} className="inline-flex items-center hover:text-[hsl(var(--foreground))]">
                    Audio<SortIcon column="audio" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
                  <button onClick={() => handleSort("duration")} className="inline-flex items-center hover:text-[hsl(var(--foreground))]">
                    Duration<SortIcon column="duration" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
                  <button onClick={() => handleSort("size")} className="inline-flex items-center hover:text-[hsl(var(--foreground))]">
                    Size<SortIcon column="size" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
                  <button onClick={() => handleSort("subs")} className="inline-flex items-center hover:text-[hsl(var(--foreground))]">
                    Subs<SortIcon column="subs" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--accent))]/50 ${
                    selectedMap.has(item.id) ? "bg-[hsl(var(--primary))]/10" : ""
                  }`}
                >
                  <td className="w-10 px-3 py-3">
                    <button onClick={() => toggleSelect(item)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                      {selectedMap.has(item.id) ? <CheckSquare className="h-4 w-4 text-[hsl(var(--primary))]" /> : <Square className="h-4 w-4" />}
                    </button>
                  </td>
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

      {/* Batch result notification */}
      {batchResult && (
        <div className={`rounded-md p-3 text-sm ${
          batchResult.errors.length > 0 && batchResult.created === 0
            ? "border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]"
            : "border border-green-500/30 bg-green-500/10 text-green-400"
        }`}>
          {batchResult.created > 0 && `${batchResult.created} task(s) added to queue.`}
          {batchResult.errors.length > 0 && (
            <span className="ml-1 text-yellow-400">
              {batchResult.errors.join("; ")}
            </span>
          )}
        </div>
      )}

      {/* Floating action bar when items selected */}
      {selectedMap.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform">
          <div className="flex items-center gap-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-3 shadow-2xl">
            <span className="text-sm font-medium text-[hsl(var(--card-foreground))]">
              {selectedMap.size} selected
            </span>
            <button
              onClick={openBatchDialog}
              disabled={addingToQueue}
              className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
            >
              {addingToQueue ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
              Add to Queue
            </button>
            <button
              onClick={clearSelection}
              className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Batch queue dialog */}
      {showBatchDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
                Add {selectedMap.size} item{selectedMap.size > 1 ? "s" : ""} to Queue
              </h3>
              <button onClick={() => setShowBatchDialog(false)} className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Preset selector */}
              <div>
                <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Encoding Preset</label>
                <select
                  value={batchPresetId ?? ""}
                  onChange={(e) => setBatchPresetId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
                >
                  <option value="">Default (x265 RF18 slow)</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Source file options */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[hsl(var(--card-foreground))]">After encoding</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                    <input
                      type="radio"
                      name="sourceAction"
                      checked={!batchDeleteSource && !batchReplaceSource}
                      onChange={() => { setBatchDeleteSource(false); setBatchReplaceSource(false) }}
                      className="accent-[hsl(var(--primary))]"
                    />
                    Keep original file
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                    <input
                      type="radio"
                      name="sourceAction"
                      checked={batchDeleteSource}
                      onChange={() => { setBatchDeleteSource(true); setBatchReplaceSource(false) }}
                      className="accent-[hsl(var(--primary))]"
                    />
                    Delete original (keep encoded as _encoded)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                    <input
                      type="radio"
                      name="sourceAction"
                      checked={batchReplaceSource}
                      onChange={() => { setBatchReplaceSource(true); setBatchDeleteSource(false) }}
                      className="accent-[hsl(var(--primary))]"
                    />
                    Replace original (delete original, rename encoded to original name)
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowBatchDialog(false)}
                className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToQueue}
                disabled={addingToQueue}
                className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
              >
                {addingToQueue ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
                Add {selectedMap.size} to Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Watcher dialog */}
      {showWatcherDialog && library && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
          onMouseDown={(e) => e.target === e.currentTarget && setShowWatcherDialog(false)}>
          <div className="mx-4 w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
                Create Watcher
              </h3>
              <button onClick={() => setShowWatcherDialog(false)} className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Path</span>
                  <span className="font-mono text-[hsl(var(--card-foreground))]">{library.path}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Recursive</span>
                  <span className="text-[hsl(var(--card-foreground))]">{library.recursive ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Extensions</span>
                  <span className="text-[hsl(var(--card-foreground))]">{library.fileExtensions}</span>
                </div>
                {codecFilter !== "all" && (
                  <div className="flex justify-between">
                    <span className="text-[hsl(var(--muted-foreground))]">Codec filter</span>
                    <span className="text-[hsl(var(--card-foreground))]">{codecFilter}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Scan Interval (min)</label>
                <input type="number" value={watcherInterval} onChange={(e) => setWatcherInterval(Number(e.target.value))} min={1}
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Preset</label>
                <select value={watcherPresetId ?? ""} onChange={(e) => setWatcherPresetId(e.target.value ? Number(e.target.value) : null)}
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
                      checked={!watcherDeleteSource && !watcherReplaceSource}
                      onChange={() => { setWatcherDeleteSource(false); setWatcherReplaceSource(false) }}
                      className="accent-[hsl(var(--primary))]" />
                    Keep
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
                    <input type="radio" name="watcherPostAction" value="delete"
                      checked={watcherDeleteSource && !watcherReplaceSource}
                      onChange={() => { setWatcherDeleteSource(true); setWatcherReplaceSource(false) }}
                      className="accent-[hsl(var(--primary))]" />
                    Delete
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
                    <input type="radio" name="watcherPostAction" value="replace"
                      checked={watcherReplaceSource}
                      onChange={() => { setWatcherDeleteSource(false); setWatcherReplaceSource(true) }}
                      className="accent-[hsl(var(--primary))]" />
                    Replace
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[hsl(var(--card-foreground))]">Output</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
                    <input type="radio" name="watcherOutputLoc" value="beside_source"
                      checked={watcherOutputMode === "beside_source"}
                      onChange={() => setWatcherOutputMode("beside_source")}
                      className="accent-[hsl(var(--primary))]" />
                    Beside source
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
                    <input type="radio" name="watcherOutputLoc" value="fixed"
                      checked={watcherOutputMode === "fixed"}
                      onChange={() => setWatcherOutputMode("fixed")}
                      className="accent-[hsl(var(--primary))]" />
                    Fixed directory
                  </label>
                </div>
              </div>

              {watcherOutputMode === "fixed" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Output Directory</label>
                  <input type="text" value={watcherOutputDir} onChange={(e) => setWatcherOutputDir(e.target.value)}
                    placeholder="/media/output"
                    className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]" />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Output Pattern</label>
                <input type="text" value={watcherOutputPattern} onChange={(e) => setWatcherOutputPattern(e.target.value)}
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]" />
              </div>

              {watcherError && <p className="text-sm text-[hsl(var(--destructive))]">{watcherError}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowWatcherDialog(false)}
                className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
                Cancel
              </button>
              <button onClick={handleCreateWatcher} disabled={watcherSaving}
                className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50">
                {watcherSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderSearch className="h-4 w-4" />}
                Create Watcher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination + Page Size (hidden in tree view) */}
      {viewMode === "table" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Show</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}
              className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-2 py-1 text-sm text-[hsl(var(--foreground))]"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={400}>400</option>
              <option value={0}>All</option>
            </select>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">items</span>
          </div>
          {limit > 0 && totalPages > 1 && (
            <div className="flex items-center gap-2">
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
      )}
    </div>
  )
}
