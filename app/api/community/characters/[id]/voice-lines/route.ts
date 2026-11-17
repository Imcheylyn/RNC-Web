import type { NextRequest } from "next/server"
import { collectionRequest, collectionBody } from "@/lib/community-collection-http"
import { saveVoiceLine, reorderVoiceLines } from "@/lib/community-collection"
export const runtime = "nodejs"
type Context = {params:Promise<{id:string}>}
export async function POST(request:NextRequest,context:Context) {
  return collectionRequest(request,async(actor,staff)=>saveVoiceLine((await context.params).id,await collectionBody(request),actor,staff))
}
export async function PUT(request:NextRequest,context:Context) {
  return collectionRequest(request,async(actor,staff)=>{
    const body=await collectionBody(request),id=(await context.params).id
    return Object.hasOwn(body,"order") ? reorderVoiceLines(id,body,actor,staff) : saveVoiceLine(id,body,actor,staff)
  })
}
export async function DELETE(request:NextRequest,context:Context) {
  return collectionRequest(request,async(actor,staff)=>saveVoiceLine((await context.params).id,await collectionBody(request),actor,staff,true))
}
