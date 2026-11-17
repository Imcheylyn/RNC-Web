import { NextResponse } from "next/server"
import { getCommunityServerPreview, hasCommunityBotToken } from "@/lib/community-auth"

export const runtime = "nodejs"

export async function GET() {
  try {
    const preview = await getCommunityServerPreview()
    return NextResponse.json(preview, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[community-auth] Discord server preview failed", {
      status: error && typeof error === "object" && "status" in error ? error.status : null,
      discordCode: error && typeof error === "object" && "discordCode" in error ? error.discordCode : null,
    })
    return NextResponse.json(
      { error: "preview-unavailable" },
      { status: hasCommunityBotToken() ? 502 : 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
