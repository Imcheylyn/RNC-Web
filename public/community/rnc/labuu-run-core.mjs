export const WIDTH = 760
export const HEIGHT = 300
export const GROUND = 244
export const PLAYER_X = 108
export const PLAYER_WIDTH = 48
export const PLAYER_HEIGHT = 48
export const STEP_MS = 1000 / 60
// Legacy round length and the maximum work accepted in one verified segment.
export const MAX_TICKS = 36_000
export const CHECKPOINT_TICKS = 18_000
export const MAX_JUMPS = 2400
export const MONSTER_RULES_VERSION = 2
export const FORMATION_RULES_VERSION = 3
export const EXPANDED_RULES_VERSION = 4
export const FAST_RULES_VERSION = 5
export const RUNNER_RULES_VERSION = 6
export const DROP_WARNING_TICKS = 17
export const SNEEZE_FIRST_SHOT = 56
export const SNEEZE_AFTERSHOCK = 95
export const CARGO_FALL_TICKS = 22
export const BRAKE_HOLD_TICKS = 26
export const BUS_WAVE_TICKS = 18

const SNEEZE_SHOTS = [[SNEEZE_FIRST_SHOT, "roll"], [SNEEZE_AFTERSHOCK, "fly"]]
const ENCORE_SHOTS = [...SNEEZE_SHOTS, [165, "roll"], [204, "fly"]]

const DROP_FALL_TICKS = 22
export const SNEEZE_X = WIDTH - 132
export const SNEEZE_RETREAT_START = SNEEZE_AFTERSHOCK + 5
export const SNEEZE_RETREAT_TICKS = 38
const PAIR_HOP_DELAY = 14
const FORMATIONS = [
  [["ground", 0]],
  [["roll", 0]],
  [["drop", 0]],
  [["fly", 0]],
  [["hop", 0]],
  [["decoy", 0], ["roll", 37]],
  [["ground", 0], ["hop", 22, PAIR_HOP_DELAY]],
  [["fly", 0], ["roll", 44]],
  [["ground", 0], ["fly", 62], ["roll", 107]],
  [["sneeze", 0]],
]
// Show the new encounters early, then mix them with the existing formations.
const NEW_FORMATIONS = [
  FORMATIONS[0],
  [["playing-dead", 0]],
  [["carrier", 0]],
  [["brake", 0]],
  [["bus-chaser", 0]],
  [["dance", 0, 0], ["dance", 20, 9], ["dance", 42, 22]],
  [["encore", 0]],
]
const EXPANDED_FORMATIONS = [...NEW_FORMATIONS, ...FORMATIONS.slice(1)]
const CHALLENGE_FORMATIONS = [
  [["ground", 0], ["roll", 24]],
  [["fly", 0], ["roll", 40], ["hop", 63, PAIR_HOP_DELAY]],
  [["roll", 0], ["fly", 56], ["roll", 95]],
  [["playing-dead", 0], ["hop", 25, PAIR_HOP_DELAY]],
]
const ALL_FORMATIONS = [...EXPANDED_FORMATIONS, ...CHALLENGE_FORMATIONS]
const CHALLENGE_SCORE = 650
const FORMATION_SIZES = {
  ground: [55, 62], hop: [52, 55], fly: [63, 58],
  roll: [42, 42], drop: [62, 69], decoy: [PLAYER_WIDTH, PLAYER_HEIGHT], sneeze: [129, 139],
  "playing-dead": [57, 61], carrier: [72, 57], cargo: [41, 40], brake: [54, 58],
  "bus-chaser": [49, 55], dance: [43, 46], encore: [129, 139],
}

export function sneezeShots(obstacle) {
  return obstacle.motion === "encore" ? ENCORE_SHOTS : SNEEZE_SHOTS
}

export function cueAge(obstacle, tick) {
  return obstacle.cueAt == null ? -1 : tick - obstacle.cueAt
}

export function obstacleBodyHeight(obstacle, tick) {
  const age = cueAge(obstacle, tick)
  if (obstacle.motion === "playing-dead") {
    const rise = Math.max(0, Math.min(1, (age - 14) / 10))
    return 26 + (obstacle.height - 26) * rise
  }
  if (obstacle.motion === "bus-chaser" && age >= BUS_WAVE_TICKS) return 40
  return obstacle.height
}

// Legacy rounds infer their rules from the sign of their seed.
export function createRun(seed, rulesVersion = seed < 0 ? MONSTER_RULES_VERSION : 1) {
  return {
    random: Math.abs(seed) >>> 0, rulesVersion,
    formationIndex: 0, lastFormation: -1, queuedFormation: null,
    tick: 0, distance: 0, score: 0,
    y: 0, velocity: 0, jumps: 0, diving: false, obstacles: [], nextSpawn: 20,
    ended: false, hit: false, hitMotion: null,
  }
}

