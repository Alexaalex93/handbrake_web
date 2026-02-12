import { NextResponse } from "next/server"
import { getEventBus } from "@/lib/events/emitter"
import type { AppEvent } from "@/lib/events/emitter"

export const dynamic = "force-dynamic"

export async function GET() {
  const eventBus = getEventBus()

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const onEvent = (event: AppEvent) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        } catch {
          // Client disconnected, clean up
          cleanup()
        }
      }

      // Send initial keepalive
      try {
        controller.enqueue(encoder.encode(": connected\n\n"))
      } catch {
        return
      }

      eventBus.on("app-event", onEvent)

      // Send keepalive every 30 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"))
        } catch {
          cleanup()
        }
      }, 30000)

      function cleanup() {
        eventBus.off("app-event", onEvent)
        clearInterval(keepalive)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      }

      // Handle client disconnect via AbortSignal is not directly available here,
      // so we rely on the write error catching above for cleanup.
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
