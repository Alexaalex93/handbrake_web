export interface Settings {
  concurrent_limit: string
  handbrake_path: string
  default_output_dir: string
  default_output_pattern: string
  auto_start_queue: string
}

export interface DaySchedule {
  enabled: boolean
  start: string   // "HH:MM"
  end: string     // "HH:MM"
}

// Map day index (0=Mon...6=Sun) to schedule for that day
export type DaySchedules = Record<string, DaySchedule>

export interface Schedule {
  id: number
  enabled: boolean
  mode: "always" | "time_window" | "per_day" | "cron"
  timeStart: string | null
  timeEnd: string | null
  daysOfWeek: string
  daySchedules: DaySchedules | null
  cronExpr: string | null
  updatedAt: string
}
