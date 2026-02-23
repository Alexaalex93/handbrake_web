"use client"

import useSWR from "swr"
import { Clock, Loader2, CheckCircle2, XCircle, Ban, SkipForward } from "lucide-react"
import Link from "next/link"
import type { TaskHistory } from "@/types/task"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const statusConfig: Record<string, { icon: any; color: string }> = {
  completed: { icon: CheckCircle2, color: "text-[hsl(var(--primary))]" },
  failed: { icon: XCircle, color: "text-[hsl(var(--destructive))]" },
  cancelled: { icon: Ban, color: "text-[hsl(var(--muted-foreground))]" },
  skipped: { icon: SkipForward, color: "text-orange-400" },
}

export function RecentHistoryCard() {
  const { data, isLoading } = useSWR<{ items: TaskHistory[], total: number, page: number, limit: number, totalPages: number }>(
    "/api/history?limit=5",
    fetcher,
    { refreshInterval: 15000, keepPreviousData: true }
  )

  const items = data?.items ?? []

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          <h2 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
            Recent History
          </h2>
        </div>
        <Link
          href="/history"
          className="text-xs text-[hsl(var(--primary))] hover:underline"
        >
          View all
        </Link>
      </div>

      {!data && isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No history yet
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const cfg = statusConfig[item.status] || statusConfig.cancelled
            const StatusIcon = cfg.icon
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-md px-2 py-1.5"
              >
                <StatusIcon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[hsl(var(--card-foreground))]">
                    {item.title}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {new Date(item.completedAt).toLocaleDateString()}
                  </p>
                </div>
                {item.fileSizeOut != null && item.fileSizeIn != null && item.fileSizeIn > 0 && (
                  <span className="shrink-0 text-xs font-mono text-[hsl(var(--muted-foreground))]">
                    {((item.fileSizeOut / item.fileSizeIn) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
