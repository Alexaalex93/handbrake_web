import { NextRequest, NextResponse } from "next/server"
import { getNotificationSettings, saveNotificationSettings } from "@/lib/notifications"

export async function GET() {
  try {
    const settings = getNotificationSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error("GET /api/notifications error:", error)
    return NextResponse.json({ error: "Failed to fetch notification settings" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    saveNotificationSettings(body)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("PUT /api/notifications error:", error)
    return NextResponse.json({ error: "Failed to save notification settings" }, { status: 500 })
  }
}
