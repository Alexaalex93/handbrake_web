"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { Loader2, Save } from "lucide-react"
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
  }>("/api/system", fetcher)

  const [settings, setSettings] = useState({
    handbrake_path: "HandBrakeCLI",
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
            <input
              type="text"
              value={settings.handbrake_path}
              onChange={(e) =>
                setSettings({ ...settings, handbrake_path: e.target.value })
              }
              placeholder="/usr/bin/HandBrakeCLI"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
            />
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
            <input
              type="text"
              value={settings.default_output_dir}
              onChange={(e) =>
                setSettings({ ...settings, default_output_dir: e.target.value })
              }
              placeholder="/path/to/output"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
            />
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
          </div>
        ) : (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading system info...</p>
        )}
      </section>
    </div>
  )
}
