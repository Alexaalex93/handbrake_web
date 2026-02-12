"use client"

import type { VideoOptions, VideoEncoder, EncoderPreset, EncoderTune } from "@/types/handbrake"

const encoders: { value: VideoEncoder; label: string }[] = [
  { value: "x264", label: "H.264 (x264)" },
  { value: "x264_10bit", label: "H.264 10-bit (x264)" },
  { value: "x265", label: "H.265 (x265)" },
  { value: "x265_10bit", label: "H.265 10-bit (x265)" },
  { value: "x265_12bit", label: "H.265 12-bit (x265)" },
  { value: "nvenc_h264", label: "H.264 (NVENC)" },
  { value: "nvenc_h265", label: "H.265 (NVENC)" },
  { value: "vce_h264", label: "H.264 (AMD VCE)" },
  { value: "vce_h265", label: "H.265 (AMD VCE)" },
  { value: "svt_av1", label: "AV1 (SVT)" },
  { value: "svt_av1_10bit", label: "AV1 10-bit (SVT)" },
  { value: "VP9", label: "VP9" },
  { value: "VP9_10bit", label: "VP9 10-bit" },
  { value: "mpeg4", label: "MPEG-4" },
  { value: "mpeg2", label: "MPEG-2" },
  { value: "theora", label: "Theora" },
]

const presets: EncoderPreset[] = [
  "ultrafast", "superfast", "veryfast", "faster", "fast",
  "medium", "slow", "slower", "veryslow", "placebo",
]

const tunes: { value: EncoderTune; label: string }[] = [
  { value: "none", label: "None" },
  { value: "film", label: "Film" },
  { value: "animation", label: "Animation" },
  { value: "grain", label: "Grain" },
  { value: "stillimage", label: "Still Image" },
  { value: "psnr", label: "PSNR" },
  { value: "ssim", label: "SSIM" },
  { value: "fastdecode", label: "Fast Decode" },
  { value: "zerolatency", label: "Zero Latency" },
]

interface VideoSettingsProps {
  value: VideoOptions
  onChange: (value: VideoOptions) => void
  disabled?: boolean
}

export function VideoSettings({ value, onChange, disabled = false }: VideoSettingsProps) {
  const update = (patch: Partial<VideoOptions>) => {
    onChange({ ...value, ...patch })
  }

  return (
    <div className="space-y-4">
      {/* Encoder */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Video Encoder
        </label>
        <select
          value={value.encoder}
          onChange={(e) => update({ encoder: e.target.value as VideoEncoder })}
          disabled={disabled}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
        >
          {encoders.map((enc) => (
            <option key={enc.value} value={enc.value}>
              {enc.label}
            </option>
          ))}
        </select>
      </div>

      {/* Quality mode */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Quality Mode
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
            <input
              type="radio"
              name="qualityMode"
              value="crf"
              checked={value.qualityMode === "crf"}
              onChange={() => update({ qualityMode: "crf" })}
              disabled={disabled}
              className="accent-[hsl(var(--primary))]"
            />
            Constant Quality (RF)
          </label>
          <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
            <input
              type="radio"
              name="qualityMode"
              value="bitrate"
              checked={value.qualityMode === "bitrate"}
              onChange={() => update({ qualityMode: "bitrate" })}
              disabled={disabled}
              className="accent-[hsl(var(--primary))]"
            />
            Average Bitrate
          </label>
        </div>
      </div>

      {/* CRF slider */}
      {value.qualityMode === "crf" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
            Quality (RF): {value.quality}
          </label>
          <input
            type="range"
            min={0}
            max={51}
            value={value.quality}
            onChange={(e) => update({ quality: Number(e.target.value) })}
            disabled={disabled}
            className="w-full accent-[hsl(var(--primary))]"
          />
          <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
            <span>0 (Lossless)</span>
            <span>51 (Worst)</span>
          </div>
        </div>
      )}

      {/* Bitrate input */}
      {value.qualityMode === "bitrate" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
            Bitrate (kbps)
          </label>
          <input
            type="number"
            value={value.bitrate ?? 5000}
            onChange={(e) => update({ bitrate: Number(e.target.value) })}
            disabled={disabled}
            min={100}
            className="w-48 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
          />
        </div>
      )}

      {/* Encoder Preset */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Encoder Preset
        </label>
        <select
          value={value.encoderPreset}
          onChange={(e) =>
            update({ encoderPreset: e.target.value as EncoderPreset })
          }
          disabled={disabled}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
        >
          {presets.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Encoder Tune */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Encoder Tune
        </label>
        <select
          value={value.encoderTune}
          onChange={(e) =>
            update({ encoderTune: e.target.value as EncoderTune })
          }
          disabled={disabled}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
        >
          {tunes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Multi-pass */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
          <input
            type="checkbox"
            checked={value.multiPass}
            onChange={(e) => update({ multiPass: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
          />
          Multi-pass Encoding
        </label>

        {value.multiPass && (
          <label className="flex items-center gap-2 text-sm text-[hsl(var(--card-foreground))]">
            <input
              type="checkbox"
              checked={value.turboFirstPass}
              onChange={(e) =>
                update({ turboFirstPass: e.target.checked })
              }
              disabled={disabled}
              className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
            />
            Turbo First Pass
          </label>
        )}
      </div>

      {/* Advanced Options */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
          Advanced Options
        </label>
        <input
          type="text"
          value={value.advancedOptions ?? ""}
          onChange={(e) => update({ advancedOptions: e.target.value })}
          disabled={disabled}
          placeholder="e.g. ref=5:bframes=5"
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Raw encoder options (encopts). Use with caution.
        </p>
      </div>
    </div>
  )
}
