export type OutputMode = "fixed" | "beside_source"

export interface WatchedFolder {
  id: number
  path: string
  enabled: boolean
  recursive: boolean
  scanInterval: number  // minutes
  fileExtensions: string
  presetId: number | null
  outputMode: OutputMode
  outputDir: string | null
  outputPattern: string
  minFileSize: number
  lastScanAt: string | null
  createdAt: string
}

export interface ScannedFile {
  id: number
  watcherId: number
  filePath: string
  fileSize: number
  fileMtime: string
  status: "detected" | "queued" | "completed" | "skipped"
  taskId: number | null
  createdAt: string
}
