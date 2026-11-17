import { randomUUID } from "node:crypto"
import { CollectionError } from "@/lib/community-collection-policy"
import { prisma } from "@/lib/db"
import seedScores from "@/public/community/rnc/labuu-leaderboard-seeds.json"

const DURATION_MS = 60_000
const FINISH_GRACE_MS = 2_500
const ROUND_EXPIRY_MS = 5 * 60_000
const REAL_TARGETS = 7
const DECOY_TARGETS = 2
const MAX_CLICKS = 100
const LEADERBOARD_LIMIT = 10
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

type RankingEntry = {
  rank: number
  name: string
  score: number
  remainingMs: number
  isMine: boolean
}

export async function labuuLeaderboard(guildId: string, userId: string) {
  const entries = await prisma.$queryRaw<RankingEntry[]>`
    WITH ranked AS (
      SELECT "userId", "bestScore", "bestRemainingMs",
        (ROW_NUMBER() OVER (
          ORDER BY "bestScore" DESC, "bestRemainingMs" DESC, "bestAt", "userId"
        ))::integer AS rank
      FROM "CommunityLabuuScore"
      WHERE "guildId" = ${guildId} AND "bestScore" IS NOT NULL
    )
    SELECT ranked.rank, player."displayName" AS name,
      ranked."bestScore" AS score, ranked."bestRemainingMs" AS "remainingMs",
      ranked."userId" = ${userId} AS "isMine"
    FROM ranked
    JOIN "CommunityUser" player ON player.id = ranked."userId"
    WHERE ranked.rank <= ${LEADERBOARD_LIMIT} OR ranked."userId" = ${userId}
    ORDER BY ranked.rank
  `
  const players = entries.filter(entry => entry.rank <= LEADERBOARD_LIMIT)
  const seeded = seedScores.map(entry => ({ ...entry, remainingMs: 0, isMine: false, isSeed: true }))
  // Players keep their database tie order and place above a seeded score on a tie.
  const top = [...players, ...seeded]
    .sort((left, right) => right.score - left.score)
    .slice(0, LEADERBOARD_LIMIT)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))

  const savedScore = entries.find(entry => entry.isMine)
  const personal = savedScore ? {
    ...savedScore,
    rank: savedScore.rank + seedScores.filter(entry => entry.score > savedScore.score).length,
  } : null

  return { top, personal }
}

export async function startLabuuRound(guildId: string, userId: string) {
  const roundId = randomUUID()
  const targetIds = Array.from({ length: REAL_TARGETS + DECOY_TARGETS }, () => randomUUID())
  const currentRound = { roundId, targetIds, startedAt: new Date(), lastScore: null }

  await prisma.communityLabuuScore.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId, ...currentRound },
    update: currentRound,
  })

  return { roundId, targets: targetIds, durationMs: DURATION_MS }
}

export async function finishLabuuRound(guildId: string, userId: string, body: Record<string, unknown>) {
  const { roundId, clicks } = body
  if (typeof roundId !== "string" || !UUID.test(roundId) || !Array.isArray(clicks)
    || clicks.length > MAX_CLICKS || !clicks.every(id => typeof id === "string" && UUID.test(id))) {
    throw new CollectionError("ข้อมูลรอบเล่นไม่ถูกต้อง")
  }
  const receivedAt = new Date()

  return prisma.$transaction(async tx => {
    await tx.$queryRaw`
      SELECT "userId" FROM "CommunityLabuuScore"
      WHERE "guildId" = ${guildId} AND "userId" = ${userId}
      FOR UPDATE
    `

    const key = { guildId_userId: { guildId, userId } }
    const round = await tx.communityLabuuScore.findUnique({ where: key })
    if (!round || round.roundId !== roundId) {
      throw new CollectionError("รอบเล่นนี้ถูกแทนที่แล้ว", 409)
    }
    if (round.lastScore !== null) return { score: round.lastScore, bestScore: round.bestScore }

    const elapsed = receivedAt.getTime() - round.startedAt.getTime()
    if (elapsed < 0 || elapsed > ROUND_EXPIRY_MS) {
      throw new CollectionError("รอบเล่นหมดอายุแล้ว", 410)
    }

    const found = new Set<string>()
    let misses = 0
    for (const id of clicks) {
      const target = round.targetIds.indexOf(id)
      if (target === -1 || (target < REAL_TARGETS && found.has(id)) || found.size === REAL_TARGETS) {
        throw new CollectionError("ลำดับการคลิกไม่ถูกต้อง")
      }
      if (target < REAL_TARGETS) found.add(id)
      else misses++
    }

    const won = found.size === REAL_TARGETS
    if ((!won && elapsed < DURATION_MS) || (won && elapsed > DURATION_MS + FINISH_GRACE_MS)) {
      throw new CollectionError("ผลการเล่นอยู่นอกเวลาของรอบนี้", 409)
    }
    const remainingMs = won ? Math.max(0, DURATION_MS - elapsed) : 0
    const score = Math.max(0, found.size * 1_000 + Math.floor(remainingMs / 1_000) * 25 - misses * 100)
    const improves = round.bestScore === null || score > round.bestScore
      || (score === round.bestScore && remainingMs > round.bestRemainingMs)

    const saved = await tx.communityLabuuScore.update({
      where: key,
      data: {
        lastScore: score,
        targetIds: [],
        ...(improves ? { bestScore: score, bestRemainingMs: remainingMs, bestAt: receivedAt } : {}),
      },
      select: { bestScore: true },
    })
    return { score, bestScore: saved.bestScore }
  })
}
