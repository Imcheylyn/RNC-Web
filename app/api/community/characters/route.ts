import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getCommunitySession, hasStaffUnlock } from "@/lib/community-auth"
import { prisma } from "@/lib/db"
import { communityAssetSelect, communityAssetUrl } from "@/lib/community-asset-urls"
import { visibleCharacterWhere } from "@/lib/community-policy"
import {
  CharacterInputError,
  CharacterStorageError,
  listCommunityCharacters,
  saveCommunityCharacter,
} from "@/lib/community-characters"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const { session } = await getCommunitySession(request)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    if (request.nextUrl.searchParams.get("view") === "relationships") {
      const staff = session.isStaff && hasStaffUnlock(request, session)
      const characters = await prisma.communityCharacter.findMany({
        where: {
          AND: [
            staff ? {} : visibleCharacterWhere(session.userId),
            { characterType: { notIn: ["Monster", "Enemy"] } },
          ],
        },
        select: {
          id: true,
          name: true,
          characterType: true,
          updatedAt: true,
          assets: {
            where: { kind: { in: ["portrait", "gallery"] } },
            select: communityAssetSelect,
          },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      })
      const ids = characters.map((character) => character.id)
      const relationships = ids.length
        ? await prisma.communityCharacterRelationship.findMany({
            where: { sourceId: { in: ids }, targetId: { in: ids } },
            select: { id: true, sourceId: true, targetId: true, type: true, label: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 5000,
          })
        : []
      return NextResponse.json(
        {
          characters: characters.map((character) => {
            const image = character.assets.find((asset) => asset.kind === "portrait") || character.assets[0]
            return {
              id: character.id,
              name: character.name,
              characterType: character.characterType,
              image: communityAssetUrl(image, character.updatedAt),
            }
          }),
          relationships,
        },
        { headers: { "Cache-Control": "no-store" } },
      )
    }

    return NextResponse.json(
      { characters: await listCommunityCharacters(session.userId) },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("[community/characters] list failed", error)
    return NextResponse.json({ error: "database-error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { session } = await getCommunitySession(request)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const character = await saveCommunityCharacter(session.userId, await request.json())
    return NextResponse.json({ character }, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    if (error instanceof CharacterInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof CharacterStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("[community/characters] create failed", error)
    return NextResponse.json({ error: "database-error" }, { status: 500 })
  }
}
