"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Plus,
  Upload,
  Pencil,
  Trash2,
  Star,
  Loader2,
  X,
} from "lucide-react"
import { VideoSettings } from "@/components/encoding/video-settings"
import { AudioTracks } from "@/components/encoding/audio-tracks"
import { SubtitleTracks } from "@/components/encoding/subtitle-tracks"
import { FiltersPanel } from "@/components/encoding/filters-panel"
import { PictureSettings } from "@/components/encoding/picture-settings"
import { ContainerOptions } from "@/components/encoding/container-options"
import { DEFAULT_ENCODING_OPTIONS } from "@/types/handbrake"
import type { EncodingOptions } from "@/types/handbrake"
import type { Preset } from "@/types/preset"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function PresetDialog({
  preset,
  onClose,
  onSaved,
}: {
  preset?: Preset
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(preset?.name ?? "")
  const [description, setDescription] = useState(preset?.description ?? "")
  const [options, setOptions] = useState<EncodingOptions>(
    preset?.options ?? { ...DEFAULT_ENCODING_OPTIONS }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("video")

  const tabItems = [
    { key: "video", label: "Video" },
    { key: "audio", label: "Audio" },
    { key: "subtitles", label: "Subtitles" },
    { key: "filters", label: "Filters" },
    { key: "picture", label: "Picture" },
    { key: "container", label: "Container" },
  ]

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    setSaving(true)
    setError("")
    try {
      const url = preset ? `/api/presets/${preset.id}` : "/api/presets"
      const method = preset ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, options }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to save preset")
        return
      }
      onSaved()
    } catch {
      setError("Failed to save preset")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mx-4 flex h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <h2 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
            {preset ? "Edit Preset" : "New Preset"}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Preset"
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>
          </div>

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

          <div className="min-h-[350px] pt-2">
            {activeTab === "video" && (
              <VideoSettings value={options.video} onChange={(video) => setOptions({ ...options, video })} />
            )}
            {activeTab === "audio" && (
              <AudioTracks value={options.audioTracks} onChange={(audioTracks) => setOptions({ ...options, audioTracks })} />
            )}
            {activeTab === "subtitles" && (
              <SubtitleTracks value={options.subtitleTracks} onChange={(subtitleTracks) => setOptions({ ...options, subtitleTracks })} />
            )}
            {activeTab === "filters" && (
              <FiltersPanel value={options.filters} onChange={(filters) => setOptions({ ...options, filters })} />
            )}
            {activeTab === "picture" && (
              <PictureSettings value={options.picture} onChange={(picture) => setOptions({ ...options, picture })} />
            )}
            {activeTab === "container" && (
              <ContainerOptions value={options.container} onChange={(container) => setOptions({ ...options, container })} />
            )}
          </div>

          {error && (
            <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[hsl(var(--border))] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-4 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {preset ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PresetsPage() {
  const { data, isLoading, mutate } = useSWR<Preset[]>(
    "/api/presets",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )
  const [deleting, setDeleting] = useState<number | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingPreset, setEditingPreset] = useState<Preset | undefined>(undefined)
  const [importError, setImportError] = useState("")

  const presets = Array.isArray(data) ? data : []

  const handleDelete = async (id: number) => {
    setDeleting(id)
    try {
      await fetch(`/api/presets/${id}`, { method: "DELETE" })
      mutate()
    } finally {
      setDeleting(null)
    }
  }

  const handleSetDefault = async (id: number) => {
    await fetch(`/api/presets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    })
    mutate()
  }

  const handleImport = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const json = JSON.parse(text)
        const res = await fetch("/api/presets/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(json),
        })
        if (!res.ok) {
          const data = await res.json()
          setImportError(data.error || "Failed to import")
        } else {
          mutate()
          setImportError("")
        }
      } catch {
        setImportError("Failed to parse JSON file")
      }
    }
    input.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Presets</h1>
        <div className="flex gap-2">
          <button
            onClick={handleImport}
            className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-4 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90"
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button
            onClick={() => {
              setEditingPreset(undefined)
              setShowDialog(true)
            }}
            className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New Preset
          </button>
        </div>
      </div>

      {importError && (
        <p className="text-sm text-[hsl(var(--destructive))]">{importError}</p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : presets.length === 0 ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
          <p className="text-[hsl(var(--muted-foreground))]">
            No presets configured. Create one or import from a file.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Name</th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Description</th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Encoder</th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Default</th>
                <th className="px-4 py-3 text-right font-medium text-[hsl(var(--muted-foreground))]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {presets.map((preset) => (
                <tr
                  key={preset.id}
                  className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--accent))]/50"
                >
                  <td className="px-4 py-3 font-medium text-[hsl(var(--card-foreground))]">{preset.name}</td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{preset.description || "-"}</td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{preset.options?.video?.encoder || "-"}</td>
                  <td className="px-4 py-3">
                    {preset.isDefault ? (
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    ) : (
                      <button
                        onClick={() => handleSetDefault(preset.id)}
                        className="text-[hsl(var(--muted-foreground))] hover:text-yellow-500"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditingPreset(preset)
                          setShowDialog(true)
                        }}
                        className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--card-foreground))]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(preset.id)}
                        disabled={deleting === preset.id}
                        className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--destructive))]"
                      >
                        {deleting === preset.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDialog && (
        <PresetDialog
          preset={editingPreset}
          onClose={() => setShowDialog(false)}
          onSaved={() => {
            setShowDialog(false)
            mutate()
          }}
        />
      )}
    </div>
  )
}
