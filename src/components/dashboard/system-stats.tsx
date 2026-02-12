"use client"

import useSWR from "swr"
import { Cpu, Loader2 } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface SystemInfo {
  cpu: {
    usage: number
    count: number
    loadAvg: number
  }
  memory: {
    used: number
    total: number
    free: number
  }
  disk: {
    used: number
    total: number
    free: number
  }
  platform: string
  hostname: string
  handbrakeVersion: string
}

function bytesToGB(bytes: number): number {
  return bytes / (1024 * 1024 * 1024)
}

function UsageBar({ label, value, max, unit, formatValue }: {
  label: string
  value: number
  max: number
  unit?: string
  formatValue?: (v: number, m: number) => string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  const color = pct > 90 ? "var(--destructive)" : pct > 70 ? "var(--warning)" : "var(--primary)"

  const displayText = formatValue
    ? formatValue(value, max)
    : unit
      ? `${value.toFixed(1)} / ${max.toFixed(1)} ${unit}`
      : `${pct.toFixed(0)}%`

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
        <span className="font-mono text-[hsl(var(--card-foreground))]">
          {displayText}
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
    { refreshInterval: 5000, revalidateOnFocus: false }
  )

  const cpuUsage = data?.cpu?.usage ?? 0
  const memUsedGB = bytesToGB(data?.memory?.used ?? 0)
  const memTotalGB = bytesToGB(data?.memory?.total ?? 1)
  const diskUsedGB = bytesToGB(data?.disk?.used ?? 0)
  const diskTotalGB = bytesToGB(data?.disk?.total ?? 1)

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
          <UsageBar label="CPU" value={cpuUsage} max={100} />
          <UsageBar
            label="Memory"
            value={memUsedGB}
            max={memTotalGB}
            unit="GB"
          />
          <UsageBar
            label="Disk"
            value={diskUsedGB}
            max={diskTotalGB}
            unit="GB"
          />

          {data && (
            <div className="space-y-1 border-t border-[hsl(var(--border))] pt-2">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {data.hostname} &middot; {data.cpu?.count ?? 0} cores &middot; {data.platform}
              </p>
              {data.handbrakeVersion && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  HandBrake: {data.handbrakeVersion}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
