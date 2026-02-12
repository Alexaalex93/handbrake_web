"use client"

import { useState } from "react"
import { FileBrowser } from "@/components/shared/file-browser"

interface OutputSettingsProps {
  outputMode: "fixed" | "beside_source"
  outputDir: string
  outputPattern: string
  onOutputModeChange: (mode: "fixed" | "beside_source") => void
  onOutputDirChange: (dir: string) => void
  onOutputPatternChange: (pattern: string) => void
  disabled?: boolean
}

const tokens = [
  { token: "{name}", description: "Original filename without extension" },
  { token: "{ext}", description: "Container extension (mkv, mp4, webm)" },
  { token: "{date}", description: "Current date (YYYY-MM-DD)" },
  { token: "{encoder}", description: "Video encoder name" },
  { token: "{quality}", description: "Quality value (RF or bitrate)" },
]

export function OutputSettings({
  outputMode,
  outputDir,
  outputPattern,
  onOutputModeChange,
  onOutputDirChange,
  onOutputPatternChange,
  disabled = false,
}: OutputSettingsProps) {
  const [showBrowser, setShowBrowser] = useState(false)

  return (
    <div className="space-y-4">
      {/* Output mode */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Output Location
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
            <input
              type="radio"
              name="outputMode"
              value="beside_source"
              checked={outputMode === "beside_source"}
              onChange={() => onOutputModeChange("beside_source")}
              disabled={disabled}
              className="accent-[hsl(var(--primary))]"
            />
            Beside Source File
          </label>
          <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
            <input
              type="radio"
              name="outputMode"
              value="fixed"
              checked={outputMode === "fixed"}
              onChange={() => onOutputModeChange("fixed")}
              disabled={disabled}
              className="accent-[hsl(var(--primary))]"
            />
            Fixed Directory
          </label>
        </div>
      </div>

      {/* Output directory */}
      {outputMode === "fixed" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
            Output Directory
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={outputDir}
              onChange={(e) => onOutputDirChange(e.target.value)}
              disabled={disabled}
              placeholder="/path/to/output"
              className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] disabled:opacity-50"
            />
            {!disabled && (
              <button
                onClick={() => setShowBrowser(true)}
                className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90"
              >
                Browse
              </button>
            )}
          </div>
        </div>
      )}

      {/* Naming pattern */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Naming Pattern
        </label>
        <input
          type="text"
          value={outputPattern}
          onChange={(e) => onOutputPatternChange(e.target.value)}
          disabled={disabled}
          placeholder="{name}-encoded.{ext}"
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] disabled:opacity-50"
        />
      </div>

      {/* Token reference */}
      <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
        <p className="mb-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Available Tokens
        </p>
        <div className="space-y-1">
          {tokens.map((t) => (
            <div key={t.token} className="flex items-center gap-3 text-xs">
              <code className="rounded bg-[hsl(var(--secondary))] px-1.5 py-0.5 font-mono text-[hsl(var(--primary))]">
                {t.token}
              </code>
              <span className="text-[hsl(var(--muted-foreground))]">
                {t.description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {showBrowser && (
        <FileBrowser
          directoryOnly
          onSelect={(path) => {
            onOutputDirChange(path)
            setShowBrowser(false)
          }}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </div>
  )
}
