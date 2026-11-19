import { createHmac, timingSafeEqual } from "node:crypto"
import { CollectionError } from "@/lib/community-collection-policy"
import { createRun, replaySegment, RUNNER_RULES_VERSION, STEP_MS } from "@/public/community/rnc/labuu-run-core.mjs"

const CHECKPOINT_LIFETIME_MS = 60 * 60_000
const CLOCK_TOLERANCE_MS = 1000
type Progress = {
  guildId: string
  userId: string
  roundId: string
  seed: number
  startedAt: number
  expiresAt: number
  run: ReturnType<typeof createRun>
}

function signature(body: string) {
  const secret = process.env.COMMUNITY_SESSION_SECRET || process.env.COMMUNITY_DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET
  if (!secret) throw new CollectionError("Score service unavailable", 503)
  return createHmac("sha256", secret).update("RNC:labuu-run-checkpoint:v1:").update(body).digest()
}

function seal(progress: Progress) {
  const body = Buffer.from(JSON.stringify({ ...progress, expiresAt: Date.now() + CHECKPOINT_LIFETIME_MS })).toString("base64url")
  return body + "." + signature(body).toString("base64url")
}

export function issueRunnerCheckpoint(guildId: string, userId: string, roundId: string, seed: number, startedAt: Date) {
  return seal({ guildId, userId, roundId, seed, startedAt: startedAt.getTime(), expiresAt: 0, run: createRun(seed, RUNNER_RULES_VERSION) })
}

export function verifyRunnerProgress(guildId: string, userId: string, body: Record<string, unknown>, terminal: boolean): Progress {
  if (typeof body.checkpoint !== "string" || body.checkpoint.length > 24_000) throw new CollectionError("Invalid run checkpoint")
  const [payload, proof, extra] = body.checkpoint.split(".")
  if (!payload || !proof || extra !== undefined) throw new CollectionError("Invalid run checkpoint")
  const expected = signature(payload), received = Buffer.from(proof, "base64url")
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new CollectionError("Invalid run checkpoint")
  let progress: Progress
  try { progress = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) } catch { throw new CollectionError("Invalid run checkpoint") }
  if (!progress || progress.guildId !== guildId || progress.userId !== userId || progress.roundId !== body.roundId
    || !Number.isFinite(progress.startedAt) || !Number.isFinite(progress.expiresAt)
    || progress.run?.rulesVersion !== RUNNER_RULES_VERSION || progress.run.ended) throw new CollectionError("Invalid run checkpoint")
  if (Date.now() > progress.expiresAt) throw new CollectionError("This run checkpoint has expired", 410)
  const finishTick = body.finishTick
  if (typeof finishTick !== "number" || !Number.isSafeInteger(finishTick)
    || Date.now() - progress.startedAt < finishTick * STEP_MS - CLOCK_TOLERANCE_MS) throw new CollectionError("Invalid run timing")
  const run = replaySegment(progress.run, finishTick, body.jumps, body.dives, terminal)
  if (!run) throw new CollectionError("The score does not match this run")
  return { ...progress, run }
}

// No score write or Enemy lookup here: only validate the next bounded segment.
export async function checkpointLabuuRun(guildId: string, userId: string, body: Record<string, unknown>) {
  const progress = verifyRunnerProgress(guildId, userId, body, false)
  return { checkpoint: seal(progress), checkpointTick: progress.run.tick }
}
