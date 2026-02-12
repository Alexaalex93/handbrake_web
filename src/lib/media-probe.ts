import { execSync } from "child_process"
import path from "path"

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

/**
 * Probe media file info using ffprobe (preferred) or HandBrakeCLI --scan.
 * Returns basic codec/resolution/duration info for library scanning.
 */
export function probeMediaFile(filePath: string): MediaInfo {
  // Try ffprobe first (faster and more reliable for just metadata)
  try {
    return probeWithFfprobe(filePath)
  } catch {
    // ffprobe not available, skip
  }

  // Try HandBrakeCLI scan as fallback
  try {
    return probeWithHandBrake(filePath)
  } catch {
    // Neither available
  }

  // Return basic info from file extension
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

function probeWithFfprobe(filePath: string): MediaInfo {
  const output = execSync(
    `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
    { encoding: "utf-8", timeout: 30000 }
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
    audioCodec: audioStream?.codec_name ?? null,
    audioChannels: audioStream?.channels ?? null,
    audioBitrate: audioStream?.bit_rate ? Math.round(parseInt(audioStream.bit_rate) / 1000) : null,
    subtitleCount: subtitleStreams.length,
    container: format?.format_name?.split(",")[0] ?? null,
  }
}

function probeWithHandBrake(filePath: string): MediaInfo {
  const output = execSync(
    `HandBrakeCLI -i "${filePath}" --scan --json -t 1 2>&1`,
    { encoding: "utf-8", timeout: 60000 }
  )

  // Extract JSON from HandBrakeCLI output (it outputs JSON between markers)
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

/** Normalize codec names to human-readable short names */
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
