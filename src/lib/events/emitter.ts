import { EventEmitter } from "events"

export type AppEvent =
  | { type: "task:progress"; taskId: number; data: { progress: number; eta: number; fps: number; avgFps: number; pass: number; passCount: number } }
  | { type: "task:status"; taskId: number; data: { status: string; errorMessage?: string } }
  | { type: "queue:changed" }
  | { type: "watcher:scan"; watcherId: number; data: { newFiles: number } }
  | { type: "system:stats"; data: { cpuUsage: number; diskFree: number; diskTotal: number } }

const globalForEvents = globalThis as unknown as {
  __eventBus: EventEmitter | undefined
}

export function getEventBus(): EventEmitter {
  if (!globalForEvents.__eventBus) {
    globalForEvents.__eventBus = new EventEmitter()
    globalForEvents.__eventBus.setMaxListeners(100)
  }
  return globalForEvents.__eventBus
}

export function emitEvent(event: AppEvent) {
  getEventBus().emit("app-event", event)
}
