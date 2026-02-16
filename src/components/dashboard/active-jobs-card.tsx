"use client"

import useSWR from "swr"
import { Loader2, PlayCircle, Clock } from "lucide-react"
import type { Task } from "@/types/task"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatETA(seconds: number): string {
  if (seconds <= 0) return "--"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function ActiveJobsCard() {
  const { data, isLoading } = useSWR<Task[]>(
    "/api/tasks?status=encoding",
    fetcher,
    { refreshInterval: 3000 }
  )

  const tasks = data ?? []

  // Calculate total progress across all tasks
  const totalProgress = tasks.length > 0
    ? tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length
    : 0

  // Estimate total ETA as max of individual ETAs (they run in parallel)
  const maxETA = tasks.reduce((max, t) => Math.max(max, t.etaSeconds || 0), 0)

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h2 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
            Active Encodes
          </h2>
        </div>
        {tasks.length > 0 && (
          <span className="rounded-full bg-[hsl(var(--primary))]/20 px-2.5 py-0.5 text-xs font-medium text-[hsl(var(--primary))]">
            {tasks.length} running
          </span>
        )}
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

      {/* Summary bar when multiple tasks */}
      {tasks.length > 1 && (
        <div className="mb-4 rounded-md bg-[hsl(var(--secondary))] p-3">
          <div className="mb-1 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
            <span>Overall Progress ({tasks.length} tasks)</span>
            <span className="font-mono font-medium text-[hsl(var(--primary))]">
              {Math.round(totalProgress * 100)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--background))]">
            <div
              className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-500"
              style={{ width: `${totalProgress * 100}%` }}
            />
          </div>
          {maxETA > 0 && (
            <div className="mt-1 flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <Clock className="h-3 w-3" />
              <span>Est. remaining: {formatETA(maxETA)}</span>
            </div>
          )}
        </div>
      )}

      {tasks.map((task) => {
        const percent = Math.round(task.progress * 100)
        return (
          <div key={task.id} className="mb-3 last:mb-0">
            <div className="mb-1 flex items-center justify-between">
              <span className="truncate text-sm font-medium text-[hsl(var(--card-foreground))]">
                {task.title}
              </span>
              <span className="ml-2 text-sm font-mono font-medium text-[hsl(var(--primary))]">
                {percent}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
              <div
                className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="mt-1 flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
              {task.etaSeconds > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatETA(task.etaSeconds)}
                </span>
              )}
              {task.fps > 0 && <span>{task.fps.toFixed(1)} fps</span>}
              {task.avgFps > 0 && <span>(avg {task.avgFps.toFixed(1)})</span>}
              {task.passCurrent > 0 && task.passTotal > 0 && (
                <span>
                  Pass {task.passCurrent}/{task.passTotal}
                </span>
              )}
              {percent === 0 && task.etaSeconds === 0 && (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Starting...
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
