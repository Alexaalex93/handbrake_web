import { NextResponse } from "next/server"
import { getSystemStats, getDiskStats, getHandBrakeVersion } from "@/lib/system"
import { getProbeStatus } from "@/lib/media-probe"

export async function GET() {
  try {
    const system = getSystemStats()
    const disk = getDiskStats()
    const handbrakeVersion = getHandBrakeVersion()
    const probeStatus = getProbeStatus()

    return NextResponse.json({
      cpu: {
        usage: system.cpuUsage,
        count: system.cpuCount,
        loadAvg: system.loadAvg,
      },
      memory: {
        total: system.memTotal,
        free: system.memFree,
        used: system.memUsed,
      },
      disk: {
        total: disk.total,
        free: disk.free,
        used: disk.used,
      },
      platform: system.platform,
      hostname: system.hostname,
      serverTime: new Date().toISOString(),
      handbrakeVersion,
      tools: {
        ffprobe: probeStatus.ffprobe,
        handbrake: probeStatus.handbrake,
      },
    })
  } catch (error) {
    console.error("GET /api/system error:", error)
    return NextResponse.json(
      { error: "Failed to fetch system stats" },
      { status: 500 }
    )
  }
}
