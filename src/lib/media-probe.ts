import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import os from "os"

export interface MediaInfo {
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
}

// Cache tool availability to avoid repeated failed execSync calls
let _ffprobePath: string | null | undefined = undefined // undefined = not checked yet
let _handBrakePath: string | null | undefined = undefined

/** Reset cached paths (call when settings change) */
export function resetProbeCache() {
  _ffprobePath = undefined
  _handBrakePath = undefined
}

/** Find ffprobe binary: check DB setting, PATH, then common install locations */
function findFfprobe(): string | null {
  if (_ffprobePath !== undefined) return _ffprobePath

  // Check DB setting first
  try {
    const { getDb } = require("@/lib/db")
    const db = getDb()
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("ffprobe_path") as { value: string } | undefined
    if (row?.value && row.value !== "ffprobe") {
      // User specified a custom path
      execSync(`"${row.value}" -version`, { encoding: "utf-8", timeout: 5000, stdio: "pipe" })
      _ffprobePath = row.value
      return _ffprobePath
    }
  } catch {
    // DB not available or custom path failed
  }

  // Try PATH
  try {
    execSync("ffprobe -version", { encoding: "utf-8", timeout: 5000, stdio: "pipe" })
    _ffprobePath = "ffprobe"
    return _ffprobePath
  } catch {
    // Not in PATH
  }

  // Check common Windows locations
  if (os.platform() === "win32") {
    const commonPaths = [
      "C:\\ffmpeg\\bin\\ffprobe.exe",
      "C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe",
      "C:\\Program Files (x86)\\ffmpeg\\bin\\ffprobe.exe",
      path.join(os.homedir(), "scoop", "apps", "ffmpeg", "current", "bin", "ffprobe.exe"),
      path.join(os.homedir(), "AppData", "Local", "Programs", "ffmpeg", "bin", "ffprobe.exe"),
    ]
    for (const p of commonPaths) {
      try {
        if (fs.existsSync(p)) {
          _ffprobePath = p
          return _ffprobePath
        }
      } catch {
        // skip
      }
    }
  }

  _ffprobePath = null
  return null
}

/** Find HandBrakeCLI binary */
function findHandBrake(): string | null {
  if (_handBrakePath !== undefined) return _handBrakePath

  try {
    // Try importing the configured path from settings
    const { getDb } = require("@/lib/db")
    const db = getDb()
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("handbrake_path") as { value: string } | undefined
    const hbPath = row?.value || "HandBrakeCLI"

    execSync(`"${hbPath}" --version`, { encoding: "utf-8", timeout: 5000, stdio: "pipe" })
    _handBrakePath = hbPath
    return _handBrakePath
  } catch {
    // Not available
  }

  _handBrakePath = null
  return null
}

/** Check which probe tools are available */
export function getProbeStatus(): { ffprobe: boolean; handbrake: boolean } {
  return {
    ffprobe: findFfprobe() !== null,
    handbrake: findHandBrake() !== null,
  }
}

/**
 * Probe media file info using ffprobe (preferred) or HandBrakeCLI --scan.
 * Returns basic codec/resolution/duration info for library scanning.
 */
export function probeMediaFile(filePath: string): MediaInfo {
  const ffprobe = findFfprobe()
  if (ffprobe) {
    try {
      return probeWithFfprobe(ffprobe, filePath)
    } catch {
      // ffprobe failed for this file, try HandBrake
    }
  }

  const hb = findHandBrake()
  if (hb) {
    try {
      return probeWithHandBrake(hb, filePath)
    } catch {
      // HandBrake also failed
    }
  }

  // No tools available — return basic info from file extension
  const ext = path.extname(filePath).toLowerCase().replace(".", "")
  return {
    duration: null,
    width: null,
    height: null,
    videoCodec: null,
    videoBitrate: null,
    audioCodec: null,
    audioChannels: null,
    audioBitrate: null,
    subtitleCount: 0,
    container: ext || null,
  }
}

