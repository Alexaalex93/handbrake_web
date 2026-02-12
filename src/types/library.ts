export interface Library {
  id: number
  name: string
  path: string
  recursive: boolean
  fileExtensions: string
  autoScan: boolean
  scanInterval: number
  lastScanAt: string | null
  createdAt: string
  itemCount?: number
}

export interface LibraryItem {
  id: number
  libraryId: number
  filePath: string
  fileName: string
  fileSize: number
  fileMtime: string | null
  duration: number | null
  width: number | null
  height: number | null
  videoCodec: string | null
  videoBitrate: number | null
  audioCodec: string | null
  audioChannels: number | null
  audioBitrate: number | null
  subtitleCount: number
  container: string | null
  scanStatus: "pending" | "scanned" | "error"
  scanError: string | null
  createdAt: string
  updatedAt: string
}

export interface LibraryStats {
  totalItems: number
  totalSize: number
  codecDistribution: { codec: string; count: number }[]
}
