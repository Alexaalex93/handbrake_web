"use client"

import useSWR from "swr"
import { ListOrdered, Loader2 } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface QueueStats {
  pending: number
  queued: number
  encoding: number
  nextTask: string | null
}

export function QueueSummaryCard() {
  const { data, isLoading } = useSWR<QueueStats>(
    "/api/tasks/stats",
    fetcher,
    { refreshInterval: 5000 }
  )

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <div className="mb-4 flex items-center gap-2">
        <ListOrdered className="h-5 w-5 text-[hsl(var(--info))]" />
        <h2 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
          Queue
        </h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Pending</span>
            <span className="text-2xl font-bold text-[hsl(var(--card-foreground))]">
              {data?.pending ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Queued</span>
            <span className="text-2xl font-bold text-[hsl(var(--card-foreground))]">
              {data?.queued ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Encoding</span>
            <span className="text-2xl font-bold text-[hsl(var(--primary))]">
              {data?.encoding ?? 0}
            </span>
          </div>

          {data?.nextTask && (
            <div className="mt-2 border-t border-[hsl(var(--border))] pt-2">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Next up:</p>
              <p className="truncate text-sm text-[hsl(var(--card-foreground))]">
                {data.nextTask}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
