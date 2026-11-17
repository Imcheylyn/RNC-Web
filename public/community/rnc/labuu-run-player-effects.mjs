import { GROUND, PLAYER_X, PLAYER_WIDTH, PLAYER_HEIGHT, playerClearance, SNEEZE_RETREAT_START, sneezeShots } from "./labuu-run-core.mjs?v=8"

const TAU = Math.PI * 2
const SPIN_TICKS = 22
const GLANCE_TICKS = 18
export const CRASH_MS = 440

const unit = value => Math.max(0, Math.min(1, value))
const smooth = value => {
  const t = unit(value)
  return t * t * (3 - 2 * t)
}

export function createPlayerEffects() {
  return { spinAt: -Infinity, glanceAt: -Infinity, closePasses: new WeakSet() }
}

export function markPlayerJump(effects, run) {
  if (run.jumps === 2) effects.spinAt = run.tick
}

export function trackClosePasses(effects, run) {
  for (const obstacle of run.obstacles) {
    const gap = playerClearance(run, obstacle)
    if (gap >= 0 && gap <= 17) effects.closePasses.add(obstacle)
    if (!effects.closePasses.has(obstacle) || obstacle.x + obstacle.width - 8 > PLAYER_X + 10) continue
    effects.closePasses.delete(obstacle)
    if (run.tick - effects.glanceAt > GLANCE_TICKS + 8) effects.glanceAt = run.tick
  }
}

function bossReaction(run, tick) {
  const boss = run.obstacles.find(obstacle => obstacle.motion === "encore")
  if (!boss) return null
  const age = tick - boss.spawnedAt
  const relief = (age - SNEEZE_RETREAT_START - 7) / 25
  if (relief >= 0 && relief < 1) return { kind: "relief", progress: relief }
  const secondSneeze = sneezeShots(boss).at(-2)[0]
  const shock = (age - secondSneeze + 22) / 16
  return shock >= 0 && shock < 1 ? { kind: "shock", progress: shock } : null
}

export function playerPose(run, effects, tick, height, stride, reduced, crashProgress) {
  const pose = { x: PLAYER_X, bottom: GROUND - height - stride, angle: 0, scaleX: 1, scaleY: 1, cue: null }
  const spin = (tick - effects.spinAt) / SPIN_TICKS
  const glance = (tick - effects.glanceAt) / GLANCE_TICKS
  const reaction = bossReaction(run, tick)

  if (spin >= 0 && spin < 1) {
    pose.angle = reduced ? 0 : smooth(spin) * TAU
    pose.cue = { kind: "spin", progress: spin }
  } else if (reaction?.kind === "shock") {
    const lift = Math.sin(Math.PI * reaction.progress)
    if (!reduced) {
      pose.bottom -= lift * 6
      pose.scaleY += lift * .12
      pose.angle -= lift * .13
    }
    pose.cue = reaction
  } else if (glance >= 0 && glance < 1) {
    const turn = smooth(glance / .25) * (1 - smooth((glance - .65) / .35))
    pose.scaleX = reduced ? 1 : Math.cos(Math.PI * turn)
    pose.cue = { kind: "glance", progress: glance }
  } else if (reaction) {
    if (!reduced) pose.angle = .14 * Math.sin(Math.PI * reaction.progress)
    pose.cue = reaction
  }
  if (crashProgress == null) return pose

  const time = smooth(crashProgress)
  const rolling = ["roll", "cargo", "bus-chaser"].includes(run.hitMotion)
  const airborne = run.hitMotion === "fly" || run.hitMotion === "carrier"
  const falling = run.hitMotion === "drop"
  const lift = reduced ? 0 : Math.sin(Math.PI * time) * (rolling ? 10 : 3)
  const turn = rolling ? -TAU - Math.PI / 2 : falling ? .1 : Math.PI * (airborne ? .56 : .43)
  const restAngle = Math.round(pose.angle / TAU) * TAU + turn
  pose.x += (rolling ? -25 : airborne ? 23 : 12) * time
  pose.bottom = GROUND - height * (1 - time) - lift
  pose.angle += (restAngle - pose.angle) * time
  pose.scaleX += (1 - pose.scaleX) * time
  pose.scaleY += ((falling ? .56 : airborne ? .78 : .93) - pose.scaleY) * time
  pose.cue = { kind: "crash", progress: crashProgress }
  return pose
}

export function drawPlayerCue(ctx, pose, reduced) {
  if (!pose.cue) return
  const { kind, progress } = pose.cue
  const x = pose.x + PLAYER_WIDTH / 2
  const y = pose.bottom - PLAYER_HEIGHT
  const fade = Math.sin(Math.PI * progress)
  if (fade <= 0) return

  ctx.save()
  ctx.globalAlpha = fade * .85
  ctx.fillStyle = "#865232"
  ctx.strokeStyle = "#865232"
  ctx.lineWidth = 1.5

  if (kind === "spin" || kind === "glance") {
    const trailing = kind === "spin" ? -24 : -29
    for (let index = 0; index < 3; index++) {
      ctx.fillRect(x + trailing - index * 4, y + 17 + index * 6, 10 - index * 2, 1.5)
    }
  } else if (kind === "relief") {
    const drift = reduced ? 0 : progress * 9
    ctx.beginPath()
    ctx.moveTo(x + 18, y + 5 + drift)
    ctx.quadraticCurveTo(x + 28, y + 14 + drift, x + 22, y + 17 + drift)
    ctx.quadraticCurveTo(x + 16, y + 17 + drift, x + 18, y + 5 + drift)
    ctx.fill()
  } else if (kind === "shock") {
    ctx.fillRect(x + 19, y - 9, 2, 9)
    ctx.fillRect(x + 19, y + 2, 2, 2)
    ctx.beginPath()
    ctx.moveTo(x + 11, y - 3)
    ctx.lineTo(x + 7, y - 9)
    ctx.moveTo(x + 27, y - 3)
    ctx.lineTo(x + 31, y - 8)
    ctx.stroke()
  } else {
    const drift = reduced ? 0 : progress * 19
    for (const [index, direction] of [-1, 1].entries()) {
      const center = x + direction * (21 + drift)
      const top = y + 15 - progress * 8 + index * 10
      ctx.fillRect(center - 4, top - 1, 8, 2)
      ctx.fillRect(center - 1, top - 4, 2, 8)
    }
  }
  ctx.restore()
}
