import type { NextRequest } from "next/server"
import { listCharacterWardrobe, saveCharacterSkin } from "@/lib/community-wardrobe"
import { wardrobeFailure, wardrobeResponse, wardrobeSession } from "@/lib/community-wardrobe-http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
type Context = {params:Promise<{id:string}>}

export async function GET(request:NextRequest,context:Context) {
  try {
    const {actor,staff} = await wardrobeSession(request)
    const {id} = await context.params
    return wardrobeResponse(await listCharacterWardrobe(id,actor,staff))
  } catch(error) { return wardrobeFailure(error) }
}

export async function POST(request:NextRequest,context:Context) {
  try {
    const {actor,staff} = await wardrobeSession(request,true)
    const {id} = await context.params
    return wardrobeResponse(await saveCharacterSkin(id,undefined,await request.formData(),actor,staff))
  } catch(error) { return wardrobeFailure(error) }
}
