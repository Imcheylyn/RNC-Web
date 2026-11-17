import { randomInt, randomUUID } from "node:crypto"
import { CollectionError } from "@/lib/community-collection-policy"
import { ARCADE_LEADERBOARD_LIMIT, rankArcadeScores } from "@/lib/community-arcade-leaderboard"
import { prisma } from "@/lib/db"
import { communityAssetSelect, communityAssetUrl } from "@/lib/community-asset-urls"
import { MAX_TICKS, MONSTER_RULES_VERSION, FORMATION_RULES_VERSION, EXPANDED_RULES_VERSION, RUNNER_RULES_VERSION, STEP_MS, replayRun } from "@/public/community/rnc/labuu-run-core.mjs"
import seedScores from "@/public/community/rnc/labuu-run-leaderboard-seeds.json"

const ROUND_EXPIRY_MS = 60 * 60_000
const CLOCK_TOLERANCE_MS = 1000
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

type RankingEntry = { rank: number; name: string; score: number; isMine: boolean }

function roundRules(roundId: string, seed: number) {
  if (roundId[14] !== "8") return { seed, rulesVersion: seed < 0 ? MONSTER_RULES_VERSION : 1 }
  // Older formation rounds never used zero. New rounds derive their seed from the UUID.
  if (seed === 0) return { seed: Number.parseInt(roundId.slice(0, 8), 16), rulesVersion: RUNNER_RULES_VERSION }
  return { seed, rulesVersion: seed < 0 ? EXPANDED_RULES_VERSION : FORMATION_RULES_VERSION }
}

export async function labuuRunLeaderboard(guildId: string, userId: string) {
  const entries = await prisma.$queryRaw<RankingEntry[]>`
    WITH ranked AS (
      SELECT "userId", "bestScore",
        (ROW_NUMBER() OVER (ORDER BY "bestScore" DESC, "bestAt", "userId"))::integer AS rank
      FROM "CommunityLabuuRunScore"
      WHERE "guildId" = ${guildId} AND "bestScore" IS NOT NULL
    )
    SELECT ranked.rank, player."displayName" AS name, ranked."bestScore" AS score,
      ranked."userId" = ${userId} AS "isMine"
    FROM ranked
    JOIN "CommunityUser" player ON player.id = ranked."userId"
    WHERE ranked.rank <= ${ARCADE_LEADERBOARD_LIMIT} OR ranked."userId" = ${userId}
    ORDER BY ranked.rank
  `
  return rankArcadeScores(entries, seedScores)
}

async function listRunnerMonsters() {
  const characters = await prisma.communityCharacter.findMany({
    where: { characterType: "Monster", publicationState: "PUBLISHED" },
    select: {
      updatedAt: true,
      assets: {
        where: { kind: { in: ["portrait", "gallery"] } },
        select: communityAssetSelect,
      },
    },
  })
  const sprites = characters.flatMap(({ assets, updatedAt }) => {
    const art = assets.find(asset => asset.kind === "portrait") ?? assets[0]
    return art ? [communityAssetUrl(art, updatedAt)] : []
  })
  // Sample a small pool per round to avoid loading the whole Enemy archive.
  const limit = Math.min(5, sprites.length)
  for (let i = 0; i < limit; i++) {
    const j = randomInt(i, sprites.length)
    const sprite = sprites[i]
    sprites[i] = sprites[j]
    sprites[j] = sprite
  }
  return sprites.slice(0, limit)
}

export async function startLabuuRun(guildId: string, userId: string, rulesVersion: unknown) {
  const monsters = await listRunnerMonsters()
  const seed = randomInt(1, 0x7fffffff)
  const uuid = randomUUID()
  const version = rulesVersion === RUNNER_RULES_VERSION || rulesVersion === EXPANDED_RULES_VERSION
    || rulesVersion === FORMATION_RULES_VERSION || rulesVersion === MONSTER_RULES_VERSION ? rulesVersion : 1
  const formationsEnabled = version >= FORMATION_RULES_VERSION
  const storedSeed = version === RUNNER_RULES_VERSION ? 0
    : version === MONSTER_RULES_VERSION || version === EXPANDED_RULES_VERSION ? -seed : seed
  const round = {
    roundId: formationsEnabled ? uuid.slice(0, 14) + "8" + uuid.slice(15) : uuid,
    seed: storedSeed,
    startedAt: new Date(),
    lastScore: null,
  }
  const saved = await prisma.communityLabuuRunScore.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId, ...round },
    update: round,
    select: { bestScore: true },
  })
  return {
    roundId: round.roundId,
    ...roundRules(round.roundId, round.seed),
    monsters,
    bestScore: saved.bestScore,
  }
}

export async function finishLabuuRun(guildId: string, userId: string, body: Record<string, unknown>) {
  const { roundId, finishTick, jumps } = body
  if (typeof roundId !== "string" || !UUID.test(roundId)
    || typeof finishTick !== "number" || !Number.isInteger(finishTick) || finishTick < 1 || finishTick > MAX_TICKS
    || !Array.isArray(jumps)) {
    throw new CollectionError("Invalid run data")
  }
  const receivedAt = new Date()
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`
      SELECT "userId" FROM "CommunityLabuuRunScore"
      WHERE "guildId" = ${guildId} AND "userId" = ${userId}
      FOR UPDATE
    `
    const key = { guildId_userId: { guildId, userId } }
    const round = await tx.communityLabuuRunScore.findUnique({ where: key })
    if (!round || round.roundId !== roundId) throw new CollectionError("This run has been replaced", 409)
    if (round.lastScore !== null) return { score: round.lastScore, bestScore: round.bestScore }
    const elapsed = receivedAt.getTime() - round.startedAt.getTime()
    if (elapsed > ROUND_EXPIRY_MS) throw new CollectionError("This run has expired", 410)
    if (elapsed < finishTick * STEP_MS - CLOCK_TOLERANCE_MS) throw new CollectionError("Invalid run timing")
    const rules = roundRules(round.roundId, round.seed)
    const score = replayRun(rules.seed, finishTick, jumps, rules.rulesVersion)
    if (score === null) throw new CollectionError("The score does not match this run")

    const improves = round.bestScore === null || score > round.bestScore
    const saved = await tx.communityLabuuRunScore.update({
      where: key,
      data: {
        lastScore: score,
        ...(improves ? { bestScore: score, bestAt: receivedAt } : {}),
      },
      select: { bestScore: true },
    })
    return { score, bestScore: saved.bestScore }
  })
}
