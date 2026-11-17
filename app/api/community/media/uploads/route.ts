import type { NextRequest } from "next/server"
import { collectionRequest, collectionBody } from "@/lib/community-collection-http"
import { beginMediaUpload, completeMediaUpload, discardMediaUpload } from "@/lib/community-media"
import { field } from "@/lib/community-collection-policy"
export const runtime = "nodejs"
export const maxDuration = 60
export async function POST(request:NextRequest) {
  return collectionRequest(request,async(actor,staff)=>beginMediaUpload(await collectionBody(request),actor,staff))
}
export async function PUT(request:NextRequest) {
  return collectionRequest(request,async(actor)=>completeMediaUpload(await collectionBody(request),actor))
}
export async function DELETE(request:NextRequest) {
  return collectionRequest(request,async(actor)=>discardMediaUpload(field((await collectionBody(request)).id,100,true),actor))
}
