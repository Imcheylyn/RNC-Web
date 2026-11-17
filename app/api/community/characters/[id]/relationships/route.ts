import type { NextRequest } from "next/server"
import { collectionRequest, collectionBody } from "@/lib/community-collection-http"
import { saveRelationship } from "@/lib/community-collection"
export const runtime = "nodejs"
type Context = {params:Promise<{id:string}>}
export async function POST(request:NextRequest,context:Context) {
  return collectionRequest(request,async(actor,staff)=>saveRelationship((await context.params).id,await collectionBody(request),actor,staff))
}
export async function DELETE(request:NextRequest,context:Context) {
  return collectionRequest(request,async(actor,staff)=>saveRelationship((await context.params).id,await collectionBody(request),actor,staff,true))
}
