export type VideoEncoder =
  | "x264" | "x264_10bit"
  | "x265" | "x265_10bit" | "x265_12bit"
  | "nvenc_h264" | "nvenc_h265"
  | "vce_h264" | "vce_h265" | "vce_h265_10bit"
  | "svt_av1" | "svt_av1_10bit"
  | "VP8" | "VP9" | "VP9_10bit"
  | "mpeg4" | "mpeg2" | "theora" | "ffv1"

export type AudioEncoder =
  | "av_aac" | "ac3" | "eac3" | "truehd" | "mp3"
  | "opus" | "vorbis" | "flac16" | "flac24" | "alac16" | "alac24" | "none"
  | "copy:aac" | "copy:ac3" | "copy:eac3" | "copy:truehd"
  | "copy:dts" | "copy:dtshd" | "copy:mp3" | "copy:opus"
  | "copy:vorbis" | "copy:flac" | "copy:alac" | "copy"

export type AudioMixdown =
  | "mono" | "left_only" | "right_only" | "stereo"
  | "dpl1" | "dpl2" | "5point1" | "6point1" | "7point1"
  | "5_2_lfe"

export type ContainerFormat = "mkv" | "mp4" | "webm"

export type EncoderPreset =
  | "ultrafast" | "superfast" | "veryfast" | "faster" | "fast"
  | "medium" | "slow" | "slower" | "veryslow" | "placebo"

export type EncoderTune =
  | "film" | "animation" | "grain" | "stillimage" | "psnr" | "ssim"
  | "fastdecode" | "zerolatency" | "none"

export type DeinterlaceMode = "off" | "yadif" | "decomb" | "bwdif"
export type DenoiseMode = "off" | "nlmeans" | "hqdn3d"
export type DenoisePreset = "ultralight" | "light" | "medium" | "strong"
export type AnamorphicMode = "off" | "strict" | "loose" | "custom" | "auto"
export type CropMode = "auto" | "none" | "custom"

export interface VideoOptions {
  encoder: VideoEncoder
  qualityMode: "crf" | "bitrate"
  quality: number          // RF/CRF value
  bitrate?: number         // kbps
  encoderPreset: EncoderPreset
  encoderTune: EncoderTune
  encoderProfile?: string
  encoderLevel?: string
  multiPass: boolean
  turboFirstPass: boolean
  advancedOptions?: string // raw --encopts string
}

export interface AudioTrack {
  track: number           // 1-based track index from source
  encoder: AudioEncoder
  mixdown: AudioMixdown
  bitrate: number         // kbps
  sampleRate: number | "auto"
  gain: number            // dB
  drc: number
  name?: string
}

export interface SubtitleTrack {
  track: number           // 1-based track index from source
  burn: boolean
  forced: boolean
  default: boolean
  srtFile?: string
  srtOffset?: number
}

export interface FilterOptions {
  deinterlace: DeinterlaceMode
  deinterlaceCustom?: string
  denoise: DenoiseMode
  denoisePreset: DenoisePreset
  denoiseTune?: string
  deblock?: number        // 1-15, 0=off
  rotation?: 0 | 90 | 180 | 270
  flip: boolean
  grayscale: boolean
  chromaSmooth?: string
  colorspace?: string
}

export interface PictureOptions {
  width?: number
  height?: number
  anamorphic: AnamorphicMode
  modulus: 2 | 4 | 8 | 16
  cropMode: CropMode
  cropTop: number
  cropBottom: number
  cropLeft: number
  cropRight: number
}

export interface ContainerOptions {
  format: ContainerFormat
  chapters: boolean
  webOptimized: boolean     // mp4 only
  alignAvStart: boolean
  ipodAtom: boolean         // mp4 only
}

export interface EncodingOptions {
  video: VideoOptions
  audioTracks: AudioTrack[]
  allAudioPassthrough?: boolean
  subtitleTracks: SubtitleTrack[]
  allSubtitles?: boolean
  filters: FilterOptions
  picture: PictureOptions
  container: ContainerOptions
}

export const DEFAULT_ENCODING_OPTIONS: EncodingOptions = {
  video: {
    encoder: "x265",
    qualityMode: "crf",
    quality: 18,
    encoderPreset: "medium",
    encoderTune: "none",
    multiPass: false,
    turboFirstPass: false,
  },
  audioTracks: [
    {
      track: 1,
      encoder: "copy",
      mixdown: "stereo",
      bitrate: 160,
      sampleRate: "auto",
      gain: 0,
      drc: 0,
    },
  ],
  allAudioPassthrough: true,
  subtitleTracks: [],
  allSubtitles: true,
  filters: {
    deinterlace: "off",
    denoise: "off",
    denoisePreset: "medium",
    flip: false,
    grayscale: false,
  },
  picture: {
    anamorphic: "auto",
    modulus: 2,
    cropMode: "auto",
    cropTop: 0,
    cropBottom: 0,
    cropLeft: 0,
    cropRight: 0,
  },
  container: {
    format: "mkv",
    chapters: true,
    webOptimized: false,
    alignAvStart: false,
    ipodAtom: false,
  },
}

// Scan result types
export interface ScannedTitle {
  index: number
  name?: string
  duration: { hours: number; minutes: number; seconds: number }
  geometry: { width: number; height: number }
  frameRate: { num: number; den: number }
  audioTracks: ScannedAudioTrack[]
  subtitleTracks: ScannedSubtitleTrack[]
  chapterCount: number
}

export interface ScannedAudioTrack {
  index: number
  codec: string
  language: string
  languageCode: string
  channels: number
  sampleRate: number
  bitrate: number
  name?: string
}

export interface ScannedSubtitleTrack {
  index: number
  format: string
  language: string
  languageCode: string
  name?: string
  forced: boolean
}

export interface ScanResult {
  mainFeature: number
  titles: ScannedTitle[]
}

// Progress types
export interface EncodeProgress {
  state: "WORKING" | "WORKDONE" | "MUXING" | "SEARCHING" | "PAUSED"
  progress: number       // 0.0 - 1.0
  rate: number           // fps
  rateAvg: number        // avg fps
  eta: number            // seconds
  pass: number
  passCount: number
  passId?: number
}
