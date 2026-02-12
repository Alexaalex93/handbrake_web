import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { DEFAULT_ENCODING_OPTIONS } from "@/types/handbrake"
import type { EncodingOptions } from "@/types/handbrake"

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()

    // HandBrake JSON preset format can have:
    // - PresetList: array of presets (export format)
    // - A single preset object
    let rawPresets: any[] = []

    if (body.PresetList && Array.isArray(body.PresetList)) {
      // Standard HandBrake export format
      rawPresets = flattenPresetList(body.PresetList)
    } else if (body.PresetName) {
      // Single preset object
      rawPresets = [body]
    } else if (Array.isArray(body)) {
      rawPresets = flattenPresetList(body)
    } else {
      return NextResponse.json(
        { error: "Invalid HandBrake preset format. Expected PresetList array or a single preset object." },
        { status: 400 }
      )
    }

    if (rawPresets.length === 0) {
      return NextResponse.json(
        { error: "No presets found in the provided data" },
        { status: 400 }
      )
    }

    const imported: { name: string; id: number }[] = []
    const errors: { name: string; error: string }[] = []

    const insertStmt = db.prepare(`
      INSERT INTO presets (name, description, options_json)
      VALUES (?, ?, ?)
    `)

    for (const raw of rawPresets) {
      const name = raw.PresetName || "Imported Preset"
      const description = raw.PresetDescription || ""

      try {
        const options = mapHandBrakePreset(raw)
        const result = insertStmt.run(name, description, JSON.stringify(options))
        imported.push({ name, id: Number(result.lastInsertRowid) })
      } catch (err: any) {
        if (err?.code === "SQLITE_CONSTRAINT_UNIQUE") {
          errors.push({ name, error: "A preset with this name already exists" })
        } else {
          errors.push({ name, error: err?.message || "Unknown error" })
        }
      }
    }

    return NextResponse.json({
      imported,
      errors,
      totalImported: imported.length,
      totalErrors: errors.length,
    }, { status: imported.length > 0 ? 201 : 400 })
  } catch (error) {
    console.error("POST /api/presets/import error:", error)
    return NextResponse.json(
      { error: "Failed to import presets" },
      { status: 500 }
    )
  }
}

function flattenPresetList(presets: any[]): any[] {
  const result: any[] = []
  for (const item of presets) {
    if (item.ChildrenArray && Array.isArray(item.ChildrenArray)) {
      // This is a category/folder containing presets
      result.push(...flattenPresetList(item.ChildrenArray))
    } else if (item.PresetName) {
      result.push(item)
    }
  }
  return result
}

function mapHandBrakePreset(raw: any): EncodingOptions {
  const base = { ...DEFAULT_ENCODING_OPTIONS }

  // Video
  base.video = {
    ...base.video,
    encoder: raw.VideoEncoder || base.video.encoder,
    qualityMode: raw.VideoQualityType === 2 ? "crf" : "bitrate",
    quality: raw.VideoQualitySlider ?? base.video.quality,
    bitrate: raw.VideoAvgBitrate ?? undefined,
    encoderPreset: raw.VideoPreset || base.video.encoderPreset,
    encoderTune: raw.VideoTune || base.video.encoderTune,
    encoderProfile: raw.VideoProfile || undefined,
    encoderLevel: raw.VideoLevel || undefined,
    multiPass: !!raw.VideoMultiPass,
    turboFirstPass: !!raw.VideoTurboMultiPass,
  }

  // Audio tracks
  if (raw.AudioList && Array.isArray(raw.AudioList) && raw.AudioList.length > 0) {
    base.audioTracks = raw.AudioList.map((a: any, i: number) => ({
      track: i + 1,
      encoder: a.AudioEncoder || "copy",
      mixdown: a.AudioMixdown || "stereo",
      bitrate: a.AudioBitrate ?? 160,
      sampleRate: a.AudioSamplerate === "auto" ? "auto" : (a.AudioSamplerate ?? "auto"),
      gain: a.AudioTrackGainSlider ?? 0,
      drc: a.AudioTrackDRCSlider ?? 0,
      name: a.AudioTrackName || undefined,
    }))
  }

  // Container
  const format = raw.FileFormat || raw.Format
  if (format) {
    const formatLower = format.toLowerCase()
    if (formatLower.includes("mkv")) base.container.format = "mkv"
    else if (formatLower.includes("mp4") || formatLower.includes("m4v")) base.container.format = "mp4"
    else if (formatLower.includes("webm")) base.container.format = "webm"
  }
  base.container.webOptimized = !!raw.Mp4HttpOptimize
  base.container.ipodAtom = !!raw.Mp4iPodCompatible
  base.container.chapters = raw.ChapterMarkers !== false

  // Picture
  if (raw.PictureWidth) base.picture.width = raw.PictureWidth
  if (raw.PictureHeight) base.picture.height = raw.PictureHeight
  if (raw.PictureModulus) base.picture.modulus = raw.PictureModulus
  if (raw.PictureCropMode !== undefined) {
    base.picture.cropMode = raw.PictureCropMode === 0 ? "auto" : raw.PictureCropMode === 1 ? "none" : "custom"
  }

  // Filters
  if (raw.PictureDeinterlaceFilter) {
    const deintMap: Record<string, any> = { off: "off", yadif: "yadif", decomb: "decomb", bwdif: "bwdif" }
    base.filters.deinterlace = deintMap[raw.PictureDeinterlaceFilter] || "off"
  }
  if (raw.PictureDenoiseFilter) {
    const denoiseMap: Record<string, any> = { off: "off", nlmeans: "nlmeans", hqdn3d: "hqdn3d" }
    base.filters.denoise = denoiseMap[raw.PictureDenoiseFilter] || "off"
  }
  base.filters.grayscale = !!raw.VideoGrayScale

  return base
}
