import { spawn, type ChildProcess } from "child_process"
import { getDb } from "@/lib/db"
import type { EncodingOptions, AudioTrack, SubtitleTrack } from "@/types/handbrake"

export function getHandBrakePath(): string {
  const db = getDb()
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("handbrake_path") as { value: string } | undefined
  return row?.value || "HandBrakeCLI"
}

export function buildArgs(sourcePath: string, outputPath: string, options: EncodingOptions, title?: number): string[] {
  const args: string[] = ["-i", sourcePath, "-o", outputPath, "--json"]

  if (title) {
    args.push("-t", title.toString())
  }

  // Container format
  args.push("-f", options.container.format)

  // Video encoder
  args.push("-e", options.video.encoder)

  // Quality
  if (options.video.qualityMode === "crf") {
    args.push("-q", options.video.quality.toString())
  } else if (options.video.bitrate) {
    args.push("-b", options.video.bitrate.toString())
  }

  // Encoder preset
  if (options.video.encoderPreset && options.video.encoderPreset !== "medium") {
    args.push("--encoder-preset", options.video.encoderPreset)
  }

  // Encoder tune
  if (options.video.encoderTune && options.video.encoderTune !== "none") {
    args.push("--encoder-tune", options.video.encoderTune)
  }

  // Encoder profile
  if (options.video.encoderProfile) {
    args.push("--encoder-profile", options.video.encoderProfile)
  }

  // Encoder level
  if (options.video.encoderLevel) {
    args.push("--encoder-level", options.video.encoderLevel)
  }

  // Multi-pass
  if (options.video.multiPass) {
    args.push("--multi-pass")
    if (options.video.turboFirstPass) {
      args.push("-T")
    }
  }

  // Advanced options
  if (options.video.advancedOptions) {
    args.push("-x", options.video.advancedOptions)
  }

  // Audio tracks
  if (options.audioTracks.length > 0) {
    buildAudioArgs(args, options.audioTracks)
  }

  // Subtitle tracks
  if (options.subtitleTracks.length > 0) {
    buildSubtitleArgs(args, options.subtitleTracks)
  }

  // Filters
  buildFilterArgs(args, options)

  // Picture
  buildPictureArgs(args, options)

  // Container options
  if (options.container.chapters) {
    args.push("-m")
  }
  if (options.container.webOptimized && options.container.format === "mp4") {
    args.push("-O")
  }
  if (options.container.alignAvStart) {
    args.push("--align-av-start")
  }
  if (options.container.ipodAtom && options.container.format === "mp4") {
    args.push("-I")
  }

  return args
}

function buildAudioArgs(args: string[], tracks: AudioTrack[]) {
  const trackNums = tracks.map(t => t.track.toString()).join(",")
  const encoders = tracks.map(t => t.encoder).join(",")
  const mixdowns = tracks.map(t => t.mixdown).join(",")
  const bitrates = tracks.map(t => t.bitrate.toString()).join(",")
  const sampleRates = tracks.map(t => t.sampleRate === "auto" ? "auto" : t.sampleRate.toString()).join(",")
  const gains = tracks.map(t => t.gain.toString()).join(",")
  const drcs = tracks.map(t => t.drc.toString()).join(",")

  args.push("-a", trackNums)
  args.push("-E", encoders)
  args.push("--mixdown", mixdowns)
  args.push("-B", bitrates)
  args.push("-R", sampleRates)
  args.push("--gain", gains)
  args.push("-D", drcs)

  const names = tracks.filter(t => t.name).map(t => t.name)
  if (names.length > 0) {
    args.push("--aname", names.join(","))
  }
}

function buildSubtitleArgs(args: string[], tracks: SubtitleTrack[]) {
  const trackNums: string[] = []
  const burns: number[] = []
  const defaults: number[] = []
  const forceds: number[] = []

  tracks.forEach((t, i) => {
    if (t.srtFile) {
      args.push("--srt-file", t.srtFile)
      if (t.srtOffset) {
        args.push("--srt-offset", t.srtOffset.toString())
      }
    } else {
      trackNums.push(t.track.toString())
      if (t.burn) burns.push(i + 1)
      if (t.default) defaults.push(i + 1)
      if (t.forced) forceds.push(i + 1)
    }
  })

  if (trackNums.length > 0) {
    args.push("-s", trackNums.join(","))
    if (burns.length > 0) {
      args.push("--subtitle-burned", burns[0].toString())
    }
    if (defaults.length > 0) {
      args.push("--subtitle-default", defaults[0].toString())
    }
  }
}

function buildFilterArgs(args: string[], options: EncodingOptions) {
  const { filters } = options

  if (filters.deinterlace !== "off") {
    args.push("--deinterlace", filters.deinterlace)
    if (filters.deinterlaceCustom) {
      args.push("--deinterlace-custom", filters.deinterlaceCustom)
    }
  }

  if (filters.denoise !== "off") {
    args.push(`--${filters.denoise}`, filters.denoisePreset)
    if (filters.denoiseTune) {
      args.push(`--${filters.denoise}-tune`, filters.denoiseTune)
    }
  }

  if (filters.deblock && filters.deblock > 0) {
    args.push("--deblock", filters.deblock.toString())
  }

  if (filters.rotation && filters.rotation > 0) {
    const rotMap: Record<number, string> = { 90: "4", 180: "3", 270: "7" }
    args.push("--rotate", rotMap[filters.rotation] || "0")
  }

  if (filters.flip) {
    args.push("--rotate", "1")
  }

  if (filters.grayscale) {
    args.push("-g")
  }
}

function buildPictureArgs(args: string[], options: EncodingOptions) {
  const { picture } = options

  if (picture.width) args.push("-w", picture.width.toString())
  if (picture.height) args.push("-l", picture.height.toString())

  if (picture.anamorphic !== "auto") {
    const anaMap: Record<string, string> = {
      off: "off", strict: "strict", loose: "loose", custom: "custom",
    }
    args.push("--anamorphic", anaMap[picture.anamorphic] || "auto")
  }

  if (picture.modulus !== 2) {
    args.push("--modulus", picture.modulus.toString())
  }

  if (picture.cropMode === "custom") {
    args.push("--crop", `${picture.cropTop}:${picture.cropBottom}:${picture.cropLeft}:${picture.cropRight}`)
  } else if (picture.cropMode === "none") {
    args.push("--crop", "0:0:0:0")
  }
}

export function spawnHandBrake(args: string[]): ChildProcess {
  const hbPath = getHandBrakePath()
  return spawn(hbPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
  })
}

export function spawnScan(sourcePath: string): ChildProcess {
  const hbPath = getHandBrakePath()
  return spawn(hbPath, ["-i", sourcePath, "--scan", "--json", "-t", "0"], {
    stdio: ["ignore", "pipe", "pipe"],
  })
}
