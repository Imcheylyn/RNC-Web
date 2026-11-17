import type { NextRequest } from "next/server"
import { getCommunityGuildId } from "@/lib/community-auth"
import { collectionBody, collectionRequest } from "@/lib/community-collection-http"
import { CollectionError } from "@/lib/community-collection-policy"
import { finishLabuuRound, labuuLeaderboard, startLabuuRound } from "@/lib/community-labuu"

export const runtime = "nodejs"

export function GET(request: NextRequest) {
  return collectionRequest(request, actor => labuuLeaderboard(getCommunityGuildId(), actor.userId))
}

export function POST(request: NextRequest) {
  return collectionRequest(request, async actor => {
    const body = await collectionBody(request)
    const guildId = getCommunityGuildId()
    if (body.action === "start") return startLabuuRound(guildId, actor.userId)
    if (body.action === "finish") return finishLabuuRound(guildId, actor.userId, body)
    throw new CollectionError("คำขอ Arcade ไม่ถูกต้อง")
  })
}
