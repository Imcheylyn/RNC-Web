import type { NextRequest } from "next/server"
import { staffRequest, readCommunityBody, CommunityHttpError } from "@/lib/community-staff"
import { saveCommunityCharacter, CharacterInputError, CharacterStorageError } from "@/lib/community-characters"
export const runtime = "nodejs"
export const maxDuration = 60
export async function POST(request: NextRequest) {
  return staffRequest(request, async actor => {
    try { return { character: await saveCommunityCharacter(actor.userId, await readCommunityBody(request), undefined, { staff: true, actor }) } }
    catch (error) {
      if (error instanceof CharacterInputError) throw new CommunityHttpError(error.message)
      if (error instanceof CharacterStorageError) throw new CommunityHttpError(error.message, 503)
      throw error
    }
  })
}
