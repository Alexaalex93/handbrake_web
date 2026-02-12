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

export async function GET() {
  try {
    const db = getDb()
    const rows = db.prepare("SELECT * FROM presets ORDER BY name ASC").all()
    const presets = rows.map(rowToPreset)
    return NextResponse.json(presets)
  } catch (error) {
    console.error("GET /api/presets error:", error)
    return NextResponse.json(
      { error: "Failed to fetch presets" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()

    if (!body.name || !body.options) {
      return NextResponse.json(
        { error: "name and options are required" },
        { status: 400 }
      )
    }

    const description = body.description || ""

    const result = db.prepare(`
      INSERT INTO presets (name, description, options_json)
      VALUES (?, ?, ?)
    `).run(body.name, description, JSON.stringify(body.options))

    const row = db.prepare("SELECT * FROM presets WHERE id = ?").get(result.lastInsertRowid)
    return NextResponse.json(rowToPreset(row), { status: 201 })
  } catch (error: any) {
    if (error?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return NextResponse.json(
        { error: "A preset with this name already exists" },
        { status: 409 }
      )
    }
    console.error("POST /api/presets error:", error)
    return NextResponse.json(
      { error: "Failed to create preset" },
      { status: 500 }
    )
  }
}
