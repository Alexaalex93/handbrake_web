import type { EncodeProgress, ScanResult, ScannedTitle, ScannedAudioTrack, ScannedSubtitleTrack } from "@/types/handbrake"

export function parseProgressLine(line: string): EncodeProgress | null {
  // HandBrakeCLI --json outputs JSON blocks prefixed with markers
  // Progress lines look like: "Progress: { ... }"
  // or standalone JSON objects on stdout
  try {
    const trimmed = line.trim()

    // Try to extract JSON from "Progress: {json}" format
    let jsonStr = trimmed
    if (trimmed.startsWith("Progress:")) {
      jsonStr = trimmed.substring("Progress:".length).trim()
    }

    if (!jsonStr.startsWith("{")) return null

    const obj = JSON.parse(jsonStr)

    // HandBrake progress JSON structure
    if (obj.State !== undefined) {
      const state = mapState(obj.State)
      if (!state) return null

      if (state === "WORKING" || state === "SEARCHING" || state === "MUXING") {
        return {
          state,
          progress: obj.Working?.Progress ?? obj.Muxing?.Progress ?? 0,
          rate: obj.Working?.Rate ?? 0,
          rateAvg: obj.Working?.RateAvg ?? 0,
          eta: obj.Working?.ETASeconds ?? 0,
          pass: obj.Working?.Pass ?? 0,
          passCount: obj.Working?.PassCount ?? 0,
          passId: obj.Working?.PassID,
        }
      }

      if (state === "WORKDONE") {
        return {
          state: "WORKDONE",
          progress: 1,
          rate: 0,
          rateAvg: 0,
          eta: 0,
          pass: 0,
          passCount: 0,
        }
      }

      return { state, progress: 0, rate: 0, rateAvg: 0, eta: 0, pass: 0, passCount: 0 }
    }
  } catch {
    // Not valid JSON progress, ignore
  }
  return null
}

function mapState(state: number | string): EncodeProgress["state"] | null {
  // Handle numeric states (older HandBrake versions)
  if (typeof state === "number") {
    switch (state) {
      case 1: return "WORKING"
      case 2: return "PAUSED"
      case 4: return "SEARCHING"
      case 5: return "WORKDONE"
      case 8: return "MUXING"
      default: return null
    }
  }
  // Handle string states (HandBrake 1.10+)
  const s = String(state).toUpperCase()
  const valid: EncodeProgress["state"][] = ["WORKING", "PAUSED", "SEARCHING", "WORKDONE", "MUXING"]
  return valid.includes(s as any) ? (s as EncodeProgress["state"]) : null
}

export function parseScanOutput(output: string): ScanResult | null {
  try {
    // Find the JSON Title Set block
    const marker = "JSON Title Set:"
    const idx = output.indexOf(marker)
    let jsonStr: string

    if (idx !== -1) {
      jsonStr = output.substring(idx + marker.length).trim()
    } else {
      // Try to find raw JSON with TitleList
      const match = output.match(/\{[\s\S]*"TitleList"[\s\S]*\}/)
      if (!match) return null
      jsonStr = match[0]
    }

    const data = JSON.parse(jsonStr)

    const titles: ScannedTitle[] = (data.TitleList || []).map((t: any) => ({
      index: t.Index ?? 0,
      name: t.Name || undefined,
      duration: {
        hours: t.Duration?.Hours ?? 0,
        minutes: t.Duration?.Minutes ?? 0,
        seconds: t.Duration?.Seconds ?? 0,
      },
      geometry: {
        width: t.Geometry?.Width ?? 0,
        height: t.Geometry?.Height ?? 0,
      },
      frameRate: {
        num: t.FrameRate?.Num ?? 0,
        den: t.FrameRate?.Den ?? 1,
      },
      audioTracks: (t.AudioList || []).map((a: any, i: number): ScannedAudioTrack => ({
        index: i + 1,
        codec: a.CodecName || a.Description || "unknown",
        language: a.LanguageLong || a.Language || "Unknown",
        languageCode: a.LanguageCode || a.Language || "und",
        channels: a.ChannelCount ?? a.ChannelLayout ?? 2,
        sampleRate: a.SampleRate ?? 48000,
        bitrate: a.BitRate ?? 0,
        name: a.TrackName || undefined,
      })),
      subtitleTracks: (t.SubtitleList || []).map((s: any, i: number): ScannedSubtitleTrack => ({
        index: i + 1,
        format: s.Format || s.SourceName || "unknown",
        language: s.LanguageLong || s.Language || "Unknown",
        languageCode: s.LanguageCode || s.Language || "und",
        name: s.TrackName || undefined,
        forced: s.Attributes?.Forced === 1,
      })),
      chapterCount: t.ChapterCount ?? (t.ChapterList?.length ?? 0),
    }))

    return {
      mainFeature: data.MainFeature ?? (titles.length > 0 ? titles[0].index : 0),
      titles,
    }
  } catch {
    return null
  }
}
