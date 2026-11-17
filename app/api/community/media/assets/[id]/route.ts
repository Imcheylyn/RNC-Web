import type { NextRequest } from "next/server"
import { collectionRequest } from "@/lib/community-collection-http"
import { readableMedia } from "@/lib/community-media"
import { mediaSignedUrl } from "@/lib/r2-media-storage"
export const runtime = "nodejs"
type Context = {params:Promise<{id:string}>}
export async function GET(request:NextRequest,context:Context) {
  return collectionRequest(request,async(actor,staff)=>{
    const asset = await readableMedia((await context.params).id,actor,staff)
    return new Response(null,{status:307,headers:{Location:mediaSignedUrl(asset,"GET"),"Cache-Control":"private, no-store","Vary":"Cookie"}})
  })
}
export async function HEAD(request:NextRequest,context:Context) {
  return collectionRequest(request,async(actor,staff)=>{
    const asset = await readableMedia((await context.params).id,actor,staff)
    return new Response(null,{headers:{"Content-Type":asset.contentType,"Content-Length":String(asset.byteSize),"Accept-Ranges":"bytes","Cache-Control":"private, no-store","Vary":"Cookie"}})
  })
}