function nextRandom(run) {
  run.random = (Math.imul(run.random, 1664525) + 1013904223) >>> 0
  return run.random / 4294967296
}

export function jump(run) {
  if (run.ended || run.diving || run.jumps >= 2) return false
  run.velocity = run.jumps === 0 ? 10.8 : 9.6
  run.jumps++
  const nearbyHopper = run.obstacles.find(obstacle => {
    const reach = obstacle.hopDelay === PAIR_HOP_DELAY ? PLAYER_WIDTH + runnerSpeed(run.tick, run.rulesVersion) * 41 : 200
    return obstacle.motion === "hop" && obstacle.hopAt === null
      && obstacle.x >= PLAYER_X + PLAYER_WIDTH && obstacle.x <= PLAYER_X + reach
  })
  if (nearbyHopper) nearbyHopper.hopAt = run.tick + (nearbyHopper.hopDelay ?? 4)
  return true
}

export function dive(run) {
  if (run.rulesVersion < RUNNER_RULES_VERSION || run.ended || run.diving || run.y <= 0) return false
  run.diving = true
  run.velocity = Math.min(run.velocity, -12)
  return true
}

export function obstacleAltitude(obstacle, tick) {
  if (obstacle.motion === "fly") {
    return 72 + Math.sin((tick - obstacle.spawnedAt) * .16 + obstacle.sprite) * 8
  }
  if (obstacle.motion === "drop") {
    const fallAge = tick - (obstacle.dropAt ?? Infinity) - DROP_WARNING_TICKS
    if (fallAge < 0) return GROUND + obstacle.height
    if (fallAge < DROP_FALL_TICKS) return (GROUND + obstacle.height) * (1 - (fallAge / DROP_FALL_TICKS) ** 2)
    const bounce = (fallAge - DROP_FALL_TICKS) / 19
    return bounce < 1 ? 80 * bounce * (1 - bounce) : 0
  }
  if (obstacle.motion === "carrier") {
    return 132 + 7 * Math.sin((tick - obstacle.spawnedAt) * .14)
  }
  if (obstacle.motion === "cargo") {
    const fall = Math.min(1, Math.max(0, (tick - obstacle.spawnedAt) / CARGO_FALL_TICKS))
    return 94 * (1 - fall ** 2)
  }
  if (obstacle.motion === "dance") {
    const age = cueAge(obstacle, tick)
    if (age < obstacle.beatOffset) return 0
    const beat = ((age - obstacle.beatOffset) % 32) / 32
    return 61 * beat * (1 - beat)
  }
  if (obstacle.motion === "bus-chaser") {
    const trip = (cueAge(obstacle, tick) - BUS_WAVE_TICKS) / 18
    return trip > 0 && trip < 1 ? 70 * trip * (1 - trip) : 0
  }
  if (obstacle.hopAt == null) return 0
  const progress = (tick - obstacle.hopAt) / 32
  return progress > 0 && progress < 1 ? 108 * progress * (1 - progress) : 0
}

export function runnerSpeed(tick, rulesVersion) {
  if (rulesVersion >= FAST_RULES_VERSION) return Math.min(12.2, 5.65 + tick * .00245)
  return Math.min(10.5, 5.1 + tick * .00135)
}

function pickFormation(run, formations, firstTime) {
  if (firstTime) return run.formationIndex
  if (run.rulesVersion >= FAST_RULES_VERSION && run.score >= CHALLENGE_SCORE && run.formationIndex % 3 !== 0) {
    const random = Math.floor(nextRandom(run) * CHALLENGE_FORMATIONS.length)
    return EXPANDED_FORMATIONS.length + random
  }
  return (run.lastFormation + 1 + Math.floor(nextRandom(run) * (formations.length - 1))) % formations.length
}

