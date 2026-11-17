import { NextResponse } from "next/server"
import { getCommunityContent } from "@/lib/community-management"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET() {
  try { return NextResponse.json(await getCommunityContent(), { headers: { "Cache-Control": "no-store" } }) }
  catch { return NextResponse.json({ error: "ไม่สามารถโหลดข้อมูล Community ได้" }, { status: 503 }) }
}
