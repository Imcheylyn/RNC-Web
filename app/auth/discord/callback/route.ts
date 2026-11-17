import type { NextRequest } from "next/server"
import { completeDiscordOAuth } from "@/lib/community-auth"

export const runtime = "nodejs"

export function GET(request: NextRequest) {
  return completeDiscordOAuth(request)
}
