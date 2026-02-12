"use client"

import useSWR from "swr"
import { Loader2, PlayCircle } from "lucide-react"
import { useSSE } from "@/hooks/use-sse"
import type { Task } from "@/types/task"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function ActiveJobsCard() {
  const { data, isLoading, mutate } = useSWR<{ tasks: Task[] }>(
    "/api/tasks?status=encoding",
    fetcher,
    { refreshInterval: 10000 }
  )
  const { subscribe } = useSSE()

  // Update on SSE progress events
  subscribe("progress", () => {
    mutate()
  })

  const tasks = data?.tasks ?? []

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <div className="mb-4 flex items-center gap-2">
        <PlayCircle className="h-5 w-5 text-[hsl(var(--primary))]" />
        <h2 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
          Active Encodes
        </h2>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      )}

      {!isLoading && tasks.length === 0 && (
        <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No active encodes
        </p>
      )}

      {tasks.map((task) => (
        <div key={task.id} className="mb-3 last:mb-0">
          <div className="mb-1 flex items-center justify-between">
            <span className="truncate text-sm font-medium text-[hsl(var(--card-foreground))]">
              {task.title}
            </span>
            <span className="ml-2 text-sm font-mono text-[hsl(var(--primary))]">
              {Math.round(task.progress * 100)}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
            <div
              className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-300"
              style={{ width: `${task.progress * 100}%` }}
            />
          </div>

          <div className="mt-1 flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
            {task.etaSeconds > 0 && (
              <span>
                ETA: {Math.floor(task.etaSeconds / 60)}m {task.etaSeconds % 60}s
              </span>
            )}
            {task.fps > 0 && <span>{task.fps.toFixed(1)} fps</span>}
            {task.passCurrent > 0 && task.passTotal > 1 && (
              <span>
                Pass {task.passCurrent}/{task.passTotal}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
