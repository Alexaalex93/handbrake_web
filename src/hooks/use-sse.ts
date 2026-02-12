"use client"

import { useEffect, useRef, useCallback, useState } from "react"

export interface SSEEvent {
  type: string
  data: unknown
  timestamp: number
}

type EventCallback = (data: unknown) => void

interface UseSSEOptions {
  url?: string
  enabled?: boolean
}

export function useSSE(options: UseSSEOptions = {}) {
  const { url = "/api/events", enabled = true } = options
  const [lastEvents, setLastEvents] = useState<Record<string, SSEEvent>>({})
  const [connected, setConnected] = useState(false)
  const callbacksRef = useRef<Map<string, Set<EventCallback>>>(new Map())
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const subscribe = useCallback((eventType: string, callback: EventCallback) => {
    if (!callbacksRef.current.has(eventType)) {
      callbacksRef.current.set(eventType, new Set())
    }
    callbacksRef.current.get(eventType)!.add(callback)

    return () => {
      callbacksRef.current.get(eventType)?.delete(callback)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    let retryDelay = 1000

    function connect() {
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.onopen = () => {
        setConnected(true)
        retryDelay = 1000
      }

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          const sseEvent: SSEEvent = {
            type: parsed.type || "message",
            data: parsed,
            timestamp: Date.now(),
          }

          setLastEvents((prev) => ({
            ...prev,
            [sseEvent.type]: sseEvent,
          }))

          const callbacks = callbacksRef.current.get(sseEvent.type)
          if (callbacks) {
            callbacks.forEach((cb) => cb(parsed))
          }

          const wildcardCallbacks = callbacksRef.current.get("*")
          if (wildcardCallbacks) {
            wildcardCallbacks.forEach((cb) => cb(parsed))
          }
        } catch {
          // ignore parse errors
        }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        eventSourceRef.current = null

        reconnectTimeoutRef.current = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000)
          connect()
        }, retryDelay)
      }
    }

    connect()

    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [url, enabled])

  return { lastEvents, connected, subscribe }
}
