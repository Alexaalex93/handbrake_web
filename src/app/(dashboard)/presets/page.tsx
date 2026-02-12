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
} from "lucide-react"
import type { Preset } from "@/types/preset"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function PresetsPage() {
  const { data, isLoading, mutate } = useSWR<{ presets: Preset[] }>(
    "/api/presets",
    fetcher
  )
  const [deleting, setDeleting] = useState<number | null>(null)

  const presets = data?.presets ?? []

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
    await fetch(`/api/presets/${id}/default`, { method: "POST" })
    mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Presets</h1>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-4 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90">
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90">
            <Plus className="h-4 w-4" />
            New Preset
          </button>
        </div>
      </div>

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
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
                  Description
                </th>
                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">
                  Default
                </th>
                <th className="px-4 py-3 text-right font-medium text-[hsl(var(--muted-foreground))]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {presets.map((preset) => (
                <tr
                  key={preset.id}
                  className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--accent))]/50"
                >
                  <td className="px-4 py-3 font-medium text-[hsl(var(--card-foreground))]">
                    {preset.name}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {preset.description || "-"}
                  </td>
                  <td className="px-4 py-3">
                    {preset.isDefault ? (
                      <Star className="h-4 w-4 fill-[hsl(var(--warning))] text-[hsl(var(--warning))]" />
                    ) : (
                      <button
                        onClick={() => handleSetDefault(preset.id)}
                        className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--warning))]"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--card-foreground))]">
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
    </div>
  )
}
