import type { NextRequest } from "next/server"
import { startDiscordOAuth } from "@/lib/community-auth"

export const runtime = "nodejs"

export function GET(request: NextRequest) {
  return startDiscordOAuth(request)
}
