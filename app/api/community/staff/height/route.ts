import type { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { audit, CommunityHttpError, readCommunityBody, staffRequest } from "@/lib/community-staff"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type CalibrationUpdate = {
  id: string
  expectedUpdatedAt: string
  heightChartScale: number
  heightChartOffset: number
  heightChartXOffset: number
}

function calibration(value: unknown): CalibrationUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CommunityHttpError("ข้อมูลการจัดตำแหน่งไม่ถูกต้อง")
  }
  const item = value as Record<string, unknown>
  const number = (key: string, min: number, max: number) => {
    const result = item[key]
    if (typeof result !== "number" || !Number.isFinite(result) || result < min || result > max) {
      throw new CommunityHttpError("ค่าขนาดหรือตำแหน่งอยู่นอกช่วงที่กำหนด")
    }
    return result
  }
  if (typeof item.id !== "string" || !item.id || item.id.length > 80
    || typeof item.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(item.expectedUpdatedAt))) {
    throw new CommunityHttpError("ไม่พบข้อมูลตัวละครที่ต้องการบันทึก")
  }
  return {
    id: item.id,
    expectedUpdatedAt: item.expectedUpdatedAt,
    heightChartScale: number("heightChartScale", 0.5, 1.5),
    heightChartOffset: number("heightChartOffset", -60, 60),
    heightChartXOffset: number("heightChartXOffset", -140, 140),
  }
}

export async function POST(request: NextRequest) {
  return staffRequest(request, async actor => {
    const body = await readCommunityBody(request)
    if (!Array.isArray(body.updates) || body.updates.length < 1 || body.updates.length > 300) {
      throw new CommunityHttpError("ไม่มีรายการที่ต้องบันทึก หรือมีรายการมากเกินไป")
    }
    const updates = body.updates.map(calibration)
    if (new Set(updates.map(item => item.id)).size !== updates.length) {
      throw new CommunityHttpError("มีตัวละครซ้ำในรายการบันทึก")
    }

    return prisma.$transaction(async tx => {
      const saved = []
      for (const item of updates) {
        const before = await tx.communityCharacter.findUnique({ where: { id: item.id } })
        if (!before) throw new CommunityHttpError("ไม่พบตัวละครในคลังแล้ว กรุณาโหลดหน้าใหม่", 404)
        if (before.updatedAt.toISOString() !== item.expectedUpdatedAt) {
          throw new CommunityHttpError("มีข้อมูลตัวละครถูกแก้ไขแล้ว กรุณาโหลดหน้าใหม่ก่อนบันทึก", 409)
        }
        const after = await tx.communityCharacter.update({
          where: { id: item.id },
          data: {
            heightChartScale: item.heightChartScale,
            heightChartOffset: item.heightChartOffset,
            heightChartXOffset: item.heightChartXOffset,
          },
          select: {
            id: true,
            updatedAt: true,
            heightChartScale: true,
            heightChartOffset: true,
            heightChartXOffset: true,
          },
        })
        await audit(
          tx,
          actor,
          "UPDATE",
          "character-height",
          after.id,
          "ปรับขนาดและตำแหน่งใน Character Height",
          { heightChartScale: before.heightChartScale, heightChartOffset: before.heightChartOffset, heightChartXOffset: before.heightChartXOffset },
          { heightChartScale: after.heightChartScale, heightChartOffset: after.heightChartOffset, heightChartXOffset: after.heightChartXOffset },
        )
        saved.push(after)
      }
      return { characters: saved }
    }, { maxWait: 10_000, timeout: 30_000 })
  })
}
