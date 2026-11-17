import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { getCommunitySession, hasStaffUnlock, type CommunitySession } from "@/lib/community-auth"

export class CommunityHttpError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

export async function readCommunityBody(request: NextRequest): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 12 * 1024 * 1024) throw new CommunityHttpError("ข้อมูลมีขนาดใหญ่เกินไป", 413)
  let body: unknown
  try { body = await request.json() } catch { throw new CommunityHttpError("ข้อมูลที่ส่งมาไม่ถูกต้อง") }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CommunityHttpError("ข้อมูลที่ส่งมาไม่ถูกต้อง")
  return body as Record<string, unknown>
}

export async function staffRequest(request: NextRequest, handler: (session: CommunitySession) => Promise<unknown>) {
  try {
    const origin = request.headers.get("origin")
    if (request.method !== "GET" && origin && origin !== new URL(request.url).origin) throw new CommunityHttpError("คำขอไม่ได้มาจากเว็บไซต์นี้", 403)
    const result = await getCommunitySession(request)
    if (!result.session) throw new CommunityHttpError("กรุณาเข้าสู่ระบบ Discord อีกครั้ง", 401)
    if (!result.session.isStaff) throw new CommunityHttpError("บัญชีนี้ไม่มีสิทธิ์ Staff", 403)
    if (!hasStaffUnlock(request, result.session)) throw new CommunityHttpError("กรุณาปลดล็อกโหมด Staff อีกครั้ง", 403)
    const response = NextResponse.json(await handler(result.session), { headers: { "Cache-Control": "no-store" } })
    if (result.cookie) response.headers.append("Set-Cookie", result.cookie)
    return response
  } catch (error) {
    if (error instanceof CommunityHttpError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "ชื่อนี้ถูกใช้แล้ว" }, { status: 409 })
    if (process.env.NODE_ENV === "development") {
      console.error("[community/staff] operation failed", error)
    } else {
      console.error("[community/staff] operation failed", error instanceof Error ? error.name : "unknown")
    }
    const message = process.env.NODE_ENV === "development" && error instanceof Error
      ? `${error.name}: ${error.message}`
      : "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export function snapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export async function audit(transaction: Prisma.TransactionClient, actor: CommunitySession, action: string, entityType: string, entityId: string, summary: string, before?: unknown, after?: unknown) {
  await transaction.communityAuditLog.create({ data: {
    actorId: actor.userId, actorDiscordId: actor.discordId, actorName: actor.name,
    action, entityType, entityId, summary,
    before: before == null ? Prisma.DbNull : snapshot(before),
    after: after == null ? Prisma.DbNull : snapshot(after),
  } })
}
