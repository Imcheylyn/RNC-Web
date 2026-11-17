import type { NextRequest } from "next/server"
import { collectionRequest } from "@/lib/community-collection-http"
import { getCharacterCollection } from "@/lib/community-collection"
export const runtime = "nodejs"
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}) {
  return collectionRequest(request,async(actor,staff)=>getCharacterCollection((await context.params).id,actor,staff))
}
