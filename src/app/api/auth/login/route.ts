import { NextRequest, NextResponse } from "next/server"
import { createSessionToken, getCredentials } from "@/lib/auth"
import { getDb } from "@/lib/db"

function getEffectiveCredentials(): { username: string; password: string } {
  try {
    const db = getDb()
    const dbUser = db.prepare("SELECT value FROM settings WHERE key = ?").get("auth_username") as { value: string } | undefined
    const dbPass = db.prepare("SELECT value FROM settings WHERE key = ?").get("auth_password") as { value: string } | undefined
    if (dbUser?.value && dbPass?.value) {
      return { username: dbUser.value, password: dbPass.value }
    }
  } catch {
    // DB not available, fall back to env
  }
  return getCredentials()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      )
    }

    const creds = getEffectiveCredentials()

    if (username !== creds.username || password !== creds.password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    const token = await createSessionToken(username)

    const response = NextResponse.json({ ok: true })
    response.cookies.set("hb_session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return response
  } catch (error) {
    console.error("POST /api/auth/login error:", error)
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    )
  }
}
