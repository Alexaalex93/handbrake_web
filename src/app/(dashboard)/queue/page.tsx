"use client"

import { useState } from "react"
import useSWR from "swr"
import { Plus, Loader2 } from "lucide-react"
import { TaskList } from "@/components/queue/task-list"
import { CreateTaskDialog } from "@/components/queue/create-task-dialog"
import type { Task } from "@/types/task"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function QueuePage() {
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading, mutate } = useSWR<Task[]>(
    "/api/tasks",
    fetcher,
    { refreshInterval: 5000 }
  )

  const tasks = Array.isArray(data) ? data : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Queue</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
          <p className="text-[hsl(var(--muted-foreground))]">
            No tasks in the queue. Click &quot;New Task&quot; to add one.
          </p>
        </div>
      ) : (
        <TaskList tasks={tasks} onRefresh={mutate} />
      )}

      {showCreate && (
        <CreateTaskDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            mutate()
          }}
        />
      )}
    </div>
  )
}
