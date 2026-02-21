import { NextResponse } from "next/server"
import { getNotificationSettings, notifyEncodingComplete } from "@/lib/notifications"

export async function POST() {
  try {
    const settings = getNotificationSettings()
    if (!settings.enabled) {
      return NextResponse.json({ error: "Notifications are disabled" }, { status: 400 })
    }

    await notifyEncodingComplete({
      title: "Test Notification",
      sourcePath: "/media/test_video.mkv",
      sizeIn: 1073741824,   // 1 GB
      sizeOut: 536870912,    // 512 MB
      duration: 325,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("POST /api/notifications/test error:", error)
    return NextResponse.json({ error: "Failed to send test notification" }, { status: 500 })
  }
}
