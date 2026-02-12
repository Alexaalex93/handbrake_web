"use client"

import { Plus, Trash2 } from "lucide-react"
import type { SubtitleTrack } from "@/types/handbrake"

interface SubtitleTracksProps {
  value: SubtitleTrack[]
  onChange: (value: SubtitleTrack[]) => void
  disabled?: boolean
}

export function SubtitleTracks({ value, onChange, disabled = false }: SubtitleTracksProps) {
  const addTrack = () => {
    onChange([
      ...value,
      {
        track: value.length + 1,
        burn: false,
        forced: false,
        default: false,
      },
    ])
  }

  const removeTrack = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const updateTrack = (index: number, patch: Partial<SubtitleTrack>) => {
    onChange(
      value.map((t, i) => (i === index ? { ...t, ...patch } : t))
    )
  }

  return (
    <div className="space-y-4">
      {value.length === 0 && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No subtitle tracks configured.
        </p>
      )}

      {value.map((track, index) => (
        <div
          key={index}
          className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-[hsl(var(--card-foreground))]">
              Subtitle Track {index + 1}
            </span>
            {!disabled && (
              <button
                onClick={() => removeTrack(index)}
                className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="mb-1 block text-xs text-[hsl(var(--muted-foreground))]">
                Source Track
              </label>
              <input
                type="number"
                value={track.track}
                onChange={(e) =>
                  updateTrack(index, { track: Number(e.target.value) })
                }
                disabled={disabled}
                min={1}
                className="w-24 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
              <input
                type="checkbox"
                checked={track.burn}
                onChange={(e) =>
                  updateTrack(index, { burn: e.target.checked })
                }
                disabled={disabled}
                className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
              />
              Burn In
            </label>

            <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
              <input
                type="checkbox"
                checked={track.forced}
                onChange={(e) =>
                  updateTrack(index, { forced: e.target.checked })
                }
                disabled={disabled}
                className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
              />
              Forced Only
            </label>

            <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
              <input
                type="checkbox"
                checked={track.default}
                onChange={(e) =>
                  updateTrack(index, { default: e.target.checked })
                }
                disabled={disabled}
                className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
              />
              Default
            </label>
          </div>
        </div>
      ))}

      {!disabled && (
        <button
          onClick={addTrack}
          className="inline-flex items-center gap-2 rounded-md border border-dashed border-[hsl(var(--border))] px-4 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
        >
          <Plus className="h-4 w-4" />
          Add Subtitle Track
        </button>
      )}
    </div>
  )
}