function probeWithFfprobe(ffprobePath: string, filePath: string): MediaInfo {
  const output = execSync(
    `"${ffprobePath}" -v quiet -print_format json -show_format -show_streams "${filePath}"`,
    { encoding: "utf-8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] }
  )
  const data = JSON.parse(output)

  const videoStream = data.streams?.find((s: any) => s.codec_type === "video")
  const audioStream = data.streams?.find((s: any) => s.codec_type === "audio")
  const subtitleStreams = data.streams?.filter((s: any) => s.codec_type === "subtitle") || []
  const format = data.format

  return {
    duration: format?.duration ? parseFloat(format.duration) : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    videoCodec: normalizeCodecName(videoStream?.codec_name) ?? null,
    videoBitrate: videoStream?.bit_rate ? Math.round(parseInt(videoStream.bit_rate) / 1000) : (format?.bit_rate ? Math.round(parseInt(format.bit_rate) / 1000) : null),
    audioCodec: normalizeAudioCodec(audioStream?.codec_name) ?? null,
    audioChannels: audioStream?.channels ?? null,
    audioBitrate: audioStream?.bit_rate ? Math.round(parseInt(audioStream.bit_rate) / 1000) : null,
    subtitleCount: subtitleStreams.length,
    container: format?.format_name?.split(",")[0] ?? null,
  }
}

function probeWithHandBrake(hbPath: string, filePath: string): MediaInfo {
  const output = execSync(
    `"${hbPath}" -i "${filePath}" --scan --json -t 1 2>&1`,
    { encoding: "utf-8", timeout: 60000, stdio: ["pipe", "pipe", "pipe"] }
  )

  // Extract JSON from HandBrakeCLI output
  const jsonMatch = output.match(/\{[\s\S]*"TitleList"[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error("No JSON output from HandBrakeCLI")
  }

  const data = JSON.parse(jsonMatch[0])
  const title = data.TitleList?.[0]
  if (!title) {
    throw new Error("No title found")
  }

  const duration = title.Duration
    ? (title.Duration.Hours * 3600 + title.Duration.Minutes * 60 + title.Duration.Seconds)
    : null

  const videoTrack = title.VideoCodec || null
  const audioTrack = title.AudioList?.[0]
  const subtitleCount = title.SubtitleList?.length || 0

  return {
    duration,
    width: title.Geometry?.Width ?? null,
    height: title.Geometry?.Height ?? null,
    videoCodec: normalizeCodecName(videoTrack),
    videoBitrate: null,
    audioCodec: audioTrack?.CodecName ?? null,
    audioChannels: null,
    audioBitrate: audioTrack?.BitRate ? Math.round(audioTrack.BitRate / 1000) : null,
    subtitleCount,
    container: path.extname(filePath).toLowerCase().replace(".", "") || null,
  }
}

/** Normalize video codec names to human-readable short names */
function normalizeCodecName(codec: string | null | undefined): string | null {
  if (!codec) return null
  const c = codec.toLowerCase()
  if (c.includes("h264") || c.includes("avc") || c === "x264") return "H.264"
  if (c.includes("h265") || c.includes("hevc") || c === "x265") return "H.265"
  if (c.includes("av1") || c === "av01") return "AV1"
  if (c.includes("vp9")) return "VP9"
  if (c.includes("vp8")) return "VP8"
  if (c.includes("mpeg4") || c === "mpeg4") return "MPEG-4"
  if (c.includes("mpeg2") || c === "mpeg2video") return "MPEG-2"
  if (c.includes("vc1") || c === "wmv3") return "VC-1"
  if (c === "theora") return "Theora"
  return codec.toUpperCase()
}

/** Normalize audio codec names */
function normalizeAudioCodec(codec: string | null | undefined): string | null {
  if (!codec) return null
  const c = codec.toLowerCase()
  if (c === "aac" || c.includes("aac")) return "AAC"
  if (c === "ac3" || c === "ac-3" || c.includes("dolby")) return "AC3"
  if (c === "eac3" || c === "ec-3") return "EAC3"
  if (c.includes("dts")) return "DTS"
  if (c === "truehd" || c.includes("truehd")) return "TrueHD"
  if (c === "flac") return "FLAC"
  if (c.includes("mp3") || c === "mp3float") return "MP3"
  if (c.includes("mp2")) return "MP2"
  if (c === "opus") return "Opus"
  if (c === "vorbis") return "Vorbis"
  if (c === "pcm_s16le" || c === "pcm_s24le" || c.startsWith("pcm_")) return "PCM"
  return codec.toUpperCase()
}
