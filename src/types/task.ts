import type { EncodingOptions, ScanResult } from "./handbrake"

export type TaskStatus =
  | "pending"
  | "queued"
  | "encoding"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"

export interface Task {
  id: number
  title: string
  sourcePath: string
  outputPath: string
  status: TaskStatus
  priority: number
  sortOrder: number
  presetId: number | null
  options: EncodingOptions
  progress: number
  etaSeconds: number
  fps: number
  avgFps: number
  passCurrent: number
  passTotal: number
  fileSize: number
  errorMessage: string | null
  sourceInfo: ScanResult | null
  deleteSource: boolean
  replaceSource: boolean
  watcherId: number | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface TaskHistory {
  id: number
  originalTaskId: number | null
  title: string
  sourcePath: string
  outputPath: string
  status: "completed" | "failed" | "cancelled"
  options: EncodingOptions
  presetName: string | null
  fileSizeIn: number | null
  fileSizeOut: number | null
  encodingTime: number | null
  errorMessage: string | null
  watcherName: string | null
  createdAt: string
  completedAt: string
}

export interface CreateTaskInput {
  title?: string
  sourcePath: string
  outputPath: string
  options: EncodingOptions
  presetId?: number
  priority?: number
  deleteSource?: boolean
  replaceSource?: boolean
}
