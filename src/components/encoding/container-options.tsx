"use client"

import type { ContainerOptions as ContainerOpts, ContainerFormat } from "@/types/handbrake"

interface ContainerOptionsProps {
  value: ContainerOpts
  onChange: (value: ContainerOpts) => void
  disabled?: boolean
}

const formats: { value: ContainerFormat; label: string }[] = [
  { value: "mkv", label: "MKV (Matroska)" },
  { value: "mp4", label: "MP4" },
  { value: "webm", label: "WebM" },
]

export function ContainerOptions({ value, onChange, disabled = false }: ContainerOptionsProps) {
  const update = (patch: Partial<ContainerOpts>) => {
    onChange({ ...value, ...patch })
  }

  return (
    <div className="space-y-4">
      {/* Format */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Container Format
        </label>
        <div className="flex gap-4">
          {formats.map((f) => (
            <label
              key={f.value}
              className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]"
            >
              <input
                type="radio"
                name="containerFormat"
                value={f.value}
                checked={value.format === f.value}
                onChange={() => update({ format: f.value })}
                disabled={disabled}
                className="accent-[hsl(var(--primary))]"
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      {/* Chapters */}
      <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
        <input
          type="checkbox"
          checked={value.chapters}
          onChange={(e) => update({ chapters: e.target.checked })}
          disabled={disabled}
          className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
        />
        Include Chapter Markers
      </label>

      {/* Web Optimized (MP4 only) */}
      {value.format === "mp4" && (
        <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
          <input
            type="checkbox"
            checked={value.webOptimized}
            onChange={(e) => update({ webOptimized: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
          />
          Web Optimized (fast start)
        </label>
      )}

      {/* iPod Atom (MP4 only) */}
      {value.format === "mp4" && (
        <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
          <input
            type="checkbox"
            checked={value.ipodAtom}
            onChange={(e) => update({ ipodAtom: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
          />
          iPod 5G Atom
        </label>
      )}
    </div>
  )
}
