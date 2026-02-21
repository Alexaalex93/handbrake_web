import { getDb } from "@/lib/db"
import type { DaySchedule } from "@/types/settings"

export function isEncodingAllowed(): boolean {
  const db = getDb()
  const schedule = db.prepare("SELECT * FROM schedule WHERE id = 1").get() as any
  if (!schedule || !schedule.enabled) return true

  const mode = schedule.mode
  if (mode === "always") return true

  if (mode === "time_window") {
    return isWithinTimeWindow(schedule.time_start, schedule.time_end, schedule.days_of_week)
  }

  if (mode === "per_day") {
    return isWithinDaySchedule(schedule.day_schedules)
  }

  if (mode === "cron") {
    return true // TODO: implement cron evaluation if needed
  }

  return true
}

function isWithinTimeWindow(
  timeStart: string | null,
  timeEnd: string | null,
  daysOfWeek: string | null
): boolean {
  if (!timeStart || !timeEnd) return true

  const now = new Date()
  const currentDay = now.getDay() // 0=Sun, 6=Sat

  // Check day of week
  if (daysOfWeek) {
    const allowedDays = daysOfWeek.split(",").map(d => parseInt(d.trim()))
    if (!allowedDays.includes(currentDay)) return false
  }

  return isTimeInRange(timeStart, timeEnd, now)
}

function isWithinDaySchedule(daySchedulesJson: string | null): boolean {
  if (!daySchedulesJson) return true

  let daySchedules: Record<string, DaySchedule>
  try {
    daySchedules = JSON.parse(daySchedulesJson)
  } catch {
    return true
  }

  const now = new Date()
  const currentDay = String(now.getDay()) // 0=Sun, 6=Sat

  const dayConfig = daySchedules[currentDay]
  if (!dayConfig || !dayConfig.enabled) return false

  return isTimeInRange(dayConfig.start, dayConfig.end, now)
}

function isTimeInRange(timeStart: string, timeEnd: string, now: Date): boolean {
  const [startH, startM] = timeStart.split(":").map(Number)
  const [endH, endM] = timeEnd.split(":").map(Number)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  // Same start and end = full 24 hours (always allowed)
  if (startMinutes === endMinutes) return true

  // Handle overnight windows (e.g., 22:00 - 06:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes
}
