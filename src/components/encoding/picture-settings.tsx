"use client"

import { useState } from "react"
import { Link2, Link2Off } from "lucide-react"
import type { PictureOptions, AnamorphicMode, CropMode } from "@/types/handbrake"

interface PictureSettingsProps {
  value: PictureOptions
  onChange: (value: PictureOptions) => void
  disabled?: boolean
}

const anamorphicModes: { value: AnamorphicMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "strict", label: "Strict" },
  { value: "loose", label: "Loose" },
  { value: "custom", label: "Custom" },
  { value: "auto", label: "Auto" },
]

const modulusOptions: (2 | 4 | 8 | 16)[] = [2, 4, 8, 16]

export function PictureSettings({ value, onChange, disabled = false }: PictureSettingsProps) {
  const [lockAspect, setLockAspect] = useState(true)
  const [aspectRatio, setAspectRatio] = useState(
    value.width && value.height && value.height > 0
      ? value.width / value.height
      : 16 / 9
  )

  const update = (patch: Partial<PictureOptions>) => {
    onChange({ ...value, ...patch })
  }

  const handleWidthChange = (w: number) => {
    if (lockAspect && aspectRatio > 0) {
      update({ width: w, height: Math.round(w / aspectRatio) })
    } else {
      update({ width: w })
    }
  }

  const handleHeightChange = (h: number) => {
    if (lockAspect && h > 0) {
      const newRatio = (value.width ?? 1920) / h
      setAspectRatio(newRatio)
      update({ height: h })
    } else {
      update({ height: h })
    }
  }

  return (
    <div className="space-y-4">
      {/* Resolution */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Resolution
        </label>
        <div className="flex items-center gap-2">
          <div>
            <label className="mb-1 block text-xs text-[hsl(var(--muted-foreground))]">
              Width
            </label>
            <input
              type="number"
              value={value.width ?? ""}
              onChange={(e) => handleWidthChange(Number(e.target.value))}
              disabled={disabled}
              placeholder="Auto"
              className="w-28 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
            />
          </div>

          <button
            onClick={() => setLockAspect(!lockAspect)}
            disabled={disabled}
            className="mt-5 rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"
            title={lockAspect ? "Unlock aspect ratio" : "Lock aspect ratio"}
          >
            {lockAspect ? (
              <Link2 className="h-4 w-4" />
            ) : (
              <Link2Off className="h-4 w-4" />
            )}
          </button>

          <div>
            <label className="mb-1 block text-xs text-[hsl(var(--muted-foreground))]">
              Height
            </label>
            <input
              type="number"
              value={value.height ?? ""}
              onChange={(e) => handleHeightChange(Number(e.target.value))}
              disabled={disabled}
              placeholder="Auto"
              className="w-28 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Anamorphic */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Anamorphic
        </label>
        <select
          value={value.anamorphic}
          onChange={(e) =>
            update({ anamorphic: e.target.value as AnamorphicMode })
          }
          disabled={disabled}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
        >
          {anamorphicModes.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Modulus */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Modulus
        </label>
        <select
          value={value.modulus}
          onChange={(e) =>
            update({ modulus: Number(e.target.value) as 2 | 4 | 8 | 16 })
          }
          disabled={disabled}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
        >
          {modulusOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Cropping */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Cropping
        </label>
        <div className="mb-3 flex gap-4">
          {(["auto", "none", "custom"] as CropMode[]).map((mode) => (
            <label
              key={mode}
              className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]"
            >
              <input
                type="radio"
                name="cropMode"
                value={mode}
                checked={value.cropMode === mode}
                onChange={() => update({ cropMode: mode })}
                disabled={disabled}
                className="accent-[hsl(var(--primary))]"
              />
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </label>
          ))}
        </div>

        {value.cropMode === "custom" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["cropTop", "cropBottom", "cropLeft", "cropRight"] as const).map(
              (side) => (
                <div key={side}>
                  <label className="mb-1 block text-xs text-[hsl(var(--muted-foreground))]">
                    {side.replace("crop", "")}
                  </label>
                  <input
                    type="number"
                    value={value[side]}
                    onChange={(e) =>
                      update({ [side]: Number(e.target.value) })
                    }
                    disabled={disabled}
                    min={0}
                    className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
                  />
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
