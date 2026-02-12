"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Plus,
  FolderSearch,
  Loader2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from "lucide-react"
import type { WatchedFolder } from "@/types/watcher"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function WatchersPage() {
  const { data, isLoading, mutate } = useSWR<{ watchers: WatchedFolder[] }>(
    "/api/watchers",
    fetcher
  )
  const [scanningId, setScanningId] = useState<number | null>(null)

  const watchers = data?.watchers ?? []

  const handleToggle = async (id: number, enabled: boolean) => {
    await fetch(`/api/watchers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    })
    mutate()
  }

  const handleScanNow = async (id: number) => {
    setScanningId(id)
    try {
      await fetch(`/api/watchers/${id}/scan`, { method: "POST" })
      mutate()
    } finally {
      setScanningId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Folder Watchers</h1>
        <button className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90">
          <Plus className="h-4 w-4" />
          Add Watcher
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : watchers.length === 0 ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
          <FolderSearch className="mx-auto mb-4 h-12 w-12 text-[hsl(var(--muted-foreground))]" />
          <p className="text-[hsl(var(--muted-foreground))]">
            No folder watchers configured. Add one to automatically queue files for encoding.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {watchers.map((watcher) => (
            <div
              key={watcher.id}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[hsl(var(--card-foreground))]">
                    {watcher.path}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Scan every {watcher.scanInterval} minutes
                    {watcher.recursive ? " (recursive)" : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleToggle(watcher.id, watcher.enabled)}
                  className="ml-2 shrink-0"
                  title={watcher.enabled ? "Disable" : "Enable"}
                >
                  {watcher.enabled ? (
                    <ToggleRight className="h-6 w-6 text-[hsl(var(--primary))]" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                  )}
                </button>
              </div>

              <div className="mb-3 space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                <div className="flex justify-between">
                  <span>Extensions</span>
                  <span className="text-[hsl(var(--card-foreground))]">
                    {watcher.fileExtensions || "All"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Output</span>
                  <span className="text-[hsl(var(--card-foreground))]">
                    {watcher.outputMode === "fixed" ? watcher.outputDir : "Beside source"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Last scan</span>
                  <span className="text-[hsl(var(--card-foreground))]">
                    {watcher.lastScanAt
                      ? new Date(watcher.lastScanAt).toLocaleString()
                      : "Never"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleScanNow(watcher.id)}
                disabled={scanningId === watcher.id}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90 disabled:opacity-50"
              >
                {scanningId === watcher.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Scan Now
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
