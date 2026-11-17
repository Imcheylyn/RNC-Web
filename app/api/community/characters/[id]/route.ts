import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getCommunitySession } from "@/lib/community-auth"
import {
  CharacterAccessError,
  CharacterInputError,
  CharacterStorageError,
  deleteCommunityCharacter,
  saveCommunityCharacter,
} from "@/lib/community-characters"

export const runtime = "nodejs"
export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, context: RouteContext) {
  const { session } = await getCommunitySession(request)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const { id } = await context.params
    const character = await saveCommunityCharacter(session.userId, await request.json(), id)
    return NextResponse.json({ character }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof CharacterInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof CharacterStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof CharacterAccessError) {
      return NextResponse.json({ error: "not-found" }, { status: 404 })
    }
    console.error("[community/characters] update failed", error)
    return NextResponse.json({ error: "database-error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { session } = await getCommunitySession(request)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const { id } = await context.params
    await deleteCommunityCharacter(session.userId, id)
    return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof CharacterAccessError) {
      return NextResponse.json({ error: "not-found" }, { status: 404 })
    }
    console.error("[community/characters] delete failed", error)
    return NextResponse.json({ error: "database-error" }, { status: 500 })
  }
}
