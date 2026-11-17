import type { NextRequest } from "next/server"
import { deleteCharacterSkin, saveCharacterSkin } from "@/lib/community-wardrobe"
import { wardrobeFailure, wardrobeResponse, wardrobeSession } from "@/lib/community-wardrobe-http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
type Context = {params:Promise<{id:string;skinId:string}>}

export async function PUT(request:NextRequest,context:Context) {
  try {
    const {actor,staff} = await wardrobeSession(request,true)
    const {id,skinId} = await context.params
    return wardrobeResponse(await saveCharacterSkin(id,skinId,await request.formData(),actor,staff))
  } catch(error) { return wardrobeFailure(error) }
}

export async function DELETE(request:NextRequest,context:Context) {
  try {
    const {actor,staff} = await wardrobeSession(request,true)
    const {id,skinId} = await context.params
    const body = await request.json()
    return wardrobeResponse(await deleteCharacterSkin(id,skinId,body?.expectedUpdatedAt,actor,staff))
  } catch(error) { return wardrobeFailure(error) }
}