function spawnFormation(run, speed) {
  const faster = run.rulesVersion >= FAST_RULES_VERSION
  const expanded = faster || run.rulesVersion === EXPANDED_RULES_VERSION
  const formations = faster && run.score >= CHALLENGE_SCORE ? ALL_FORMATIONS : expanded ? EXPANDED_FORMATIONS : FORMATIONS
  const firstTime = run.formationIndex < (expanded ? NEW_FORMATIONS.length : FORMATIONS.length)
  const choice = run.queuedFormation ?? pickFormation(run, formations, firstTime)
  const formation = formations[choice]
  const [firstMotion] = formation[0]
  const boss = firstMotion === "sneeze" || firstMotion === "encore"
  if (faster && boss && run.obstacles.some(obstacle => obstacle.motion !== "decoy"
    && obstacle.motion !== "sneeze" && obstacle.motion !== "encore"
    && obstacle.x + obstacle.width >= PLAYER_X)) {
    // Give the existing pack time to clear Labuu before the camera moves.
    run.queuedFormation = choice
    run.nextSpawn += 5
    return
  }
  run.queuedFormation = null
  run.formationIndex++
  run.lastFormation = choice

  for (const [motion, delay, timing] of formation) {
    const pace = motion === "roll" ? 1.24 : motion === "brake" ? 1.3 : 1
    const x = PLAYER_X + (WIDTH - PLAYER_X + delay * speed) * pace
    const obstacle = createObstacle(run, motion, x, pace)
    if (motion === "hop" && timing != null) obstacle.hopDelay = timing
    if (motion === "dance") obstacle.beatOffset = timing
    run.obstacles.push(obstacle)
  }

  const extraTime = {
    sneeze: SNEEZE_AFTERSHOCK,
    encore: ENCORE_SHOTS.at(-1)[0],
    carrier: CARGO_FALL_TICKS,
    brake: BRAKE_HOLD_TICKS,
  }
  const lastDelay = extraTime[firstMotion] ?? formation.at(-1)[1]
  const rest = faster
    ? (firstTime ? 84 : Math.max(61, 83 - Math.floor(run.score / 100)))
    : (firstTime ? 96 : Math.max(70, 92 - Math.floor(run.score / 150)))
  run.nextSpawn += lastDelay + rest
}

function createObstacle(run, motion, x, pace) {
  const [width, height] = FORMATION_SIZES[motion]
  return {
    motion, x, previousX: x, width, height, pace, hopDelay: 4,
    sprite: Math.floor(nextRandom(run) * 256),
    spawnedAt: run.tick, hopAt: null, dropAt: null, turned: false,
  }
}

function positionObstacle(run, obstacle, speed) {
  obstacle.previousX = obstacle.x
  const { motion } = obstacle
  if (motion === "sneeze" || motion === "encore") {
    positionSneezingMonster(run, obstacle, speed)
    return
  }
  switch (motion) {
    case "playing-dead":
    case "dance":
      if (obstacle.cueAt == null && obstacle.x <= WIDTH - 234) obstacle.cueAt = run.tick
      break
    case "carrier":
      if (obstacle.cueAt == null && obstacle.x <= WIDTH - 266) {
        obstacle.cueAt = run.tick
        const cargo = createObstacle(run, "cargo", obstacle.x + 32, 0)
        cargo.sprite = obstacle.sprite + 1
        run.obstacles.push(cargo)
      }
      break
    case "cargo":
      if (run.tick - obstacle.spawnedAt >= CARGO_FALL_TICKS) obstacle.pace = 1.12
      break
    case "brake":
      if (obstacle.cueAt == null && obstacle.x <= PLAYER_X + 298) obstacle.cueAt = run.tick
      if (obstacle.cueAt != null) obstacle.pace = cueAge(obstacle, run.tick) < BRAKE_HOLD_TICKS ? .12 : 1.55
      break
    case "bus-chaser":
      if (obstacle.cueAt == null && obstacle.x <= WIDTH - 248) obstacle.cueAt = run.tick
      if (cueAge(obstacle, run.tick) >= BUS_WAVE_TICKS) obstacle.pace = 1.27
      break
  }
  if (obstacle.motion === "decoy" && !obstacle.turned && obstacle.x <= PLAYER_X + 148) {
    obstacle.turned = true
    obstacle.pace = -1.24
  }
  if (obstacle.motion === "drop" && obstacle.dropAt === null && obstacle.x <= WIDTH - 84) {
    obstacle.dropAt = run.tick
  }
  obstacle.x -= speed * (obstacle.pace ?? 1)
}

function positionSneezingMonster(run, obstacle, speed) {
  const age = run.tick - obstacle.spawnedAt
  const shots = sneezeShots(obstacle)
  const lastShot = shots.at(-1)[0]
  if (age < 30) obstacle.x = WIDTH + 12 - (WIDTH + 12 - SNEEZE_X) * (1 - (1 - age / 30) ** 2)
  else if (age > lastShot + 5) obstacle.x += speed * .86
  else {
    const retreat = (age - SNEEZE_RETREAT_START) / SNEEZE_RETREAT_TICKS
    const backsAway = obstacle.motion === "encore" && retreat > 0 && retreat < 1
    obstacle.x = SNEEZE_X + (backsAway ? 69 * Math.sin(Math.PI * retreat) : 0)
  }
  const shot = shots.find(([tick]) => tick === age)
  if (shot) run.obstacles.push(createObstacle(run, shot[1], obstacle.x - 24, 1.28))
}

export function playerClearance(run, obstacle) {
  if (obstacle.motion === "decoy" || obstacle.motion === "sneeze" || obstacle.motion === "encore") return Infinity
  // Ignore empty margins around the sprites when checking overlap.
  if (obstacle.x + 8 >= PLAYER_X + PLAYER_WIDTH - 10 || obstacle.x + obstacle.width - 8 <= PLAYER_X + 10) {
    return Infinity
  }
  const altitude = obstacleAltitude(obstacle, run.tick)
  return Math.max(
    run.y + 5 - (altitude + obstacleBodyHeight(obstacle, run.tick) - 8),
    altitude + 5 - (run.y + PLAYER_HEIGHT - 6),
  )
}

