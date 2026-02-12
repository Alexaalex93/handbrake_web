"use client"

import useSWR from "swr"
import { Cpu, Loader2 } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface SystemInfo {
  cpuUsage: number
  memoryUsed: number
  memoryTotal: number
  diskUsed: number
  diskTotal: number
  handbrakeVersion: string
}

function UsageBar({ label, value, max, unit }: { label: string; value: number; max: number; unit?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  const color = pct > 90 ? "var(--destructive)" : pct > 70 ? "var(--warning)" : "var(--primary)"

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
        <span className="font-mono text-[hsl(var(--card-foreground))]">
          {unit ? `${value.toFixed(1)} / ${max.toFixed(1)} ${unit}` : `${pct.toFixed(0)}%`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: `hsl(${color})` }}
        />
      </div>
    </div>
  )
}

export function SystemStatsCard() {
  const { data, isLoading } = useSWR<SystemInfo>(
    "/api/system",
    fetcher,
    { refreshInterval: 5000 }
  )

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <div className="mb-4 flex items-center gap-2">
        <Cpu className="h-5 w-5 text-[hsl(var(--warning))]" />
        <h2 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
          System
        </h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : (
        <div className="space-y-4">
          <UsageBar label="CPU" value={data?.cpuUsage ?? 0} max={100} />
          <UsageBar
            label="Memory"
            value={data?.memoryUsed ?? 0}
            max={data?.memoryTotal ?? 1}
            unit="GB"
          />
          <UsageBar
            label="Disk"
            value={data?.diskUsed ?? 0}
            max={data?.diskTotal ?? 1}
            unit="GB"
          />

          {data?.handbrakeVersion && (
            <div className="border-t border-[hsl(var(--border))] pt-2">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                HandBrake {data.handbrakeVersion}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
