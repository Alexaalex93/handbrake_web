"use client"

import useSWR from "swr"
import { Loader2, PlayCircle, Clock, Layers } from "lucide-react"
import type { Task } from "@/types/task"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface QueueStats {
  pending: number
  queued: number
  encoding: number
  paused: number
  nextTask: string | null
}

function formatETA(seconds: number): string {
  if (seconds <= 0) return "--"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return "<1m"
}

function stateLabel(task: Task): { text: string; color: string } {
  if (task.progress === 0 && task.etaSeconds === 0) {
    return { text: "Starting...", color: "text-yellow-400" }
  }
  // Use status field — map to display labels
  if (task.status === "encoding") {
    return { text: "Working", color: "text-[hsl(var(--primary))]" }
  }
  if (task.status === "paused") {
    return { text: "Paused", color: "text-[hsl(var(--warning))]" }
  }
  return { text: task.status, color: "text-[hsl(var(--muted-foreground))]" }
}

export function ActiveJobsCard() {
  const { data: encodingTasks, isLoading: loadingTasks } = useSWR<Task[]>(
    "/api/tasks?status=encoding",
    fetcher,
    { refreshInterval: 3000, keepPreviousData: true }
  )

  const { data: stats } = useSWR<QueueStats>(
    "/api/tasks/stats",
    fetcher,
    { refreshInterval: 5000, keepPreviousData: true }
  )

  const tasks = encodingTasks ?? []

  // ── Overall queue progress ────────────────────────────────────────
  // Total = queued + encoding tasks. Completed tasks move to history,
  // so we track progress as: sum(encoding progress) / total remaining
  const totalInQueue = (stats?.queued ?? 0) + (stats?.encoding ?? 0)
  const sumEncodingProgress = tasks.reduce((sum, t) => sum + t.progress, 0)
  const overallProgress = totalInQueue > 0 ? sumEncodingProgress / totalInQueue : 0
  const overallPercent = Math.round(overallProgress * 100)

  // Estimate total ETA: current task ETA + (remaining queued * avg time per task)
  // Simplified: just show max ETA of active tasks (parallel) + rough queue estimate
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

      {!encodingTasks && loadingTasks && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      )}

      {encodingTasks && tasks.length === 0 && (
        <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No active encodes
        </p>
      )}

      {/* ── Overall Queue Progress Bar ───────────────────────────────── */}
      {totalInQueue > 0 && (
        <div className="mb-4 rounded-md bg-[hsl(var(--secondary))] p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              <Layers className="h-3.5 w-3.5" />
              <span>Queue Progress</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[hsl(var(--muted-foreground))]">
                {Math.floor(sumEncodingProgress)} of {totalInQueue}
              </span>
              <span className="font-mono font-medium text-[hsl(var(--primary))]">
                {overallPercent}%
              </span>
            </div>
          </div>

          {/* Segmented progress bar */}
          <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
            {Array.from({ length: totalInQueue }, (_, i) => {
              // Determine fill for this segment
              // Segments 0..N-1 map to tasks: encoding tasks first, then queued
              let segmentFill = 0
              if (i < tasks.length) {
                // This segment corresponds to an encoding task
                segmentFill = tasks[i].progress
              }
              // Queued tasks have 0 fill (they come after encoding tasks)

              return (
                <div
                  key={i}
                  className="relative flex-1 overflow-hidden bg-[hsl(var(--background))]"
                  style={{
                    borderRadius: i === 0 ? "9999px 0 0 9999px" : i === totalInQueue - 1 ? "0 9999px 9999px 0" : "0",
                  }}
                >
                  <div
                    className="h-full bg-[hsl(var(--primary))] transition-all duration-500"
                    style={{ width: `${segmentFill * 100}%` }}
                  />
                </div>
              )
            })}
          </div>

          {maxETA > 0 && (
            <div className="mt-1.5 flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <Clock className="h-3 w-3" />
              <span>Current: {formatETA(maxETA)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Per-task progress ────────────────────────────────────────── */}
      {tasks.map((task) => {
        const percent = Math.round(task.progress * 100)
        const state = stateLabel(task)

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
              {/* State label */}
              {state.text === "Starting..." ? (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Starting...
                </span>
              ) : (
                <span className={state.color}>{state.text}</span>
              )}

              {/* ETA (hours + minutes only) */}
              {task.etaSeconds > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatETA(task.etaSeconds)}
                </span>
              )}

              {/* FPS */}
              {task.fps > 0 && <span>{task.fps.toFixed(1)} fps</span>}

              {/* Average FPS */}
              {task.avgFps > 0 && (
                <span className="text-[hsl(var(--muted-foreground))]">
                  avg {task.avgFps.toFixed(1)}
                </span>
              )}

              {/* Pass info */}
              {task.passCurrent > 0 && task.passTotal > 0 && (
                <span>
                  Pass {task.passCurrent}/{task.passTotal}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
