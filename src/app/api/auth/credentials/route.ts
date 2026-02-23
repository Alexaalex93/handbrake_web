import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { currentPassword, newUsername, newPassword } = body

    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 })
    }
    if (!newUsername?.trim() || !newPassword?.trim()) {
      return NextResponse.json({ error: "New username and password are required" }, { status: 400 })
    }
    if (newPassword.trim().length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 })
    }

    const db = getDb()

    // Get current credentials (DB first, then env vars)
    const dbUser = db.prepare("SELECT value FROM settings WHERE key = ?").get("auth_username") as { value: string } | undefined
    const dbPass = db.prepare("SELECT value FROM settings WHERE key = ?").get("auth_password") as { value: string } | undefined
    const currentUser = dbUser?.value || process.env.AUTH_USERNAME || "admin"
    const currentPass = dbPass?.value || process.env.AUTH_PASSWORD || "admin1234"

    if (currentPassword !== currentPass) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
    }

    // Save new credentials to DB
    const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?")
    upsert.run("auth_username", newUsername.trim(), newUsername.trim())
    upsert.run("auth_password", newPassword.trim(), newPassword.trim())

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("PUT /api/auth/credentials error:", error)
    return NextResponse.json({ error: "Failed to update credentials" }, { status: 500 })
  }
}
