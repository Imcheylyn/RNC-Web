import { NextResponse, type NextRequest } from "next/server"
import { getCommunitySession, hasStaffUnlock, type CommunitySession } from "@/lib/community-auth"
import { CollectionError, object } from "@/lib/community-collection-policy"

export async function collectionBody(request: NextRequest) {
  if (Number(request.headers.get("content-length")) > 1024 * 1024) throw new CollectionError("ข้อมูลรายการมีขนาดใหญ่เกินไป", 413)
  try { return object(await request.json()) } catch (error) {
    if (error instanceof CollectionError) throw error
    throw new CollectionError("อ่านข้อมูลที่ส่งมาไม่สำเร็จ")
  }
}

export async function collectionRequest(request: NextRequest, handler: (actor: CommunitySession, staff: boolean) => Promise<unknown>) {
  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      const origin = request.headers.get("origin")
      if (origin && origin !== request.nextUrl.origin) throw new CollectionError("คำขอไม่ได้มาจากเว็บไซต์นี้", 403)
    }
    const result = await getCommunitySession(request)
    if (!result.session) throw new CollectionError("กรุณาเข้าสู่ระบบใหม่", 401)
    const value = await handler(result.session, result.session.isStaff && hasStaffUnlock(request, result.session))
    const response = value instanceof Response ? value : NextResponse.json(value, { headers: { "Cache-Control":"no-store" } })
    if (result.cookie) response.headers.append("Set-Cookie", result.cookie)
    return response
  } catch (error) {
    if (error instanceof CollectionError) return NextResponse.json({error:error.message},{status:error.status,headers:{"Cache-Control":"no-store"}})
    console.error("[community/collection] operation failed", error)
    return NextResponse.json({error:"บันทึกไม่สำเร็จ ข้อมูลเดิมยังอยู่ กรุณาลองอีกครั้ง"},{status:503,headers:{"Cache-Control":"no-store"}})
  }
}
