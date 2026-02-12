"use client"

import useSWR from "swr"
import { FolderSearch, Loader2, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import type { WatchedFolder } from "@/types/watcher"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function WatcherStatusCard() {
  const { data, isLoading } = useSWR<WatchedFolder[]>(
    "/api/watchers",
    fetcher,
    { refreshInterval: 30000 }
  )

  const watchers = data ?? []

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderSearch className="h-5 w-5 text-[hsl(var(--info))]" />
          <h2 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
            Watchers
          </h2>
        </div>
        <Link
          href="/watchers"
          className="text-xs text-[hsl(var(--primary))] hover:underline"
        >
          Manage
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : watchers.length === 0 ? (
        <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No watchers configured
        </p>
      ) : (
        <div className="space-y-2">
          {watchers.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-3 rounded-md px-2 py-1.5"
            >
              {w.enabled ? (
                <Eye className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
              ) : (
                <EyeOff className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[hsl(var(--card-foreground))]">
                  {w.path}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Every {w.scanInterval}m
                  {w.lastScanAt
                    ? ` - Last: ${new Date(w.lastScanAt).toLocaleTimeString()}`
                    : " - Never scanned"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
