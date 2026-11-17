import type { NextRequest } from "next/server"
import { collectionRequest } from "@/lib/community-collection-http"
import { searchCollectionCharacters } from "@/lib/community-collection"
export const runtime = "nodejs"
export async function GET(request:NextRequest) {
  return collectionRequest(request,async(actor,staff)=>searchCollectionCharacters((request.nextUrl.searchParams.get("q") || "").slice(0,100),actor,staff,request.nextUrl.searchParams.get("exclude") || undefined,request.nextUrl.searchParams.get("sourceId") || undefined))
}
