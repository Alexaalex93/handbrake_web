"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import useSWR from "swr"
import { Plus, Loader2, Trash2 } from "lucide-react"
import { TaskList } from "@/components/queue/task-list"
import { CreateTaskDialog } from "@/components/queue/create-task-dialog"
import type { Task } from "@/types/task"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function QueuePage() {
  const [showCreate, setShowCreate] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const showCreateRef = useRef(false)

  // Keep ref in sync so the SWR config callback reads the latest value
  showCreateRef.current = showCreate

  const { data, isLoading, mutate } = useSWR<Task[]>(
    "/api/tasks",
    fetcher,
    {
      refreshInterval: (latestData) => {
        // Stop polling entirely when dialog is open
        return showCreateRef.current ? 0 : 5000
      },
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
    }
  )

  const tasks = Array.isArray(data) ? data : []

  const handleClose = useCallback(() => {
    setShowCreate(false)
  }, [])

  const handleCreated = useCallback(() => {
    setShowCreate(false)
    mutate()
  }, [mutate])

  const handleClearQueue = useCallback(async () => {
    setClearing(true)
    try {
      await fetch("/api/tasks/batch", { method: "DELETE" })
      mutate()
    } finally {
      setClearing(false)
      setShowClearConfirm(false)
    }
  }, [mutate])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Queue</h1>
        <div className="flex items-center gap-2">
          {tasks.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-4 py-2 text-sm font-medium text-[hsl(var(--secondary-foreground))] hover:opacity-90 transition-opacity"
            >
              <Trash2 className="h-4 w-4" />
              Clear Queue
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {!data && isLoading ? (
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
          onClose={handleClose}
          onCreated={handleCreated}
        />
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onMouseDown={(e) => e.target === e.currentTarget && setShowClearConfirm(false)}>
          <div className="mx-4 w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"
            onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold text-[hsl(var(--card-foreground))]">
              Clear Queue
            </h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              This will cancel any active encodes and delete all {tasks.length} task(s) from the queue. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-4 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90">
                Cancel
              </button>
              <button
                onClick={handleClearQueue}
                disabled={clearing}
                className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--destructive))] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                {clearing && <Loader2 className="h-4 w-4 animate-spin" />}
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
