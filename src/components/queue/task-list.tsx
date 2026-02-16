"use client"

import Link from "next/link"
import {
  Play,
  Pause,
  Trash2,
  XCircle,
} from "lucide-react"
import { TaskProgress } from "./task-progress"
import type { Task, TaskStatus } from "@/types/task"

const statusStyles: Record<TaskStatus, { label: string; classes: string }> = {
  pending: { label: "Pending", classes: "bg-gray-600/20 text-gray-400" },
  queued: { label: "Queued", classes: "bg-[hsl(var(--info))]/20 text-[hsl(var(--info))]" },
  encoding: { label: "Encoding", classes: "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] animate-pulse" },
  paused: { label: "Paused", classes: "bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]" },
  completed: { label: "Completed", classes: "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" },
  failed: { label: "Failed", classes: "bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))]" },
  cancelled: { label: "Cancelled", classes: "bg-gray-600/20 text-gray-400" },
}

interface TaskListProps {
  tasks: Task[]
  onRefresh: () => void
}

async function taskAction(id: number, action: string) {
  await fetch(`/api/tasks/${id}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  })
}

async function deleteTask(id: number) {
  await fetch(`/api/tasks/${id}`, { method: "DELETE" })
}

export function TaskList({ tasks, onRefresh }: TaskListProps) {
  const handleAction = async (id: number, action: string) => {
    await taskAction(id, action)
    onRefresh()
  }

  const handleDelete = async (id: number) => {
    await deleteTask(id)
    onRefresh()
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--border))]">
            <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
              Title
            </th>
            <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
              Source
            </th>
            <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
              Status
            </th>
            <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
              Priority
            </th>
            <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
              Progress
            </th>
            <th className="px-4 py-3 text-right font-medium text-[hsl(var(--muted-foreground))]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const status = statusStyles[task.status]
            return (
              <tr
                key={task.id}
                className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--accent))]/50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/queue/${task.id}`}
                    className="font-medium text-[hsl(var(--card-foreground))] hover:text-[hsl(var(--primary))] hover:underline"
                  >
                    {task.title}
                  </Link>
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-[hsl(var(--muted-foreground))]">
                  {task.sourcePath}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status.classes}`}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                  {task.priority}
                </td>
                <td className="w-48 px-4 py-3">
                  {task.status === "encoding" && (
                    <TaskProgress
                      progress={task.progress}
                      eta={task.etaSeconds}
                      fps={task.fps}
                      avgFps={task.avgFps}
                    />
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {(task.status === "pending" || task.status === "queued") && (
                      <button
                        onClick={() => handleAction(task.id, "start")}
                        className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--primary))]"
                        title="Start"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {task.status === "encoding" && (
                      <button
                        onClick={() => handleAction(task.id, "pause")}
                        className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--warning))]"
                        title="Pause"
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    )}
                    {task.status === "paused" && (
                      <button
                        onClick={() => handleAction(task.id, "resume")}
                        className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--primary))]"
                        title="Resume"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {(task.status === "encoding" || task.status === "paused" || task.status === "queued") && (
                      <button
                        onClick={() => handleAction(task.id, "cancel")}
                        className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--destructive))]"
                        title="Cancel"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                    {(task.status === "pending" ||
                      task.status === "queued" ||
                      task.status === "completed" ||
                      task.status === "failed" ||
                      task.status === "cancelled") && (
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--destructive))]"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
