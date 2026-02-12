"use client"

import { useState } from "react"
import { X, ChevronRight, ChevronLeft, Search, Loader2, AlertCircle } from "lucide-react"
import { FileBrowser } from "@/components/shared/file-browser"
import { VideoSettings } from "@/components/encoding/video-settings"
import { AudioTracks } from "@/components/encoding/audio-tracks"
import { SubtitleTracks } from "@/components/encoding/subtitle-tracks"
import { FiltersPanel } from "@/components/encoding/filters-panel"
import { PictureSettings } from "@/components/encoding/picture-settings"
import { ContainerOptions } from "@/components/encoding/container-options"
import { OutputSettings } from "@/components/encoding/output-settings"
import { DEFAULT_ENCODING_OPTIONS } from "@/types/handbrake"
import type { EncodingOptions, ScanResult } from "@/types/handbrake"

interface CreateTaskDialogProps {
  onClose: () => void
  onCreated: () => void
}

export function CreateTaskDialog({ onClose, onCreated }: CreateTaskDialogProps) {
  const [step, setStep] = useState(1)
  const [sourcePath, setSourcePath] = useState("")
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanError, setScanError] = useState("")
  const [selectedTitle, setSelectedTitle] = useState(0)
  const [options, setOptions] = useState<EncodingOptions>({
    ...DEFAULT_ENCODING_OPTIONS,
  })
  const [outputPath, setOutputPath] = useState("")
  const [outputMode, setOutputMode] = useState<"fixed" | "beside_source">("beside_source")
  const [outputDir, setOutputDir] = useState("")
  const [outputPattern, setOutputPattern] = useState("{name}_encoded.{ext}")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [activeTab, setActiveTab] = useState("video")

  const handleScan = async () => {
    if (!sourcePath) return
    setScanning(true)
    setScanError("")
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath }),
      })
      const data = await res.json()
      if (!res.ok) {
        setScanError(data.error || "Failed to scan file")
        return
      }
      if (data.titles && data.titles.length > 0) {
        setScanResult(data)
        setSelectedTitle(data.mainFeature ?? 0)
      } else {
        setScanError("No titles found in file. The file may not be a valid media file.")
      }
    } catch {
      setScanError("Failed to scan file. Make sure HandBrakeCLI is installed.")
    } finally {
      setScanning(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError("")
    try {
      const fileName = sourcePath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") ?? "output"
      const resolvedOutput =
        outputMode === "fixed"
          ? `${outputDir}/${outputPattern.replace("{name}", fileName).replace("{ext}", options.container.format)}`
          : outputPath || sourcePath.replace(/\.[^.]+$/, `_encoded.${options.container.format}`)

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePath,
          outputPath: resolvedOutput,
          options,
          title: sourcePath.split(/[/\\]/).pop() ?? "Untitled",
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setSubmitError(data.error || "Failed to create task")
        return
      }
      onCreated()
    } catch {
      setSubmitError("Failed to create task")
    } finally {
      setSubmitting(false)
    }
  }

  const tabItems = [
    { key: "video", label: "Video" },
    { key: "audio", label: "Audio" },
    { key: "subtitles", label: "Subtitles" },
    { key: "filters", label: "Filters" },
    { key: "picture", label: "Picture" },
    { key: "container", label: "Container" },
  ]

  // Allow proceeding to step 2 even without scan (scan is optional on dev machines without HB)
  const canProceedFromStep1 = !!sourcePath

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <h2 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
            New Task - Step {step} of 4
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1: Source */}
          {step === 1 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-[hsl(var(--card-foreground))]">
                Source File
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sourcePath}
                  onChange={(e) => setSourcePath(e.target.value)}
                  placeholder="/path/to/video.mkv"
                  className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                />
                <button
                  onClick={() => setShowFileBrowser(true)}
                  className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90"
                >
                  Browse
                </button>
                <button
                  onClick={handleScan}
                  disabled={!sourcePath || scanning}
                  className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
                >
                  {scanning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Scan
                </button>
              </div>

              {scanError && (
                <div className="flex items-start gap-2 rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--destructive))]" />
                  <p className="text-sm text-[hsl(var(--destructive))]">{scanError}</p>
                </div>
              )}

              {scanResult && (
                <div className="rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 p-3">
                  <p className="text-sm text-[hsl(var(--primary))]">
                    Scan complete: {scanResult.titles.length} title(s) found
                  </p>
                </div>
              )}

              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Scan is optional. You can proceed to configure encoding options without scanning.
              </p>

              {showFileBrowser && (
                <FileBrowser
                  onSelect={(path) => {
                    setSourcePath(path)
                    setShowFileBrowser(false)
                  }}
                  onClose={() => setShowFileBrowser(false)}
                />
              )}
            </div>
          )}

          {/* Step 2: Encoding options */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Title selector (only when scan was done) */}
              {scanResult && scanResult.titles.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
                    Title
                  </label>
                  <select
                    value={selectedTitle}
                    onChange={(e) => setSelectedTitle(Number(e.target.value))}
                    className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
                  >
                    {scanResult.titles.map((t) => (
                      <option key={t.index} value={t.index}>
                        Title {t.index} - {t.duration.hours}h{t.duration.minutes}m{t.duration.seconds}s ({t.geometry.width}x{t.geometry.height})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Encoding tabs */}
              <div className="flex gap-1 border-b border-[hsl(var(--border))]">
                {tabItems.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? "border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--card-foreground))]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                {activeTab === "video" && (
                  <VideoSettings
                    value={options.video}
                    onChange={(video) => setOptions({ ...options, video })}
                  />
                )}
                {activeTab === "audio" && (
                  <AudioTracks
                    value={options.audioTracks}
                    onChange={(audioTracks) => setOptions({ ...options, audioTracks })}
                  />
                )}
                {activeTab === "subtitles" && (
                  <SubtitleTracks
                    value={options.subtitleTracks}
                    onChange={(subtitleTracks) => setOptions({ ...options, subtitleTracks })}
                  />
                )}
                {activeTab === "filters" && (
                  <FiltersPanel
                    value={options.filters}
                    onChange={(filters) => setOptions({ ...options, filters })}
                  />
                )}
                {activeTab === "picture" && (
                  <PictureSettings
                    value={options.picture}
                    onChange={(picture) => setOptions({ ...options, picture })}
                  />
                )}
                {activeTab === "container" && (
                  <ContainerOptions
                    value={options.container}
                    onChange={(container) => setOptions({ ...options, container })}
                  />
                )}
              </div>
            </div>
          )}

          {/* Step 3: Output */}
          {step === 3 && (
            <OutputSettings
              outputMode={outputMode}
              outputDir={outputDir}
              outputPattern={outputPattern}
              onOutputModeChange={setOutputMode}
              onOutputDirChange={setOutputDir}
              onOutputPatternChange={setOutputPattern}
            />
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-[hsl(var(--card-foreground))]">
                Review
              </h3>
              <div className="space-y-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Source</span>
                  <span className="text-[hsl(var(--card-foreground))] max-w-[300px] truncate">{sourcePath}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Encoder</span>
                  <span className="text-[hsl(var(--card-foreground))]">{options.video.encoder}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Quality</span>
                  <span className="text-[hsl(var(--card-foreground))]">
                    {options.video.qualityMode === "crf"
                      ? `RF ${options.video.quality}`
                      : `${options.video.bitrate} kbps`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Container</span>
                  <span className="text-[hsl(var(--card-foreground))]">{options.container.format}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Audio Tracks</span>
                  <span className="text-[hsl(var(--card-foreground))]">{options.audioTracks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Subtitle Tracks</span>
                  <span className="text-[hsl(var(--card-foreground))]">{options.subtitleTracks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Output</span>
                  <span className="text-[hsl(var(--card-foreground))]">
                    {outputMode === "fixed" ? outputDir : "Beside source"}
                  </span>
                </div>
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--destructive))]" />
                  <p className="text-sm text-[hsl(var(--destructive))]">{submitError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[hsl(var(--border))] px-6 py-4">
          <button
            onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
            className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-4 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !canProceedFromStep1}
              className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Task
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
