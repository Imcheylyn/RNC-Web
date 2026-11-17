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
      const conflicts = []
      // Lock in the same order across requests to avoid deadlocks between batches.
      for (const item of updates.sort((left, right) => left.id.localeCompare(right.id))) {
        await tx.$queryRaw`SELECT "id" FROM "CommunityCharacter" WHERE "id" = ${item.id} FOR UPDATE`
        const before = await tx.communityCharacter.findUnique({ where: { id: item.id } })
        if (!before || before.updatedAt.toISOString() !== item.expectedUpdatedAt) {
          conflicts.push({ id: item.id, error: before ? "ข้อมูลตัวละครถูกแก้ไขแล้ว" : "ไม่พบตัวละครในคลังแล้ว" })
          continue
        }
        const after = await tx.communityCharacter.update({
          where: { id: item.id },
          data: {
            heightChartScale: item.heightChartScale,
            heightChartOffset: item.heightChartOffset,
            heightChartXOffset: item.heightChartXOffset,
            updatedAt: new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1)),
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
      return { characters: saved, conflicts }
    }, { maxWait: 10_000, timeout: 30_000 })
  })
}
