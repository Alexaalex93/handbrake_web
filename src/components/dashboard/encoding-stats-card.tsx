"use client"

import useSWR from "swr"
import { BarChart3, Loader2, TrendingDown } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface HistoryStats {
  totalEncoded: number
  totalFailed: number
  totalSizeIn: number
  totalSizeOut: number
  totalSaved: number
  avgEncodingTime: number
  totalEncodingTime: number
  biggestSavings: { title: string; saved: number; ratio: number }[]
  bestRatio: { title: string; ratio: number }[]
  dailyStats: { date: string; count: number; saved: number }[]
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B"
  const abs = Math.abs(bytes)
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(abs) / Math.log(k))
  const val = parseFloat((abs / Math.pow(k, i)).toFixed(1))
  return (bytes < 0 ? "-" : "") + val + " " + sizes[i]
}

function formatDuration(seconds: number): string {
  if (!seconds) return "-"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

export function EncodingStatsCard() {
  const { data, isLoading } = useSWR<HistoryStats>("/api/history/stats", fetcher, {
    refreshInterval: 60000,
    keepPreviousData: true,
  })

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-[hsl(var(--primary))]" />
        <h2 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
          Encoding Statistics
        </h2>
      </div>

      {!data && isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : !data || data.totalEncoded === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No encoding history yet. Statistics will appear after your first encode.
        </p>
      ) : (
        <div className="space-y-5">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Encoded</p>
              <p className="text-xl font-bold text-[hsl(var(--card-foreground))]">{data.totalEncoded}</p>
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Space Saved</p>
              <p className="text-xl font-bold text-green-400">{formatBytes(data.totalSaved)}</p>
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Avg Ratio</p>
              <p className="text-xl font-bold text-[hsl(var(--card-foreground))]">
                {data.totalSizeIn > 0 ? Math.round((data.totalSizeOut / data.totalSizeIn) * 100) : 0}%
              </p>
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Avg Time</p>
              <p className="text-xl font-bold text-[hsl(var(--card-foreground))]">{formatDuration(data.avgEncodingTime)}</p>
            </div>
          </div>

          {/* Daily chart (last 14 days) */}
          {data.dailyStats.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-[hsl(var(--muted-foreground))]">
                Last 14 days
              </p>
              <div className="flex items-end gap-1" style={{ height: 60 }}>
                {data.dailyStats.map((day) => {
                  const maxCount = Math.max(...data.dailyStats.map((d) => d.count))
                  const h = maxCount > 0 ? Math.max((day.count / maxCount) * 100, 8) : 8
                  return (
                    <div
                      key={day.date}
                      className="flex-1 rounded-t bg-[hsl(var(--primary))] transition-all hover:opacity-80"
                      style={{ height: `${h}%` }}
                      title={`${day.date}: ${day.count} files, saved ${formatBytes(day.saved)}`}
                    />
                  )
                })}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
                <span>{data.dailyStats[0]?.date?.slice(5)}</span>
                <span>{data.dailyStats[data.dailyStats.length - 1]?.date?.slice(5)}</span>
              </div>
            </div>
          )}

          {/* Top savings */}
          {data.biggestSavings.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-[hsl(var(--muted-foreground))]">
                Biggest Savings
              </p>
              <div className="space-y-2">
                {data.biggestSavings.slice(0, 3).map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="max-w-[60%] truncate text-[hsl(var(--card-foreground))]">{item.title}</span>
                      <span className="font-mono text-green-400">-{formatBytes(item.saved)}</span>
                    </div>
                    <MiniBar value={item.saved} max={data.biggestSavings[0]?.saved || 1} color="hsl(var(--primary))" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overall totals */}
          <div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-3 text-xs text-[hsl(var(--muted-foreground))]">
            <span>Total: {formatBytes(data.totalSizeIn)} in, {formatBytes(data.totalSizeOut)} out</span>
            <span>Encoding time: {formatDuration(data.totalEncodingTime)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
