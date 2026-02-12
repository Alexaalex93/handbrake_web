export interface Settings {
  concurrent_limit: string
  handbrake_path: string
  default_output_dir: string
  default_output_pattern: string
  auto_start_queue: string
}

export interface Schedule {
  id: number
  enabled: boolean
  mode: "always" | "time_window" | "cron"
  timeStart: string | null
  timeEnd: string | null
  daysOfWeek: string
  cronExpr: string | null
  updatedAt: string
}
