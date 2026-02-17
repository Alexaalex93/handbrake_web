import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getQueueManager } from "@/lib/queue/manager"
import { DEFAULT_ENCODING_OPTIONS } from "@/types/handbrake"
import type { EncodingOptions } from "@/types/handbrake"
import path from "path"

interface BatchItem {
  sourcePath: string
  outputPath?: string
}

interface BatchRequest {
  items: BatchItem[]
  options?: EncodingOptions
  presetId?: number
  deleteSource?: boolean
  replaceSource?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body: BatchRequest = await request.json()

    if (!body.items || !Array.isArray(body.items)) {
      return NextResponse.json(
        { error: "items array is required" },
        { status: 400 }
      )
    }

    if (body.items.length === 0) {
      return NextResponse.json({ created: 0, errors: [], total: 0 }, { status: 201 })
    }

    // Resolve encoding options: explicit options > preset > default
    let options: EncodingOptions = DEFAULT_ENCODING_OPTIONS
    if (body.options) {
      options = body.options
    } else if (body.presetId) {
      const preset = db.prepare("SELECT options_json FROM presets WHERE id = ?").get(body.presetId) as any
      if (preset) {
        options = JSON.parse(preset.options_json)
      }
    }

    const presetId = body.presetId ?? null
    const deleteSource = body.deleteSource ? 1 : 0
    const replaceSource = body.replaceSource ? 1 : 0
    const format = options.container?.format || "mkv"

    // Get current max sort_order
    const maxOrder = db
      .prepare("SELECT COALESCE(MAX(sort_order), 0) as max_order FROM tasks")
      .get() as { max_order: number }
    let sortOrder = maxOrder.max_order + 1

    const insertStmt = db.prepare(`
      INSERT INTO tasks (title, source_path, output_path, status, priority, sort_order, preset_id, options_json, delete_source, replace_source)
      VALUES (?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?)
    `)

    const optionsJson = JSON.stringify(options)
    let created = 0
    const errors: string[] = []

    // Use a transaction for atomic batch insert
    const insertAll = db.transaction(() => {
      for (const item of body.items) {
        if (!item.sourcePath) {
          errors.push("Missing sourcePath for item")
          continue
        }

        const title = path.basename(item.sourcePath)
        const outputPath = item.outputPath || computeOutputPath(item.sourcePath, format)

        // Check if there's already a task for this source
        const existing = db.prepare(
          "SELECT id FROM tasks WHERE source_path = ? AND status IN ('queued', 'encoding', 'paused')"
        ).get(item.sourcePath) as any
        if (existing) {
          errors.push(`${title}: already in queue`)
          continue
        }

        insertStmt.run(title, item.sourcePath, outputPath, sortOrder++, presetId, optionsJson, deleteSource, replaceSource)
        created++
      }
    })

    insertAll()

    // Trigger queue processing
    if (created > 0) {
      getQueueManager().processQueue()
    }

    console.log(`[handbrake] Batch: ${created} task(s) added to queue`)

    return NextResponse.json({
      created,
      errors,
      total: body.items.length,
    }, { status: 201 })
  } catch (error) {
    console.error("POST /api/tasks/batch error:", error)
    return NextResponse.json(
      { error: "Failed to create batch tasks" },
      { status: 500 }
    )
  }
}

function computeOutputPath(sourcePath: string, format: string): string {
  const dir = path.dirname(sourcePath)
  const ext = path.extname(sourcePath)
  const base = path.basename(sourcePath, ext)
  return path.join(dir, `${base}_encoded.${format}`)
}
