"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import { VideoSettings } from "@/components/encoding/video-settings"
import { AudioTracks } from "@/components/encoding/audio-tracks"
import { SubtitleTracks } from "@/components/encoding/subtitle-tracks"
import { FiltersPanel } from "@/components/encoding/filters-panel"
import { PictureSettings } from "@/components/encoding/picture-settings"
import { ContainerOptions } from "@/components/encoding/container-options"
import { OutputSettings } from "@/components/encoding/output-settings"
import { TaskProgress } from "@/components/queue/task-progress"
import type { Task } from "@/types/task"
import type { EncodingOptions } from "@/types/handbrake"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const tabs = [
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
  { key: "subtitles", label: "Subtitles" },
  { key: "filters", label: "Filters" },
  { key: "picture", label: "Picture" },
  { key: "container", label: "Container" },
  { key: "output", label: "Output" },
]

export default function TaskDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [activeTab, setActiveTab] = useState("video")
  const [saving, setSaving] = useState(false)

  const { data, isLoading, mutate } = useSWR<Task>(
    `/api/tasks/${id}`,
    fetcher,
    { refreshInterval: 5000, keepPreviousData: true }
  )

  const task = data
  const [options, setOptions] = useState<EncodingOptions | null>(null)

  // Sync options from server on first load
  if (task && !options) {
    // Using a ref-like pattern: only set once
    setOptions(task.options)
  }

  const isEditable =
    task?.status === "pending" || task?.status === "queued"

  const handleSave = async () => {
    if (!options) return
    setSaving(true)
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options }),
      })
      mutate()
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !task || !options) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/queue"
          className="rounded p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {task.sourcePath}
          </p>
        </div>
        {isEditable && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </button>
        )}
      </div>

      {/* Live progress if encoding */}
      {task.status === "encoding" && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <h3 className="mb-2 text-sm font-medium text-[hsl(var(--card-foreground))]">
            Live Progress
          </h3>
          <TaskProgress
            progress={task.progress}
            eta={task.etaSeconds}
            fps={task.fps}
            avgFps={task.avgFps}
          />
        </div>
      )}

      {/* Error message if failed */}
      {task.status === "failed" && task.errorMessage && (
        <div className="rounded-lg border border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 p-4">
          <p className="text-sm text-[hsl(var(--destructive))]">
            {task.errorMessage}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-[hsl(var(--border))]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--card-foreground))]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        {activeTab === "video" && (
          <VideoSettings
            value={options.video}
            onChange={(video) =>
              isEditable && setOptions({ ...options, video })
            }
            disabled={!isEditable}
          />
        )}
        {activeTab === "audio" && (
          <AudioTracks
            value={options.audioTracks}
            onChange={(audioTracks) =>
              isEditable && setOptions({ ...options, audioTracks })
            }
            allPassthrough={options.allAudioPassthrough ?? false}
            onAllPassthroughChange={(allAudioPassthrough) =>
              isEditable && setOptions({ ...options, allAudioPassthrough })
            }
            disabled={!isEditable}
          />
        )}
        {activeTab === "subtitles" && (
          <SubtitleTracks
            value={options.subtitleTracks}
            onChange={(subtitleTracks) =>
              isEditable && setOptions({ ...options, subtitleTracks })
            }
            allSubtitles={options.allSubtitles ?? false}
            onAllSubtitlesChange={(allSubtitles) =>
              isEditable && setOptions({ ...options, allSubtitles })
            }
            disabled={!isEditable}
          />
        )}
        {activeTab === "filters" && (
          <FiltersPanel
            value={options.filters}
            onChange={(filters) =>
              isEditable && setOptions({ ...options, filters })
            }
            disabled={!isEditable}
          />
        )}
        {activeTab === "picture" && (
          <PictureSettings
            value={options.picture}
            onChange={(picture) =>
              isEditable && setOptions({ ...options, picture })
            }
            disabled={!isEditable}
          />
        )}
        {activeTab === "container" && (
          <ContainerOptions
            value={options.container}
            onChange={(container) =>
              isEditable && setOptions({ ...options, container })
            }
            disabled={!isEditable}
          />
        )}
        {activeTab === "output" && (
          <OutputSettings
            outputMode={task.outputPath ? "fixed" : "beside_source"}
            outputDir={task.outputPath}
            outputPattern=""
            onOutputModeChange={() => {}}
            onOutputDirChange={() => {}}
            onOutputPatternChange={() => {}}
            disabled={!isEditable}
          />
        )}
      </div>
    </div>
  )
}
