"use client"

interface TaskProgressProps {
  progress: number
  eta: number
  fps: number
  avgFps: number
}

export function TaskProgress({ progress, eta, fps, avgFps }: TaskProgressProps) {
  const pct = Math.round(progress * 100)

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-emerald-400 transition-all duration-300 animate-pulse"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="min-w-[3ch] text-right text-xs font-mono text-[hsl(var(--primary))]">
          {pct}%
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-[hsl(var(--muted-foreground))]">
        {eta > 0 && (
          <span>ETA {Math.floor(eta / 60)}m {eta % 60}s</span>
        )}
        {fps > 0 && <span>{fps.toFixed(1)} fps</span>}
        {avgFps > 0 && <span>avg {avgFps.toFixed(1)}</span>}
      </div>
    </div>
  )
}
