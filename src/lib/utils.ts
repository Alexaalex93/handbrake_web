import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function formatETA(seconds: number): string {
  if (seconds <= 0) return "--"
  return formatDuration(seconds)
}

export function resolveOutputPath(
  sourcePath: string,
  outputMode: "fixed" | "beside_source",
  outputDir: string | null,
  pattern: string,
  containerExt: string,
  encoder?: string,
  quality?: number
): string {
  const path = require("path")
  const sourceDir = path.dirname(sourcePath)
  const sourceName = path.basename(sourcePath, path.extname(sourcePath))
  const date = new Date().toISOString().split("T")[0]

  let filename = pattern
    .replace("{name}", sourceName)
    .replace("{ext}", containerExt)
    .replace("{date}", date)
    .replace("{encoder}", encoder || "x264")
    .replace("{quality}", quality?.toString() || "22")

  const baseDir = outputMode === "fixed" ? (outputDir || sourceDir) : sourceDir
  return path.join(baseDir, filename)
}
