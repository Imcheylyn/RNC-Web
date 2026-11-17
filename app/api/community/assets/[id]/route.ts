import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { getCommunitySession, hasStaffUnlock } from "@/lib/community-auth"
import { readR2Asset } from "@/lib/r2-storage"
import { visibleCharacterWhere } from "@/lib/community-policy"
import { prisma } from "@/lib/db"
import { communityAssetVersion } from "@/lib/community-asset-urls"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { session, cookie } = await getCommunitySession(request)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const isUnlockedStaff = session.isStaff && hasStaffUnlock(request, session)

  try {
    const { id } = await context.params
    const asset = await prisma.communityCharacterAsset.findFirst({
      where: { id, character: isUnlockedStaff ? {} : visibleCharacterWhere(session.userId) },
      select: {
        data: true,
        contentType: true,
        kind: true,
        storageBucket: true,
        storageKey: true,
        character: { select: { ownerId: true, publicationState: true } },
      },
    })
    if (!asset) return NextResponse.json({ error: "not-found" }, { status: 404 })
    if (asset.kind === "employee-card" && asset.character.ownerId !== session.userId && !isUnlockedStaff) {
      return NextResponse.json({ error: "not-found" }, { status: 404 })
    }
    if (asset.kind === "employee-signature" && asset.character.ownerId !== session.userId && !isUnlockedStaff && asset.character.publicationState !== "PUBLISHED") {
      return NextResponse.json({ error: "not-found" }, { status: 404 })
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(asset.contentType)) {
      return NextResponse.json({ error: "unsupported-image" }, { status: 415 })
    }
    const remote = Boolean(asset.storageBucket && asset.storageKey)
    if (!remote && !asset.data) return NextResponse.json({ error: "not-found" }, { status: 404 })
    // New uploads use new R2 keys. Check access before reusing browser bytes.
    const version = remote
      ? asset.storageBucket + "\0" + asset.storageKey + "\0" + asset.contentType
      : asset.data!
    const etag = '"' + createHash("sha256").update(version).digest("hex") + '"'
    const cacheControl = asset.character.publicationState === "PUBLISHED"
      && remote && request.nextUrl.searchParams.get("v") === communityAssetVersion(asset)
      && !["employee-card", "employee-signature"].includes(asset.kind)
      ? "private, max-age=60"
      : "private, no-cache"
    const headers = new Headers({
      "Cache-Control": cacheControl,
      "ETag": etag,
      "Vary": "Cookie",
      "X-Content-Type-Options": "nosniff",
    })
    if (cookie) headers.append("Set-Cookie", cookie)
    const matches = request.headers.get("if-none-match")?.split(",")
      .some(value => value.trim() === "*" || value.trim().replace(/^W\//, "") === etag)
    if (matches) return new Response(null, { status: 304, headers })
    const r2Data = asset.storageBucket && asset.storageKey
      ? await readR2Asset(asset.storageBucket, asset.storageKey)
      : null
    if (asset.storageBucket && asset.storageKey && !r2Data) {
      return NextResponse.json({ error: "not-found" }, { status: 404 })
    }
    const data = r2Data || (asset.data ? new Uint8Array(asset.data) : null)
    if (!data) return NextResponse.json({ error: "not-found" }, { status: 404 })
    headers.set("Content-Type", asset.contentType)
    headers.set("Content-Length", String(data.byteLength))
    return new Response(new Blob([Uint8Array.from(data).buffer]), {
      headers,
    })
  } catch (error) {
    console.error("[community/assets] read failed", error)
    return NextResponse.json({ error: "database-error" }, { status: 500 })
  }
}
