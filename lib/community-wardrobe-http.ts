import { NextResponse, type NextRequest } from "next/server"
import { getCommunitySession, hasStaffUnlock } from "@/lib/community-auth"
import { WardrobeError } from "@/lib/community-wardrobe-policy"

export async function wardrobeSession(request:NextRequest, mutation = false) {
  if (mutation) {
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) throw new WardrobeError("ไม่สามารถยืนยันคำขอนี้ได้",403)
    if (Number(request.headers.get("content-length")) > 4.25 * 1024 * 1024) throw new WardrobeError("เตรียมรูปสำหรับบันทึกไม่สำเร็จ กรุณาเลือกไฟล์อีกครั้ง",413)
  }
  const {session} = await getCommunitySession(request)
  if (!session) throw new WardrobeError("กรุณาเข้าสู่ระบบใหม่",401)
  return {actor:session,staff:session.isStaff && hasStaffUnlock(request,session)}
}

export function wardrobeResponse(value:unknown) {
  return NextResponse.json(value,{headers:{"Cache-Control":"no-store"}})
}

export function wardrobeFailure(error:unknown) {
  if (error instanceof WardrobeError) return NextResponse.json({error:error.message},{status:error.status,headers:{"Cache-Control":"no-store"}})
  console.error("[community/wardrobe] request failed",error)
  return NextResponse.json({error:"ระบบตู้เสื้อผ้ายังไม่พร้อม ข้อมูลเดิมยังอยู่ครบ กรุณาลองอีกครั้ง"},{status:503,headers:{"Cache-Control":"no-store"}})
}
