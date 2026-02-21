/**
 * Authentication utilities.
 * Uses Web Crypto API so it works in both Edge (middleware) and Node.js runtimes.
 */

const DEFAULT_SECRET = "handbrake-web-secret-key-change-me"

function getSecret(): string {
  return process.env.AUTH_SECRET || DEFAULT_SECRET
}

/** Create a signed session token */
export async function createSessionToken(username: string): Promise<string> {
  const payload = btoa(JSON.stringify({ u: username, t: Date.now() }))
  const sig = await sign(payload)
  return `${payload}.${sig}`
}

/** Verify a session token signature */
export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const dotIdx = token.lastIndexOf(".")
    if (dotIdx < 1) return false
    const payload = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    return await verify(payload, sig)
  } catch {
    return false
  }
}

async function sign(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
}

async function verify(data: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  )
  const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0))
  return await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(data))
}

/** Get credentials from env vars */
export function getCredentials(): { username: string; password: string } {
  return {
    username: process.env.AUTH_USERNAME || "admin",
    password: process.env.AUTH_PASSWORD || "admin1234",
  }
}

/** Check if auth is disabled via env var */
export function isAuthDisabled(): boolean {
  return process.env.AUTH_DISABLED === "true"
}
