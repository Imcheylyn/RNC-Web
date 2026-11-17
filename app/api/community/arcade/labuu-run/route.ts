import type { NextRequest } from "next/server"
import { getCommunityGuildId } from "@/lib/community-auth"
import { collectionBody, collectionRequest } from "@/lib/community-collection-http"
import { CollectionError } from "@/lib/community-collection-policy"
import { finishLabuuRun, labuuRunLeaderboard, startLabuuRun } from "@/lib/community-labuu-run"

export const runtime = "nodejs"

export function GET(request: NextRequest) {
  return collectionRequest(request, actor => labuuRunLeaderboard(getCommunityGuildId(), actor.userId))
}

export function POST(request: NextRequest) {
  return collectionRequest(request, async actor => {
    const body = await collectionBody(request)
    const guildId = getCommunityGuildId()
    if (body.action === "start") return startLabuuRun(guildId, actor.userId, body.rulesVersion)
    if (body.action === "finish") return finishLabuuRun(guildId, actor.userId, body)
    throw new CollectionError("Invalid Labuu Run request")
  })
}
