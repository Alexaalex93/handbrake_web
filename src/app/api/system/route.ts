import { NextResponse } from "next/server"
import { getSystemStats, getDiskStats, getHandBrakeVersion } from "@/lib/system"

export async function GET() {
  try {
    const system = getSystemStats()
    const disk = getDiskStats()
    const handbrakeVersion = getHandBrakeVersion()

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
      handbrakeVersion,
    })
  } catch (error) {
    console.error("GET /api/system error:", error)
    return NextResponse.json(
      { error: "Failed to fetch system stats" },
      { status: 500 }
    )
  }
}
