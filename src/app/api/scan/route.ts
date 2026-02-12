import { NextRequest, NextResponse } from "next/server"
import { spawnScan } from "@/lib/handbrake/cli"
import { parseScanOutput } from "@/lib/handbrake/parser"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.sourcePath) {
      return NextResponse.json(
        { error: "sourcePath is required" },
        { status: 400 }
      )
    }

    const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
      const proc = spawnScan(body.sourcePath)
      let stdout = ""
      let stderr = ""

      proc.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString()
      })

      proc.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      proc.on("close", (code) => {
        resolve({ stdout, stderr, code })
      })

      proc.on("error", (err) => {
        reject(err)
      })

      // Timeout after 60 seconds
      setTimeout(() => {
        try { proc.kill("SIGTERM") } catch {}
        reject(new Error("Scan timed out after 60 seconds"))
      }, 60000)
    })

    const combinedOutput = result.stdout + "\n" + result.stderr
    const scanResult = parseScanOutput(combinedOutput)

    if (!scanResult) {
      return NextResponse.json(
        { error: "Failed to parse scan output", details: result.stderr.slice(-500) },
        { status: 422 }
      )
    }

    return NextResponse.json(scanResult)
  } catch (error: any) {
    console.error("POST /api/scan error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to scan source" },
      { status: 500 }
    )
  }
}
