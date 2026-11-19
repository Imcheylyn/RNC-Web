import { WIDTH, HEIGHT, GROUND, SNEEZE_X, SNEEZE_FIRST_SHOT, SNEEZE_RETREAT_START, SNEEZE_RETREAT_TICKS } from "./labuu-run-core.mjs?v=9"

const FIRST_STEP = 8
const STEP_TICKS = 10
const FOOTFALLS = [18, 28, 38]
const LAST_FOOTFALL = FOOTFALLS.at(-1)
const ENTRANCE_TICKS = SNEEZE_FIRST_SHOT

const clamp = value => Math.max(0, Math.min(1, value))
const smooth = value => {
  const t = clamp(value)
  return t * t * (3 - 2 * t)
}

function stepX(progress) {
  return WIDTH + 12 + (SNEEZE_X - WIDTH - 12) * progress
}

export function bossEntrance(obstacles, tick, reducedMotion) {
  const boss = obstacles.find(obstacle => (obstacle.motion === "sneeze" || obstacle.motion === "encore")
    && tick >= obstacle.spawnedAt && tick < obstacle.spawnedAt + ENTRANCE_TICKS)
  if (!boss) return null

  const age = tick - boss.spawnedAt
  const step = Math.min(FOOTFALLS.length, Math.max(0, (age - FIRST_STEP) / STEP_TICKS))
  const fraction = step % 1
  const progress = smooth((age - FIRST_STEP) / (LAST_FOOTFALL - FIRST_STEP))
  const lift = 4 * Math.sin(Math.PI * fraction) ** 2
  const pan = 15 * smooth((age - 8) / 23) * (1 - smooth((age - 32) / 23))
  const impact = age - LAST_FOOTFALL
  const shake = smooth(impact / 3) * (1 - smooth(impact / 14))

  // Apply the same offset to the whole field so the hitboxes stay aligned on screen.
  return {
    boss, age, reducedMotion,
    hideBoss: age < FIRST_STEP,
    x: stepX(progress),
    lift: reducedMotion ? 0 : lift,
    tilt: reducedMotion ? 0 : Math.sin(2 * Math.PI * step) * .028,
    cameraX: reducedMotion ? 0 : -pan + Math.sin(impact * .7) * shake * 1.4,
    cameraY: reducedMotion ? 0 : Math.sin(impact * .45) * shake * 2.1,
  }
}

export function bossRetreatPosition(obstacle, tick) {
  if (obstacle.motion !== "encore") return
  const phase = (tick - obstacle.spawnedAt - SNEEZE_RETREAT_START) / SNEEZE_RETREAT_TICKS
  if (phase >= 0 && phase <= 1) return SNEEZE_X + 69 * Math.sin(Math.PI * phase) ** 2
}

export function drawBossGroundEffects(ctx, { age, reducedMotion }) {
  const shadow = smooth(age / 5) * (1 - smooth((age - 18) / 15))
  if (shadow > 0) {
    const spread = smooth(age / 16)
    ctx.save()
    ctx.globalAlpha = shadow * .29
    ctx.fillStyle = "#523421"
    ctx.beginPath()
    ctx.ellipse(WIDTH + 14 - 108 * spread, GROUND - 1, 34 + spread * 49, 4 + spread * 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  for (const footfall of FOOTFALLS) {
    const elapsed = age - footfall
    if (elapsed < 0 || elapsed >= 14) continue
    const progress = smooth((footfall - FIRST_STEP) / (LAST_FOOTFALL - FIRST_STEP))
    const x = stepX(progress) + 60
    ctx.save()
    ctx.globalAlpha = smooth(elapsed / 2.5) * (1 - smooth(elapsed / 14)) * .68
    ctx.fillStyle = "#a8794f"
    for (let index = 0; index < 7; index++) {
      const direction = index - 3
      const spread = 7 + (reducedMotion ? 0 : elapsed * .83)
      const lift = reducedMotion ? 0 : elapsed * (1.9 - Math.abs(direction) * .25) - elapsed ** 2 * .08
      ctx.fillRect(x + direction * spread, GROUND - 3 - lift - index % 3 * 3, 3 + index % 2, 2)
    }
    ctx.restore()
  }
}

export function drawBossScreenEffects(ctx, { age, reducedMotion }) {
  const dim = smooth(age / 20) * (1 - smooth((age - 33) / 23))
  ctx.save()
  ctx.globalAlpha = dim * .075
  ctx.fillStyle = "#422715"
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.restore()

  const scan = (age - 25) / 29
  if (reducedMotion || scan <= 0 || scan >= 1) return
  const y = (HEIGHT + 20) * scan - 10
  const strength = Math.sin(scan * Math.PI)
  const band = ctx.createLinearGradient(0, y - 8, 0, y + 8)
  band.addColorStop(0, "transparent")
  band.addColorStop(.5, "#613d2840")
  band.addColorStop(1, "transparent")
  ctx.save()
  ctx.globalAlpha = strength
  ctx.fillStyle = band
  ctx.fillRect(0, y - 8, WIDTH, 16)
  ctx.fillStyle = "#f4dfbca8"
  ctx.fillRect(0, y, WIDTH, 1)
  ctx.restore()
}
