import os from "os"
import { execSync } from "child_process"
import { getHandBrakePath } from "@/lib/handbrake/cli"

export function getSystemStats() {
  const cpus = os.cpus()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const loadAvg = os.loadavg()

  // CPU usage (rough estimate from load average vs cpu count)
  const cpuCount = cpus.length
  const cpuUsage = Math.min(100, (loadAvg[0] / cpuCount) * 100)

  return {
    cpuUsage: Math.round(cpuUsage * 10) / 10,
    cpuCount,
    memTotal: totalMem,
    memFree: freeMem,
    memUsed: totalMem - freeMem,
    loadAvg: loadAvg[0],
    platform: os.platform(),
    hostname: os.hostname(),
  }
}

export function getDiskStats(path: string = "/"): { free: number; total: number; used: number } {
  try {
    if (os.platform() === "win32") {
      const output = execSync(`wmic logicaldisk where "DeviceID='${path.charAt(0)}:'" get FreeSpace,Size /format:csv`, { encoding: "utf-8" })
      const lines = output.trim().split("\n").filter(l => l.trim())
      const last = lines[lines.length - 1].split(",")
      const free = parseInt(last[1]) || 0
      const total = parseInt(last[2]) || 0
      return { free, total, used: total - free }
    } else {
      const output = execSync(`df -B1 "${path}" | tail -1`, { encoding: "utf-8" })
      const parts = output.trim().split(/\s+/)
      const total = parseInt(parts[1]) || 0
      const used = parseInt(parts[2]) || 0
      const free = parseInt(parts[3]) || 0
      return { free, total, used }
    }
  } catch {
    return { free: 0, total: 0, used: 0 }
  }
}

export function getHandBrakeVersion(): string {
  try {
    const hbPath = getHandBrakePath()
    const output = execSync(`${hbPath} --version 2>&1`, { encoding: "utf-8", timeout: 5000 })
    const match = output.match(/HandBrake\s+(\S+)/)
    return match ? match[1] : "Unknown"
  } catch {
    return "Not found"
  }
}
