import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { clearStaffUnlockCookie } from "@/lib/community-auth"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ locked: true }, {
    headers: { "Cache-Control": "no-store" },
  })
  response.headers.append("Set-Cookie", clearStaffUnlockCookie(request))
  return response
}