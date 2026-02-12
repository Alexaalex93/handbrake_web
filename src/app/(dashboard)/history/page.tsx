"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Ban,
} from "lucide-react"
import type { TaskHistory } from "@/types/task"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const statusConfig = {
  completed: { icon: CheckCircle2, label: "Completed", classes: "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" },
  failed: { icon: XCircle, label: "Failed", classes: "bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))]" },
  cancelled: { icon: Ban, label: "Cancelled", classes: "bg-gray-600/20 text-gray-400" },
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "-"
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

export default function HistoryPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const limit = 20

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  })
  if (statusFilter !== "all") {
    queryParams.set("status", statusFilter)
  }

  const { data, isLoading, mutate } = useSWR<{
    items: TaskHistory[]
    total: number
  }>(`/api/history?${queryParams.toString()}`, fetcher)

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  const handleClearHistory = async () => {
    await fetch("/api/history", { method: "DELETE" })
    mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">History</h1>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={handleClearHistory}
            className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--destructive))] px-4 py-2 text-sm text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive-foreground))] transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Clear History
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
          <p className="text-[hsl(var(--muted-foreground))]">No history entries found.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Duration</th>
                  <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Size In</th>
                  <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Size Out</th>
                  <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Ratio</th>
                  <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const cfg = statusConfig[item.status]
                  const ratio =
                    item.fileSizeIn && item.fileSizeOut
                      ? ((item.fileSizeOut / item.fileSizeIn) * 100).toFixed(0) + "%"
                      : "-"
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--accent))]/50"
                    >
                      <td className="max-w-[200px] truncate px-4 py-3 font-medium text-[hsl(var(--card-foreground))]">
                        {item.title}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cfg.classes}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                        {formatDuration(item.encodingTime)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[hsl(var(--muted-foreground))]">
                        {formatSize(item.fileSizeIn)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[hsl(var(--muted-foreground))]">
                        {formatSize(item.fileSizeOut)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[hsl(var(--muted-foreground))]">
                        {ratio}
                      </td>
                      <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                        {new Date(item.completedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

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
        </>
      )}
    </div>
  )
}
