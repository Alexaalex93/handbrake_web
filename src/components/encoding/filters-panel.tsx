"use client"

import type {
  FilterOptions,
  DeinterlaceMode,
  DenoiseMode,
  DenoisePreset,
} from "@/types/handbrake"

interface FiltersPanelProps {
  value: FilterOptions
  onChange: (value: FilterOptions) => void
  disabled?: boolean
}

const deinterlaceModes: { value: DeinterlaceMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "yadif", label: "Yadif" },
  { value: "decomb", label: "Decomb" },
  { value: "bwdif", label: "Bwdif" },
]

const denoiseModes: { value: DenoiseMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "nlmeans", label: "NLMeans" },
  { value: "hqdn3d", label: "HQDN3D" },
]

const denoisePresets: DenoisePreset[] = [
  "ultralight",
  "light",
  "medium",
  "strong",
]

const rotations: { value: 0 | 90 | 180 | 270; label: string }[] = [
  { value: 0, label: "0 (None)" },
  { value: 90, label: "90" },
  { value: 180, label: "180" },
  { value: 270, label: "270" },
]

export function FiltersPanel({ value, onChange, disabled = false }: FiltersPanelProps) {
  const update = (patch: Partial<FilterOptions>) => {
    onChange({ ...value, ...patch })
  }

  return (
    <div className="space-y-4">
      {/* Deinterlace */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Deinterlace
        </label>
        <select
          value={value.deinterlace}
          onChange={(e) =>
            update({ deinterlace: e.target.value as DeinterlaceMode })
          }
          disabled={disabled}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
        >
          {deinterlaceModes.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Denoise */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Denoise
        </label>
        <select
          value={value.denoise}
          onChange={(e) =>
            update({ denoise: e.target.value as DenoiseMode })
          }
          disabled={disabled}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
        >
          {denoiseModes.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {value.denoise !== "off" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
            Denoise Preset
          </label>
          <select
            value={value.denoisePreset}
            onChange={(e) =>
              update({ denoisePreset: e.target.value as DenoisePreset })
            }
            disabled={disabled}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
          >
            {denoisePresets.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Deblock */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Deblock: {value.deblock ?? 0}
        </label>
        <input
          type="range"
          min={0}
          max={15}
          value={value.deblock ?? 0}
          onChange={(e) => update({ deblock: Number(e.target.value) })}
          disabled={disabled}
          className="w-full accent-[hsl(var(--primary))]"
        />
        <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>Off</span>
          <span>15 (Strong)</span>
        </div>
      </div>

      {/* Rotation */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Rotation
        </label>
        <select
          value={value.rotation ?? 0}
          onChange={(e) =>
            update({ rotation: Number(e.target.value) as 0 | 90 | 180 | 270 })
          }
          disabled={disabled}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
        >
          {rotations.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Flip & Grayscale */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
          <input
            type="checkbox"
            checked={value.flip}
            onChange={(e) => update({ flip: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
          />
          Horizontal Flip
        </label>

        <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
          <input
            type="checkbox"
            checked={value.grayscale}
            onChange={(e) => update({ grayscale: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
          />
          Grayscale
        </label>
      </div>
    </div>
  )
}
