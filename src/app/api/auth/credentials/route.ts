import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"

function getStoredCredentials() {
  const db = getDb()
  const dbUser = db.prepare("SELECT value FROM settings WHERE key = ?").get("auth_username") as { value: string } | undefined
  const dbPass = db.prepare("SELECT value FROM settings WHERE key = ?").get("auth_password") as { value: string } | undefined
  return {
    username: dbUser?.value || process.env.AUTH_USERNAME || "admin",
    password: dbPass?.value || process.env.AUTH_PASSWORD || "admin1234",
    fromDb: !!(dbUser?.value && dbPass?.value),
  }
}

function saveCredential(key: string, value: string) {
  const db = getDb()
  const existing = db.prepare("SELECT key FROM settings WHERE key = ?").get(key) as any
  if (existing) {
    db.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?").run(value, key)
  } else {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, value)
  }
}

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

    const creds = getStoredCredentials()

    if (currentPassword !== creds.password) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
    }

    // Save new credentials to DB using separate SELECT+INSERT/UPDATE
    saveCredential("auth_username", newUsername.trim())
    saveCredential("auth_password", newPassword.trim())

    // Verify the save worked
    const verify = getStoredCredentials()
    if (verify.username !== newUsername.trim() || verify.password !== newPassword.trim()) {
      return NextResponse.json({ error: "Failed to save credentials — verification failed" }, { status: 500 })
    }

    console.log(`[auth] Credentials updated: username="${newUsername.trim()}"`)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("PUT /api/auth/credentials error:", error)
    return NextResponse.json({ error: "Failed to update credentials" }, { status: 500 })
  }
}

// DELETE: Reset credentials to env var defaults
export async function DELETE() {
  try {
    const db = getDb()
    db.prepare("DELETE FROM settings WHERE key IN ('auth_username', 'auth_password')").run()
    console.log("[auth] Credentials reset to defaults")
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE /api/auth/credentials error:", error)
    return NextResponse.json({ error: "Failed to reset credentials" }, { status: 500 })
  }
}
