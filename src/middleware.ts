import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifySessionToken, isAuthDisabled } from "@/lib/auth"

export async function middleware(request: NextRequest) {
  // Skip auth if disabled via env var
  if (isAuthDisabled()) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  // Allow login page, auth API, and static assets
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get("hb_session")?.value

  if (!token) {
    // API routes return 401, pages redirect to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const valid = await verifySessionToken(token)
  if (!valid) {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url))
    response.cookies.delete("hb_session")
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon\\.svg|favicon\\.ico).*)"],
}
