"use client"

import { Plus, Trash2 } from "lucide-react"
import type { AudioTrack, AudioEncoder, AudioMixdown } from "@/types/handbrake"

const audioEncoders: { value: AudioEncoder; label: string }[] = [
  { value: "copy", label: "Auto Passthru" },
  { value: "copy:aac", label: "AAC Passthru" },
  { value: "copy:ac3", label: "AC3 Passthru" },
  { value: "copy:eac3", label: "E-AC3 Passthru" },
  { value: "copy:truehd", label: "TrueHD Passthru" },
  { value: "copy:dts", label: "DTS Passthru" },
  { value: "copy:dtshd", label: "DTS-HD Passthru" },
  { value: "copy:mp3", label: "MP3 Passthru" },
  { value: "copy:flac", label: "FLAC Passthru" },
  { value: "av_aac", label: "AAC (avcodec)" },
  { value: "ac3", label: "AC3" },
  { value: "eac3", label: "E-AC3" },
  { value: "mp3", label: "MP3" },
  { value: "opus", label: "Opus" },
  { value: "vorbis", label: "Vorbis" },
  { value: "flac16", label: "FLAC 16-bit" },
  { value: "flac24", label: "FLAC 24-bit" },
  { value: "alac16", label: "ALAC 16-bit" },
  { value: "alac24", label: "ALAC 24-bit" },
]

const mixdowns: { value: AudioMixdown; label: string }[] = [
  { value: "mono", label: "Mono" },
  { value: "left_only", label: "Left Only" },
  { value: "right_only", label: "Right Only" },
  { value: "stereo", label: "Stereo" },
  { value: "dpl1", label: "Dolby Pro Logic" },
  { value: "dpl2", label: "Dolby Pro Logic II" },
  { value: "5point1", label: "5.1 Surround" },
  { value: "6point1", label: "6.1 Surround" },
  { value: "7point1", label: "7.1 Surround" },
  { value: "5_2_lfe", label: "5.2 LFE" },
]

const sampleRates = ["auto", "8000", "11025", "22050", "44100", "48000"]

interface AudioTracksProps {
  value: AudioTrack[]
  onChange: (value: AudioTrack[]) => void
  disabled?: boolean
}

export function AudioTracks({ value, onChange, disabled = false }: AudioTracksProps) {
  const addTrack = () => {
    onChange([
      ...value,
      {
        track: value.length + 1,
        encoder: "copy",
        mixdown: "stereo",
        bitrate: 160,
        sampleRate: "auto",
        gain: 0,
        drc: 0,
      },
    ])
  }

  const removeTrack = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const updateTrack = (index: number, patch: Partial<AudioTrack>) => {
    onChange(
      value.map((t, i) => (i === index ? { ...t, ...patch } : t))
    )
  }

  return (
    <div className="space-y-4">
      {value.length === 0 && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No audio tracks configured.
        </p>
      )}

      {value.map((track, index) => (
        <div
          key={index}
          className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-[hsl(var(--card-foreground))]">
              Track {index + 1}
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

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-[hsl(var(--muted-foreground))]">
                Encoder
              </label>
              <select
                value={track.encoder}
                onChange={(e) =>
                  updateTrack(index, {
                    encoder: e.target.value as AudioEncoder,
                  })
                }
                disabled={disabled}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
              >
                {audioEncoders.map((enc) => (
                  <option key={enc.value} value={enc.value}>
                    {enc.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[hsl(var(--muted-foreground))]">
                Mixdown
              </label>
              <select
                value={track.mixdown}
                onChange={(e) =>
                  updateTrack(index, {
                    mixdown: e.target.value as AudioMixdown,
                  })
                }
                disabled={disabled}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
              >
                {mixdowns.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[hsl(var(--muted-foreground))]">
                Bitrate (kbps)
              </label>
              <input
                type="number"
                value={track.bitrate}
                onChange={(e) =>
                  updateTrack(index, { bitrate: Number(e.target.value) })
                }
                disabled={disabled}
                min={32}
                max={1536}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-[hsl(var(--muted-foreground))]">
                Sample Rate
              </label>
              <select
                value={String(track.sampleRate)}
                onChange={(e) =>
                  updateTrack(index, {
                    sampleRate:
                      e.target.value === "auto"
                        ? "auto"
                        : Number(e.target.value),
                  })
                }
                disabled={disabled}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-50"
              >
                {sampleRates.map((sr) => (
                  <option key={sr} value={sr}>
                    {sr === "auto" ? "Auto" : `${sr} Hz`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[hsl(var(--muted-foreground))]">
                Gain (dB): {track.gain}
              </label>
              <input
                type="range"
                min={-20}
                max={20}
                value={track.gain}
                onChange={(e) =>
                  updateTrack(index, { gain: Number(e.target.value) })
                }
                disabled={disabled}
                className="w-full accent-[hsl(var(--primary))]"
              />
            </div>
          </div>
        </div>
      ))}

      {!disabled && (
        <button
          onClick={addTrack}
          className="inline-flex items-center gap-2 rounded-md border border-dashed border-[hsl(var(--border))] px-4 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
        >
          <Plus className="h-4 w-4" />
          Add Audio Track
        </button>
      )}
    </div>
  )
}
