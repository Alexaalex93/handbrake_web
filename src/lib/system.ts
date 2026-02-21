import os from "os"
import { execSync } from "child_process"
import { findHandBrake } from "@/lib/media-probe"

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

// ─── Cached values for expensive operations ──────────────────────────────
// Use globalThis so caches survive Next.js HMR module reloads in dev mode
const _g = globalThis as any
if (!_g.__sysCache) {
  _g.__sysCache = {
    disk: null as { free: number; total: number; used: number } | null,
    diskTime: 0,
    hbVersion: null as string | null,
    hbVersionTime: 0,
  }
}
const _cache = _g.__sysCache
const DISK_CACHE_TTL = 300000 // 5 minutes
const HB_VERSION_CACHE_TTL = 3600000 // 1 hour

export function getDiskStats(targetPath?: string): { free: number; total: number; used: number } {
  const now = Date.now()
  if (_cache.disk && now - _cache.diskTime < DISK_CACHE_TTL) {
    return _cache.disk
  }

  try {
    const isWindows = os.platform() === "win32"

    if (isWindows) {
      let driveLetter = "C"
      if (targetPath && /^[A-Za-z]:/.test(targetPath)) {
        driveLetter = targetPath.charAt(0).toUpperCase()
      } else {
        const cwd = process.cwd()
        if (/^[A-Za-z]:/.test(cwd)) {
          driveLetter = cwd.charAt(0).toUpperCase()
        }
      }

      const output = execSync(
        `powershell -NoProfile -Command "Get-Volume -DriveLetter ${driveLetter} | Select-Object SizeRemaining,Size | ConvertTo-Json"`,
        { encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] }
      )
      const data = JSON.parse(output)
      const free = data.SizeRemaining || 0
      const total = data.Size || 0
      _cache.disk = { free, total, used: total - free }
    } else {
      const path = targetPath || "/"
      const output = execSync(`df -B1 "${path}" | tail -1`, { encoding: "utf-8", timeout: 5000 })
      const parts = output.trim().split(/\s+/)
      const total = parseInt(parts[1]) || 0
      const used = parseInt(parts[2]) || 0
      const free = parseInt(parts[3]) || 0
      _cache.disk = { free, total, used }
    }
    _cache.diskTime = now
    return _cache.disk
  } catch {
    return _cache.disk || { free: 0, total: 0, used: 0 }
  }
}

export function getHandBrakeVersion(): string {
  const now = Date.now()
  if (_cache.hbVersion && _cache.hbVersion !== "Not found" && now - _cache.hbVersionTime < HB_VERSION_CACHE_TTL) {
    return _cache.hbVersion
  }

  try {
    const hbPath = findHandBrake()
    if (!hbPath) {
      return "Not found"
    }
    const output = execSync(`"${hbPath}" --version 2>&1`, {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    })
    // Match version number specifically (e.g. "HandBrake 1.7.3") to avoid
    // matching debug lines like "HandBrake has been compiled with..."
    const match = output.match(/HandBrake\s+(\d+\.\d+[\.\d]*)/)
    _cache.hbVersion = match ? match[1] : "Unknown"
    _cache.hbVersionTime = now
    return _cache.hbVersion
  } catch {
    return "Not found"
  }
}
