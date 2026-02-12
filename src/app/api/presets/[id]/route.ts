import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import type { Preset } from "@/types/preset"

function rowToPreset(row: any): Preset {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    options: JSON.parse(row.options_json),
    isDefault: !!row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const row = db.prepare("SELECT * FROM presets WHERE id = ?").get(id)

    if (!row) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 })
    }

    return NextResponse.json(rowToPreset(row))
  } catch (error) {
    console.error("GET /api/presets/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to fetch preset" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const existing = db.prepare("SELECT * FROM presets WHERE id = ?").get(id) as any

    if (!existing) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 })
    }

    const body = await request.json()

    const name = body.name ?? existing.name
    const description = body.description ?? existing.description
    const options = body.options ? JSON.stringify(body.options) : existing.options_json
    const isDefault = body.isDefault !== undefined ? (body.isDefault ? 1 : 0) : existing.is_default

    // If setting this preset as default, unset all other defaults first
    if (isDefault && !existing.is_default) {
      db.prepare("UPDATE presets SET is_default = 0 WHERE is_default = 1").run()
    }

    db.prepare(`
      UPDATE presets SET name = ?, description = ?, options_json = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, description, options, isDefault, id)

    const updated = db.prepare("SELECT * FROM presets WHERE id = ?").get(id)
    return NextResponse.json(rowToPreset(updated))
  } catch (error: any) {
    if (error?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return NextResponse.json(
        { error: "A preset with this name already exists" },
        { status: 409 }
      )
    }
    console.error("PUT /api/presets/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to update preset" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const existing = db.prepare("SELECT * FROM presets WHERE id = ?").get(id)

    if (!existing) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 })
    }

    db.prepare("DELETE FROM presets WHERE id = ?").run(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/presets/[id] error:", error)
    return NextResponse.json(
      { error: "Failed to delete preset" },
      { status: 500 }
    )
  }
}
