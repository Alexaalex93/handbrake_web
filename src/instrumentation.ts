export async function register() {
  // Only run on the server (not in Edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getWatcherManager } = await import("@/lib/watcher/manager")
    const { getQueueManager } = await import("@/lib/queue/manager")

    // Initialize managers so watchers and queue start on server boot
    getWatcherManager()
    getQueueManager()

    console.log("[startup] Watcher manager and queue manager initialized")
  }
}
