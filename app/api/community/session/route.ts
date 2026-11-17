import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getCommunitySession, isCommunityConfigured } from "@/lib/community-auth"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const result = await getCommunitySession(request)
  const response = NextResponse.json(
    result.session
      ? { authenticated: true, ...result.session }
      : { authenticated: false, configured: isCommunityConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  )
  if (result.cookie) response.headers.append("Set-Cookie", result.cookie)
  return response
}
