import os from "os"
import { execSync } from "child_process"
import { getHandBrakePath } from "@/lib/handbrake/cli"

export function getSystemStats() {
  const cpus = os.cpus()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const isWindows = os.platform() === "win32"

  let cpuUsage = 0

  if (isWindows) {
    // On Windows, os.loadavg() returns [0,0,0], so calculate from CPU times
    if (cpus.length > 0) {
      let totalIdle = 0
      let totalTick = 0
      for (const cpu of cpus) {
        const { user, nice, sys, idle, irq } = cpu.times
        totalIdle += idle
        totalTick += user + nice + sys + idle + irq
      }
      cpuUsage = totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 1000) / 10 : 0
    }
  } else {
    // On Unix, use load average
    const loadAvg = os.loadavg()
    cpuUsage = Math.min(100, Math.round((loadAvg[0] / cpus.length) * 1000) / 10)
  }

  return {
    cpuUsage,
    cpuCount: cpus.length,
    memTotal: totalMem,
    memFree: freeMem,
    memUsed: totalMem - freeMem,
    loadAvg: os.loadavg()[0],
    platform: os.platform(),
    hostname: os.hostname(),
  }
}

export function getDiskStats(targetPath?: string): { free: number; total: number; used: number } {
  try {
    const isWindows = os.platform() === "win32"

    if (isWindows) {
      // Determine which drive to query
      let driveLetter = "C"
      if (targetPath && /^[A-Za-z]:/.test(targetPath)) {
        driveLetter = targetPath.charAt(0).toUpperCase()
      } else {
        // Use the drive where the process is running
        const cwd = process.cwd()
        if (/^[A-Za-z]:/.test(cwd)) {
          driveLetter = cwd.charAt(0).toUpperCase()
        }
      }

      const output = execSync(
        `wmic logicaldisk where "DeviceID='${driveLetter}:'" get FreeSpace,Size /format:csv`,
        { encoding: "utf-8", timeout: 5000 }
      )
      const lines = output.trim().split("\n").filter(l => l.trim())
      const last = lines[lines.length - 1].split(",")
      const free = parseInt(last[1]) || 0
      const total = parseInt(last[2]) || 0
      return { free, total, used: total - free }
    } else {
      const path = targetPath || "/"
      const output = execSync(`df -B1 "${path}" | tail -1`, { encoding: "utf-8", timeout: 5000 })
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
    const output = execSync(`"${hbPath}" --version 2>&1`, { encoding: "utf-8", timeout: 5000 })
    const match = output.match(/HandBrake\s+(\S+)/)
    return match ? match[1] : "Unknown"
  } catch {
    return "Not found"
  }
}
