import type { NextRequest } from "next/server"
import { collectionRequest, collectionBody } from "@/lib/community-collection-http"
import { saveThemeSong } from "@/lib/community-collection"
export const runtime = "nodejs"
export async function PUT(request:NextRequest,context:{params:Promise<{id:string}>}) {
  return collectionRequest(request,async(actor,staff)=>saveThemeSong((await context.params).id,await collectionBody(request),actor,staff))
}
