"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { Loader2, Save, FolderOpen } from "lucide-react"
import { FileBrowser } from "@/components/shared/file-browser"
import type { Schedule } from "@/types/settings"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function SettingsPage() {
  const { data: settingsData, isLoading: loadingSettings, mutate: mutateSettings } = useSWR<Record<string, string>>(
    "/api/settings",
    fetcher
  )
  const { data: scheduleData, isLoading: loadingSchedule, mutate: mutateSchedule } = useSWR<Schedule>(
    "/api/schedule",
    fetcher
  )
  const { data: systemData } = useSWR<{
    cpu: { usage: number; count: number }
    memory: { total: number; free: number; used: number }
    disk: { total: number; free: number; used: number }
    handbrakeVersion: string
    platform: string
    hostname: string
    tools: { ffprobe: boolean; handbrake: boolean }
  }>("/api/system", fetcher)

  const [settings, setSettings] = useState({
    handbrake_path: "HandBrakeCLI",
    ffprobe_path: "ffprobe",
    concurrent_limit: "1",
    auto_start_queue: "true",
    default_output_dir: "/output",
    default_output_pattern: "{name}_encoded.{ext}",
  })
  const [schedule, setSchedule] = useState<Schedule>({
    id: 1,
    enabled: false,
    mode: "always",
    timeStart: null,
    timeEnd: null,
    daysOfWeek: "0,1,2,3,4,5,6",
    cronExpr: null,
    updatedAt: "",
  })
  const [saving, setSaving] = useState(false)
  const [browsing, setBrowsing] = useState<"handbrake" | "ffprobe" | "output" | null>(null)

  const isWindows = typeof navigator !== "undefined" && navigator.platform?.startsWith("Win")

  useEffect(() => {
    if (settingsData && !("error" in settingsData)) {
      setSettings((prev) => ({ ...prev, ...settingsData }))
    }
  }, [settingsData])

  useEffect(() => {
    if (scheduleData && !("error" in scheduleData)) {
      setSchedule(scheduleData)
    }
  }, [scheduleData])

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all([
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        }),
        fetch("/api/schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(schedule),
        }),
      ])
      mutateSettings()
      mutateSchedule()
    } finally {
      setSaving(false)
    }
  }

  const selectedDays = schedule.daysOfWeek.split(",").filter(Boolean)

  const toggleDay = (dayIndex: string) => {
    const current = new Set(selectedDays)
    if (current.has(dayIndex)) {
      current.delete(dayIndex)
    } else {
      current.add(dayIndex)
    }
    setSchedule({
      ...schedule,
      daysOfWeek: Array.from(current).sort().join(","),
    })
  }

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  if (loadingSettings || loadingSchedule) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
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
          Save Settings
        </button>
      </div>

      {/* General */}
      <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[hsl(var(--card-foreground))]">
          General
        </h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
              HandBrakeCLI Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.handbrake_path}
                onChange={(e) =>
                  setSettings({ ...settings, handbrake_path: e.target.value })
                }
                placeholder={isWindows ? "C:\\HandBrake\\HandBrakeCLI.exe" : "/usr/bin/HandBrakeCLI"}
                className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
              <button
                onClick={() => setBrowsing("handbrake")}
                className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90"
              >
                <FolderOpen className="h-4 w-4" />
                Browse
              </button>
            </div>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {isWindows ? "Select HandBrakeCLI.exe (download from handbrake.fr)" : "Usually /usr/bin/HandBrakeCLI on Linux"}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
              ffprobe Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.ffprobe_path}
                onChange={(e) =>
                  setSettings({ ...settings, ffprobe_path: e.target.value })
                }
                placeholder={isWindows ? "C:\\ffmpeg\\bin\\ffprobe.exe" : "/usr/bin/ffprobe"}
                className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
              <button
                onClick={() => setBrowsing("ffprobe")}
                className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90"
              >
                <FolderOpen className="h-4 w-4" />
                Browse
              </button>
            </div>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {isWindows ? "Select ffprobe.exe (download ffmpeg from gyan.dev/ffmpeg/builds)" : "Usually /usr/bin/ffprobe on Linux. Install: apt install ffmpeg"}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
              Concurrent Encoding Limit (1-8)
            </label>
            <input
              type="number"
              min={1}
              max={8}
              value={settings.concurrent_limit}
              onChange={(e) =>
                setSettings({ ...settings, concurrent_limit: e.target.value })
              }
              className="w-32 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="auto-start"
              checked={settings.auto_start_queue === "true"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  auto_start_queue: e.target.checked ? "true" : "false",
                })
              }
              className="h-4 w-4 rounded border-[hsl(var(--border))] bg-[hsl(var(--input))] accent-[hsl(var(--primary))]"
            />
            <label
              htmlFor="auto-start"
              className="text-sm text-[hsl(var(--card-foreground))]"
            >
              Auto-start queue when tasks are added
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
              Default Output Directory
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.default_output_dir}
                onChange={(e) =>
                  setSettings({ ...settings, default_output_dir: e.target.value })
                }
                placeholder="/path/to/output"
                className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
              <button
                onClick={() => setBrowsing("output")}
                className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm text-[hsl(var(--secondary-foreground))] hover:opacity-90"
              >
                <FolderOpen className="h-4 w-4" />
                Browse
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
              Default Output Naming Pattern
            </label>
            <input
              type="text"
              value={settings.default_output_pattern}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_output_pattern: e.target.value,
                })
              }
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
            />
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              Tokens: {"{name}"}, {"{ext}"}, {"{date}"}, {"{encoder}"}, {"{quality}"}
            </p>
          </div>
        </div>
      </section>

      {/* Schedule */}
      <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[hsl(var(--card-foreground))]">
          Schedule
        </h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="schedule-enabled"
              checked={schedule.enabled}
              onChange={(e) =>
                setSchedule({ ...schedule, enabled: e.target.checked })
              }
              className="h-4 w-4 rounded border-[hsl(var(--border))] bg-[hsl(var(--input))] accent-[hsl(var(--primary))]"
            />
            <label
              htmlFor="schedule-enabled"
              className="text-sm text-[hsl(var(--card-foreground))]"
            >
              Enable scheduling
            </label>
          </div>

          {schedule.enabled && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
                  Mode
                </label>
                <select
                  value={schedule.mode}
                  onChange={(e) =>
                    setSchedule({
                      ...schedule,
                      mode: e.target.value as Schedule["mode"],
                    })
                  }
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
                >
                  <option value="always">Always On</option>
                  <option value="time_window">Time Window</option>
                  <option value="cron">Cron Expression</option>
                </select>
              </div>

              {schedule.mode === "time_window" && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={schedule.timeStart ?? ""}
                      onChange={(e) =>
                        setSchedule({ ...schedule, timeStart: e.target.value })
                      }
                      className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-[hsl(var(--card-foreground))]">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={schedule.timeEnd ?? ""}
                      onChange={(e) =>
                        setSchedule({ ...schedule, timeEnd: e.target.value })
                      }
                      className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
                    />
                  </div>
                </div>
              )}

              {(schedule.mode === "time_window" || schedule.mode === "always") && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-[hsl(var(--card-foreground))]">
                    Days
                  </label>
                  <div className="flex gap-2">
                    {daysOfWeek.map((day, i) => {
                      const dayVal = String(i)
                      const selected = selectedDays.includes(dayVal)
                      return (
                        <button
                          key={day}
                          onClick={() => toggleDay(dayVal)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            selected
                              ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                              : "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:opacity-80"
                          }`}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* System Info */}
      <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[hsl(var(--card-foreground))]">
          System Information
        </h2>
        {systemData && !("error" in systemData) ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">HandBrake Version</span>
              <span className="font-mono text-[hsl(var(--card-foreground))]">
                {systemData.handbrakeVersion}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">Platform</span>
              <span className="font-mono text-[hsl(var(--card-foreground))]">
                {systemData.platform} ({systemData.hostname})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">CPU</span>
              <span className="font-mono text-[hsl(var(--card-foreground))]">
                {systemData.cpu.count} cores, {systemData.cpu.usage}% load
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">Memory</span>
              <span className="font-mono text-[hsl(var(--card-foreground))]">
                {formatBytes(systemData.memory.used)} / {formatBytes(systemData.memory.total)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">Disk Free</span>
              <span className="font-mono text-[hsl(var(--card-foreground))]">
                {formatBytes(systemData.disk.free)} / {formatBytes(systemData.disk.total)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">Database</span>
              <span className="font-mono text-[hsl(var(--card-foreground))]">
                data/handbrake.db
              </span>
            </div>
            {systemData.tools && (
              <>
                <div className="border-t border-[hsl(var(--border))] pt-3 mt-3">
                  <p className="mb-2 text-xs font-medium uppercase text-[hsl(var(--muted-foreground))]">Tools</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">HandBrakeCLI</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                    systemData.tools.handbrake
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${systemData.tools.handbrake ? "bg-green-400" : "bg-red-400"}`} />
                    {systemData.tools.handbrake ? "Available" : "Not found"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">ffprobe</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                    systemData.tools.ffprobe
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${systemData.tools.ffprobe ? "bg-green-400" : "bg-red-400"}`} />
                    {systemData.tools.ffprobe ? "Available" : "Not found"}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading system info...</p>
        )}
      </section>

      {/* File browser dialogs */}
      {browsing === "handbrake" && (
        <FileBrowser
          title={isWindows ? "Select HandBrakeCLI.exe" : "Select HandBrakeCLI binary"}
          fileFilter={isWindows ? [".exe"] : []}
          onSelect={(p) => { setSettings({ ...settings, handbrake_path: p }); setBrowsing(null) }}
          onClose={() => setBrowsing(null)}
        />
      )}
      {browsing === "ffprobe" && (
        <FileBrowser
          title={isWindows ? "Select ffprobe.exe" : "Select ffprobe binary"}
          fileFilter={isWindows ? [".exe"] : []}
          onSelect={(p) => { setSettings({ ...settings, ffprobe_path: p }); setBrowsing(null) }}
          onClose={() => setBrowsing(null)}
        />
      )}
      {browsing === "output" && (
        <FileBrowser
          title="Select Output Directory"
          directoryOnly
          onSelect={(p) => { setSettings({ ...settings, default_output_dir: p }); setBrowsing(null) }}
          onClose={() => setBrowsing(null)}
        />
      )}
    </div>
  )
}
