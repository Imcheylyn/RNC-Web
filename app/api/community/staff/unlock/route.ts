import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
  getCommunitySession,
  isCommunityStaffConfigured,
  staffUnlockCookie,
  verifyCommunityStaffPasscode,
} from "@/lib/community-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5
const attempts = new Map<string, { count: number; startedAt: number }>()

export async function POST(request: NextRequest) {
  const result = await getCommunitySession(request)
  const { session } = result
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!isCommunityStaffConfigured()) {
    return NextResponse.json({ error: "staff-not-configured" }, { status: 503 })
  }
  if (!session.isStaff) {
    return NextResponse.json({ error: "staff-access-denied" }, { status: 403 })
  }

  const now = Date.now()
  let record = attempts.get(session.discordId)
  if (!record || now - record.startedAt >= WINDOW_MS) {
    record = { count: 0, startedAt: now }
    attempts.set(session.discordId, record)
  }
  if (record.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "try-again-later" }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }
  const passcode = body && typeof body === "object" && "passcode" in body
    ? (body as { passcode?: unknown }).passcode
    : null
  if (typeof passcode !== "string" || passcode.length > 256 || !verifyCommunityStaffPasscode(passcode)) {
    record.count += 1
    return NextResponse.json({ error: "staff-access-denied" }, { status: 401 })
  }

  attempts.delete(session.discordId)
  const response = NextResponse.json({ unlocked: true }, {
    headers: { "Cache-Control": "no-store" },
  })
  if (result.cookie) response.headers.append("Set-Cookie", result.cookie)
  response.headers.append("Set-Cookie", staffUnlockCookie(request, session))
  return response
}