export function stepRun(run) {
  if (run.ended) return
  run.tick++
  const speed = runnerSpeed(run.tick, run.rulesVersion)
  run.distance += speed
  run.score = Math.floor(run.distance / 10)

  if (run.jumps) {
    run.y += run.velocity
    run.velocity -= .53
    if (run.y <= 0) {
      run.y = 0
      run.velocity = 0
      run.jumps = 0
      run.diving = false
    }
  }

  const formationsEnabled = run.rulesVersion >= FORMATION_RULES_VERSION
  if (run.tick === run.nextSpawn && formationsEnabled) spawnFormation(run, speed)
  else if (run.tick === run.nextSpawn) {
    const animatedMonsters = run.rulesVersion === MONSTER_RULES_VERSION
    const height = 36 + Math.floor(nextRandom(run) * 29)
    const width = 36 + Math.floor(nextRandom(run) * 17)
    const sprite = Math.floor(nextRandom(run) * 256)
    run.nextSpawn += 61 + Math.floor(nextRandom(run) * 27) + Math.ceil(128 / speed)
    const pattern = animatedMonsters && run.tick > 20 ? nextRandom(run) : 0
    const motion = pattern < .42 ? "ground" : pattern < .76 ? "hop" : "fly"
    run.obstacles.push({
      x: WIDTH, sprite, motion, spawnedAt: run.tick, hopAt: null,
      height: animatedMonsters ? Math.round(height * 1.38) : height,
      width: animatedMonsters ? Math.round(width * 1.42) : width,
    })
  }
  for (const obstacle of run.obstacles) {
    positionObstacle(run, obstacle, speed)
    if (!run.hit && playerClearance(run, obstacle) < 0) {
      run.hit = true
      run.hitMotion = obstacle.motion
      run.ended = true
    }
  }
  for (let index = run.obstacles.length - 1; index >= 0; index--) {
    const obstacle = run.obstacles[index]
    const leaving = obstacle.motion === "sneeze" || obstacle.motion === "encore"
    const leavesToRight = obstacle.turned
      || (leaving && run.tick - obstacle.spawnedAt > sneezeShots(obstacle).at(-1)[0] + 5)
    if (obstacle.x + obstacle.width < 0 || (leavesToRight && obstacle.x > WIDTH + obstacle.width)) {
      run.obstacles.splice(index, 1)
    }
  }
  if (run.rulesVersion < RUNNER_RULES_VERSION && run.tick >= MAX_TICKS) run.ended = true
}

/** Rebuild the round from the player's accepted jump inputs, including the terminal tick. */
export function replayRun(seed, finishTick, inputs, rulesVersion) {
  if (!Number.isInteger(finishTick) || finishTick < 1 || finishTick > MAX_TICKS
    || !Array.isArray(inputs) || inputs.length > MAX_JUMPS) return null
  let previous = -1
  for (const tick of inputs) {
    if (!Number.isInteger(tick) || tick <= previous || tick >= finishTick) return null
    previous = tick
  }
  const run = createRun(seed, rulesVersion)
  let index = 0
  while (!run.ended && run.tick < finishTick) {
    if (inputs[index] === run.tick) {
      if (!jump(run)) return null
      index++
    }
    stepRun(run)
  }
  return run.ended && run.tick === finishTick && index === inputs.length ? run.score : null
}

/** Verify a bounded segment, starting from a server-signed checkpoint. */
export function replaySegment(snapshot, finishTick, jumps, dives, terminal = false) {
  if (!Number.isSafeInteger(finishTick) || finishTick < snapshot.tick || finishTick - snapshot.tick > MAX_TICKS
    || !Array.isArray(jumps) || !Array.isArray(dives) || jumps.length > MAX_JUMPS || dives.length > MAX_JUMPS) return null
  for (const inputs of [jumps, dives]) {
    let previous = snapshot.tick - 1
    for (const tick of inputs) {
      if (!Number.isSafeInteger(tick) || tick <= previous || tick >= finishTick) return null
      previous = tick
    }
  }
  const run = structuredClone(snapshot)
  let up = 0, down = 0
  while (!run.ended && run.tick < finishTick) {
    if (jumps[up] === run.tick) {
      if (dives[down] === run.tick || !jump(run)) return null
      up++
    }
    if (dives[down] === run.tick) {
      if (!dive(run)) return null
      down++
    }
    stepRun(run)
  }
  return run.tick === finishTick && run.ended === terminal && up === jumps.length && down === dives.length ? run : null
}
