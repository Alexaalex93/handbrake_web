import type { EncodingOptions } from "./handbrake"

export interface Preset {
  id: number
  name: string
  description: string
  options: EncodingOptions
  isDefault: boolean
  createdAt: string
  updatedAt: string
}
