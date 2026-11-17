import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { logoutCommunitySession } from "@/lib/community-auth"

export const runtime = "nodejs"

export function POST(request: NextRequest) {
  const origin = request.headers.get("origin")
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } })
  }
  return logoutCommunitySession(request)
}
