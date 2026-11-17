import type { NextRequest } from "next/server"
import { staffRequest, readCommunityBody, CommunityHttpError } from "@/lib/community-staff"
import { saveCommunityCharacter, CharacterInputError, CharacterAccessError, CharacterStorageError } from "@/lib/community-characters"
export const runtime = "nodejs"
export const maxDuration = 60
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return staffRequest(request, async actor => {
    try { return { character: await saveCommunityCharacter(actor.userId, await readCommunityBody(request), (await context.params).id, { staff: true, actor }) } }
    catch (error) {
      if (error instanceof CharacterInputError) throw new CommunityHttpError(error.message)
      if (error instanceof CharacterAccessError) throw new CommunityHttpError("ไม่พบตัวละคร", 404)
      if (error instanceof CharacterStorageError) throw new CommunityHttpError(error.message, 503)
      throw error
    }
  })
}
