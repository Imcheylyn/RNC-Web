import {
  WIDTH, HEIGHT, GROUND, PLAYER_WIDTH, PLAYER_HEIGHT, STEP_MS,
  RUNNER_RULES_VERSION, MAX_TICKS, CHECKPOINT_TICKS, DROP_WARNING_TICKS, CARGO_FALL_TICKS, BRAKE_HOLD_TICKS, BUS_WAVE_TICKS,
  createRun, cueAge, jump, dive, obstacleAltitude, obstacleBodyHeight, sneezeShots, stepRun,
} from "./labuu-run-core.mjs?v=9"
import { createRunnerBackground } from "./labuu-run-background.mjs?v=3"
import { bossEntrance, bossRetreatPosition, drawBossGroundEffects, drawBossScreenEffects } from "./labuu-run-boss-effects.mjs?v=4"
import {
  CRASH_MS, createPlayerEffects, drawPlayerCue, markPlayerJump, playerPose, trackClosePasses,
} from "./labuu-run-player-effects.mjs?v=2"

const endpoint = "/api/community/arcade/labuu-run"
const canvas = document.getElementById("runner-canvas")
const ctx = canvas.getContext("2d", { alpha: false })
const shell = document.querySelector(".runner-shell")
const stage = document.getElementById("runner-stage")
const drawBackground = createRunnerBackground(getComputedStyle(stage).backgroundColor)
const prompt = document.getElementById("runner-prompt")
const heading = document.getElementById("runner-state")
const loading = document.getElementById("runner-loading")
const resultPanel = document.getElementById("runner-result")
const resultTitle = document.getElementById("runner-result-title")
const status = document.getElementById("runner-status")
const startButton = document.getElementById("runner-start")
const restartButton = document.getElementById("runner-restart")
const retryButton = document.getElementById("runner-retry")
const leaderboard = document.getElementById("runner-leaderboard")
const pauseButton = document.getElementById("runner-pause")
const diveButton = document.getElementById("runner-dive")
const scoreLabel = document.getElementById("runner-score")
const bestLabel = document.getElementById("runner-best")
const hero = new Image()
hero.src = "/assets/Labuu.png"
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
let run = createRun(1)
let roundId
let images = []
let jumps = []
let dives = []
let lastActionTick = -1
let checkpoint
let checkpointTick = 0
let checkpointWork = null
let checkpointRetryTick = 0
let checkpointSavedAt = 0
let phase = "entering"
let frame = 0
let previousTime
let previousDistance = 0
let previousHeight = 0
let accumulator = 0
let shownScore = -1
let savePending = false
let playerEffects = createPlayerEffects()
let crashProgress = null

function format(score) {
  return score == null ? "—" : String(score).padStart(5, "0")
}

async function request(body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: body.action === "finish",
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) {
    const error = new Error("Runner request failed")
    error.retryable = response.status >= 500 || response.status === 429
    throw error
  }
  return response.json()
}

function loadImage(src) {
  return new Promise(resolve => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function prepareCanvas() {
  const ratio = Math.min(2, devicePixelRatio || 1)
  canvas.width = Math.round(WIDTH * ratio)
  canvas.height = Math.round(HEIGHT * ratio)
  ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0)
  ctx.imageSmoothingQuality = "high"
  draw()
}

function drawLandscape(distance) {
  const scroll = reducedMotion.matches ? 0 : distance
  const cloudX = WIDTH - (scroll * .075 + WIDTH - 495) % (WIDTH + 70)
  ctx.strokeStyle = "#9e7c4e59"
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.moveTo(cloudX, 104)
  ctx.quadraticCurveTo(cloudX + 3, 97, cloudX + 12, 98)
  ctx.bezierCurveTo(cloudX + 16, 85, cloudX + 33, 83, cloudX + 40, 95)
  ctx.quadraticCurveTo(cloudX + 55, 94, cloudX + 60, 104)
  ctx.closePath()
  ctx.stroke()

  ctx.fillStyle = "#e4c99d"
  ctx.fillRect(-32, GROUND, WIDTH + 64, HEIGHT - GROUND + 6)
  const groundScroll = scroll % 180 + 180
  ctx.strokeStyle = "#6f5438"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-groundScroll, GROUND + .5)
  for (let x = -groundScroll; x <= WIDTH; x += 180) {
    ctx.lineTo(x + 125, GROUND + .5)
    ctx.lineTo(x + 130, GROUND + 3.5)
    ctx.lineTo(x + 144, GROUND + 3.5)
    ctx.lineTo(x + 149, GROUND + .5)
  }
  ctx.lineTo(WIDTH + 180, GROUND + .5)
  ctx.stroke()

  ctx.fillStyle = "#9e805c"
  const dustScroll = scroll % 152
  for (let x = -dustScroll - 152; x < WIDTH + 30; x += 152) {
    ctx.fillRect(x + 10, GROUND + 8, 4, 1)
    ctx.fillRect(x + 33, GROUND + 13, 2, 1)
    ctx.fillRect(x + 64, GROUND + 9, 3, 1)
    ctx.fillRect(x + 107, GROUND + 12, 5, 1)
    ctx.fillRect(x + 143, GROUND + 7, 2, 1)
  }
}

function drawFit(image, x, y, width, height) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight)
  const w = image.naturalWidth * scale
  const h = image.naturalHeight * scale
  ctx.drawImage(image, x + (width - w) / 2, y + height - h, w, h)
}

function drawEnemyArt(image, width, height) {
  if (image) {
    drawFit(image, -width / 2, -height / 2, width, height)
    return
  }
  ctx.fillStyle = "#674631"
  ctx.beginPath()
  ctx.ellipse(0, height * .06, width * .44, height * .43, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#ffe6b9"
  ctx.fillRect(-width * .20, -height * .08, width * .10, height * .10)
  ctx.fillRect(width * .03, -height * .08, width * .10, height * .10)
}

function drawDropWarning(x, obstacle, renderTick) {
  const age = renderTick - obstacle.dropAt
  ctx.strokeStyle = "#88432a"
  ctx.lineWidth = 1.5
  const width = obstacle.width * .48
  ctx.beginPath()
  ctx.ellipse(x, GROUND - 2, width, 5, 0, 0, Math.PI * 2)
  ctx.stroke()
  if (age < DROP_WARNING_TICKS) {
    ctx.fillStyle = "#88432a"
    ctx.fillRect(x - 1.5, GROUND - 28, 3, 10)
    ctx.fillRect(x - 1.5, GROUND - 14, 3, 3)
  }
}

function drawSneeze(x, obstacle, renderTick) {
  const age = renderTick - obstacle.spawnedAt
  const shots = sneezeShots(obstacle)
  const nextSneeze = shots.find(([tick, motion]) => motion === "roll" && tick > age && tick - age < 26)
  const breath = nextSneeze ? 1 - (nextSneeze[0] - age) / 26 : 0
  const lastShot = shots.findLast(([tick]) => tick <= age)
  const sinceShot = lastShot ? age - lastShot[0] : Infinity
  if (breath || (sinceShot >= 0 && sinceShot < 12)) {
    const drift = breath ? (1 - breath) * 30 : sinceShot * 4
    ctx.fillStyle = breath ? "#a35d3f" : "#bd9162"
    for (let index = 0; index < 4; index++) {
      ctx.beginPath()
      ctx.arc(x - 10 - drift - index * 9, GROUND - 59 + index * 11, 2 + index * .6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return breath
}

function drawDust(x, y, age) {
  ctx.fillStyle = "#a87a4eaa"
  for (let index = 0; index < 4; index++) {
    const spread = index * 6 + age * .75
    ctx.fillRect(x + spread, y - index * 3, 3 + (index % 2), 2)
  }
}

function drawBus(obstacle, x, renderTick) {
  const age = cueAge(obstacle, renderTick)
  const busX = x - 116 - Math.max(0, age - 9) * 2
  if (busX < -95 || busX > WIDTH) return
  const y = GROUND - 99

  ctx.fillStyle = "#a7855b"
  ctx.fillRect(busX + 7, y, 78, 28)
  ctx.fillRect(busX, y + 5, 88, 23)
  ctx.fillStyle = "#efdbb8"
  for (let index = 0; index < 5; index++) ctx.fillRect(busX + 5 + index * 15, y + 7, 11, 9)
  ctx.fillStyle = "#8e6b49"
  ctx.fillRect(busX + 3, y + 21, 84, 3)
  ctx.fillRect(busX + 13, y + 27, 11, 7)
  ctx.fillRect(busX + 65, y + 27, 11, 7)
}

function drawEncounterCues(obstacle, x, bottom, altitude, renderTick) {
  const { motion, width, height, sprite } = obstacle
  const age = cueAge(obstacle, renderTick)
  if (motion === "playing-dead" && age >= 0 && age < 14 && age % 7 < 5) {
    ctx.strokeStyle = "#88432a"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x + 5, bottom - 21)
    ctx.lineTo(x - 2, bottom - 29)
    ctx.moveTo(x + 1, bottom - 15)
    ctx.lineTo(x - 8, bottom - 17)
    ctx.stroke()
  }
  if (motion === "carrier" && age < 0) {
    const loose = x < WIDTH - 185
    const sway = loose && !reducedMotion.matches ? Math.sin(renderTick * .35) * 8 : 0
    const cargoX = x + 35 + sway
    ctx.strokeStyle = loose ? "#984b32" : "#9e7951"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x + width / 2, bottom - 2)
    ctx.lineTo(cargoX, bottom + 16)
    ctx.stroke()
    ctx.save()
    ctx.translate(cargoX, bottom + 20)
    drawEnemyArt(images[(sprite + 1) % images.length], 41, 40)
    ctx.restore()
  }
  if (motion === "brake" && age >= 0 && age < BRAKE_HOLD_TICKS + 10) {
    drawDust(x + width - 4, GROUND - 4, age < BRAKE_HOLD_TICKS ? age : age - BRAKE_HOLD_TICKS)
  }
  if (motion === "bus-chaser" && age >= 0) {
    if (age < BUS_WAVE_TICKS) {
      ctx.strokeStyle = "#795737"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x + 3, bottom - height + 6, 12, 3.2, 4.7)
      ctx.arc(x + 3, bottom - height + 6, 16, 3.2, 4.7)
      ctx.stroke()
    } else if (age < BUS_WAVE_TICKS + 22) drawDust(x + width - 4, GROUND - 4, age - BUS_WAVE_TICKS)
  }
  if (motion === "dance" && altitude > 9) {
    const noteX = x + width / 2 + 9
    const noteY = bottom - height - 10
    ctx.fillStyle = "#9d633b"
    ctx.fillRect(noteX + 4, noteY - 8, 2, 10)
    ctx.fillRect(noteX + 4, noteY - 8, 6, 2)
    ctx.beginPath()
    ctx.ellipse(noteX + 2, noteY + 1, 3.6, 2.6, -.3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawMonster(obstacle, blend, renderTick, entrance) {
  const { width, height, motion, sprite } = obstacle
  if (entrance?.hideBoss) return
  const x = entrance?.x ?? bossRetreatPosition(obstacle, renderTick)
    ?? obstacle.previousX + (obstacle.x - obstacle.previousX) * blend
  if (x + width < -8 || x > WIDTH + 28) return
  const altitude = obstacleAltitude(obstacle, renderTick) + (entrance?.lift ?? 0)
  const bottom = GROUND - altitude
  const centerX = x + width / 2

  if (motion === "drop" && obstacle.dropAt !== null && altitude > 24) {
    drawDropWarning(centerX, obstacle, renderTick)
  }
  if (bottom <= 0) return

  ctx.fillStyle = altitude ? "#543d2f20" : "#543d2f32"
  ctx.beginPath()
  ctx.ellipse(centerX, GROUND, width * (altitude ? .28 : .37), 3, 0, 0, Math.PI * 2)
  ctx.fill()

  const breath = motion === "sneeze" || motion === "encore" ? drawSneeze(x, obstacle, renderTick) : 0
  drawEncounterCues(obstacle, x, bottom, altitude, renderTick)
  const rise = altitude - obstacleAltitude(obstacle, renderTick - 1)
  const age = cueAge(obstacle, renderTick)
  const rollAge = motion === "cargo" ? renderTick - obstacle.spawnedAt - CARGO_FALL_TICKS
    : motion === "bus-chaser" ? age - BUS_WAVE_TICKS : -1
  const bodyHeight = obstacleBodyHeight(obstacle, renderTick)
  const prone = motion === "playing-dead" ? (height - bodyHeight) / (height - 26) : 0
  const twitch = prone && age >= 0 && age < 14 ? Math.sin(age * Math.PI / 3.5) * .12 : 0
  const tilt = motion === "roll" ? x / 12
    : rollAge >= 0 ? -rollAge * .55 : Math.max(-.14, Math.min(.14, rise * .045)) + twitch
  const decoy = motion === "decoy"
  const art = decoy ? hero : images[sprite % images.length]
  ctx.save()
  const artHeight = motion === "bus-chaser" ? bodyHeight : height
  ctx.translate(centerX, bottom - Math.max(bodyHeight, width * prone * .62) / 2)
  ctx.rotate(prone * Math.PI / 2 + (entrance?.tilt ?? (reducedMotion.matches ? 0 : tilt)))
  if (breath && !reducedMotion.matches) ctx.scale(1 + breath * .12, 1 + breath * .06)
  if (decoy) {
    ctx.globalAlpha = obstacle.turned ? .6 : .83
    if (obstacle.turned) ctx.scale(-1, 1)
  }
  drawEnemyArt(art?.complete && art.naturalWidth ? art : null, width, artHeight)
  ctx.restore()
}

function draw() {
  // Blend the rendered positions between fixed physics steps without changing the recorded run.
  const blend = run.ended ? 1 : Math.min(1, accumulator / STEP_MS)
  const distance = previousDistance + (run.distance - previousDistance) * blend
  const height = previousHeight + (run.y - previousHeight) * blend
  const renderTick = run.tick ? run.tick - 1 + blend : 0
  const entrance = bossEntrance(run.obstacles, renderTick, reducedMotion.matches)
  drawBackground(ctx, distance, entrance?.cameraX ?? 0, reducedMotion.matches)
  if (entrance) {
    ctx.save()
    ctx.translate(entrance.cameraX, entrance.cameraY)
  }
  drawLandscape(distance)
  for (const obstacle of run.obstacles) {
    if (obstacle.motion === "bus-chaser") {
      drawBus(obstacle, obstacle.previousX + (obstacle.x - obstacle.previousX) * blend, renderTick)
    }
  }
  if (entrance) drawBossGroundEffects(ctx, entrance)
  for (const obstacle of run.obstacles) {
    drawMonster(obstacle, blend, renderTick, obstacle === entrance?.boss ? entrance : null)
  }
  const stride = run.tick && !run.ended && !height && !reducedMotion.matches
    ? (1 - Math.cos(distance * .13)) * 1.5
    : 0
  const pose = playerPose(run, playerEffects, renderTick, height, stride, reducedMotion.matches, crashProgress)
  drawPlayerCue(ctx, pose, reducedMotion.matches)
  ctx.save()
  ctx.translate(pose.x + PLAYER_WIDTH / 2, pose.bottom - PLAYER_HEIGHT / 2)
  ctx.rotate(pose.angle)
  ctx.scale(pose.scaleX, pose.scaleY)
  if (hero.complete && hero.naturalWidth) drawFit(hero, -PLAYER_WIDTH / 2, -PLAYER_HEIGHT / 2, PLAYER_WIDTH, PLAYER_HEIGHT)
  else {
    ctx.fillStyle = "#543d2f"
    ctx.fillRect(-PLAYER_WIDTH / 2 + 7, -PLAYER_HEIGHT / 2 + 8, PLAYER_WIDTH - 14, PLAYER_HEIGHT - 8)
  }
  ctx.restore()
  if (entrance) {
    ctx.restore()
    drawBossScreenEffects(ctx, entrance)
  }
  if (shownScore !== run.score) {
    shownScore = run.score
    scoreLabel.textContent = format(shownScore)
  }
}

function play() {
  phase = "playing"
  prompt.hidden = true
  pauseButton.hidden = false
  diveButton.hidden = run.rulesVersion < RUNNER_RULES_VERSION
  stage.focus({ preventScroll: true })
  previousTime = undefined
  frame = requestAnimationFrame(tick)
}

function pause() {
  if (phase !== "playing") return
  phase = "paused"
  heading.textContent = "Paused"
  diveButton.hidden = true
  cancelAnimationFrame(frame)
  pauseButton.hidden = true
  heading.hidden = false
  startButton.textContent = "Resume"
  prompt.hidden = false
  startButton.focus({ preventScroll: true })
}

function tick(now) {
  if (previousTime !== undefined) accumulator += Math.min(100, now - previousTime)
  previousTime = now
  while (accumulator >= STEP_MS && !run.ended) {
    previousDistance = run.distance
    previousHeight = run.y
    stepRun(run)
    if (!run.ended) trackClosePasses(playerEffects, run)
    accumulator -= STEP_MS
  }
  draw()
  if (run.ended) finish()
  else {
    if (checkpoint && run.tick - checkpointTick >= MAX_TICKS - 120) {
      void saveCheckpoint(true)
      pause()
      heading.textContent = "Connection interrupted. Resume to retry."
      return
    }
    void saveCheckpoint()
    frame = requestAnimationFrame(tick)
  }
}

async function start() {
  if (phase === "paused") {
    if (checkpoint && (run.tick - checkpointTick >= MAX_TICKS - 120 || Date.now() - checkpointSavedAt > 25 * 60_000)) {
      phase = "reconnecting"
      startButton.disabled = true
      loading.hidden = false
      const recovered = await saveCheckpoint(true)
      startButton.disabled = false
      loading.hidden = true
      phase = "paused"
      if (!recovered) { heading.textContent = "Could not reconnect. Please try again."; return }
    }
    play()
    if (document.hidden) pause()
    return
  }
  if ((phase !== "ready" && phase !== "ended") || savePending) return
  phase = "loading"
  resultPanel.hidden = true
  prompt.hidden = false
  startButton.hidden = true
  heading.hidden = true
  loading.hidden = false
  let data
  try { data = await request({ action: "start", rulesVersion: RUNNER_RULES_VERSION }) }
  catch { /* Practice can run without the score service. */ }
  roundId = data?.roundId
  if (data) bestLabel.textContent = format(data.bestScore)
  const monsterUrls = data?.monsters ?? []
  const sprites = Array(monsterUrls.length).fill(null)
  images = sprites
  const loads = monsterUrls.map(async (url, index) => {
    sprites[index] = await loadImage(url)
  })
  if (loads.length) {
    // A slow image can still replace its fallback after the run starts.
    let timer
    await Promise.race([Promise.all(loads), new Promise(resolve => { timer = setTimeout(resolve, 3000) })])
    clearTimeout(timer)
  }
  const seed = data?.seed ?? (1 + Math.floor(Math.random() * 0x7ffffffe))
  run = createRun(seed, data ? data.rulesVersion : RUNNER_RULES_VERSION)
  previousDistance = previousHeight = 0
  accumulator = 0
  jumps = []
  dives = []
  lastActionTick = -1
  checkpoint = data?.checkpoint
  checkpointTick = checkpointRetryTick = 0
  checkpointWork = null
  checkpointSavedAt = Date.now()
  playerEffects = createPlayerEffects()
  crashProgress = null
  draw()
  loading.hidden = true
  startButton.hidden = false
  play()
  if (document.hidden) pause()
}

function performJump() {
  if (phase !== "playing" || lastActionTick === run.tick) return
  if (jump(run)) {
    jumps.push(run.tick)
    lastActionTick = run.tick
    markPlayerJump(playerEffects, run)
  }
}

function performDive() {
  if (phase !== "playing" || lastActionTick === run.tick) return
  if (dive(run)) { dives.push(run.tick); lastActionTick = run.tick }
}

function saveCheckpoint(force = false) {
  if (!checkpoint || !roundId || run.ended || run.tick < checkpointTick || (!force && run.tick === checkpointTick)) return
  if (checkpointWork) return checkpointWork
  if (!force && (run.tick - checkpointTick < CHECKPOINT_TICKS || run.tick < checkpointRetryTick)) return
  const target = run.tick, activeRound = roundId
  const work = request({ action: "checkpoint", roundId, checkpoint, finishTick: target,
    jumps: jumps.filter(tick => tick < target), dives: dives.filter(tick => tick < target) })
    .then(data => {
      if (activeRound !== roundId) return false
      if (data.checkpointTick !== target || typeof data.checkpoint !== "string") throw new Error("Invalid progress response")
      checkpoint = data.checkpoint
      checkpointTick = target
      jumps = jumps.filter(tick => tick >= target)
      dives = dives.filter(tick => tick >= target)
      checkpointSavedAt = Date.now()
      return true
    })
    .catch(() => { checkpointRetryTick = run.tick + 900; return false })
    .finally(() => { if (checkpointWork === work) checkpointWork = null })
  checkpointWork = work
  return work
}

async function save() {
  if (!roundId || savePending) return
  savePending = true
  restartButton.disabled = true
  retryButton.hidden = true
  leaderboard.hidden = true
  status.textContent = "Saving score…"
  try {
    await checkpointWork
    const result = await request({ action:"finish", roundId, finishTick:run.tick, jumps,
      ...(checkpoint ? { checkpoint, dives } : {}) })
    scoreLabel.textContent = format(result.score)
    bestLabel.textContent = format(result.bestScore)
    status.textContent = ""
  } catch (error) {
    status.textContent = "Score not saved"
    retryButton.hidden = error.retryable === false
  } finally {
    savePending = false
    restartButton.disabled = false
    leaderboard.hidden = false
  }
}

function showResult() {
  phase = "ended"
  resultTitle.textContent = run.hit ? "GAME OVER" : "RUN COMPLETE"
  resultPanel.hidden = false
  stage.focus({ preventScroll: true })
}

function finishCrash() {
  cancelAnimationFrame(frame)
  crashProgress = 1
  draw()
  showResult()
}

function finish() {
  phase = "crashing"
  diveButton.hidden = true
  pauseButton.hidden = true
  prompt.hidden = true
  retryButton.hidden = true
  if (roundId) void save()
  else {
    status.textContent = "Practice run"
    leaderboard.hidden = false
  }

  if (!run.hit) {
    showResult()
    return
  }
  if (reducedMotion.matches || document.hidden) {
    finishCrash()
    return
  }
  crashProgress = 0
  let startedAt
  function animateCrash(now) {
    startedAt ??= now
    crashProgress = Math.min(1, (now - startedAt) / CRASH_MS)
    draw()
    if (crashProgress === 1) showResult()
    else frame = requestAnimationFrame(animateCrash)
  }
  frame = requestAnimationFrame(animateCrash)
}

startButton.addEventListener("click", start)
restartButton.addEventListener("click", start)
retryButton.addEventListener("click", save)
pauseButton.addEventListener("click", pause)
canvas.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0) return
  if (phase === "ready") void start()
  else performJump()
})
diveButton.addEventListener("click", () => { performDive(); stage.focus({ preventScroll: true }) })

document.addEventListener("keydown", event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (event.code === "Escape" && (phase === "playing" || phase === "paused")) {
    event.preventDefault()
    if (!event.repeat) {
      if (phase === "playing") pause()
      else void start()
    }
    return
  }
  if (["ArrowDown", "KeyS"].includes(event.code)) {
    if (event.target.closest("a, input, textarea, button")) return
    event.preventDefault()
    if (!event.repeat) performDive()
    return
  }
  if (!["Space", "ArrowUp"].includes(event.code)) return
  if (event.target.closest("a, input") || (event.code === "Space" && event.target.closest("button"))) return
  event.preventDefault()
  if (event.repeat) return
  if (phase === "playing") performJump()
  else if (phase === "ready" || phase === "ended" || phase === "paused") void start()
})
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return
  if (phase === "crashing") finishCrash()
  else pause()
})
hero.addEventListener("load", draw)
window.addEventListener("resize", prepareCanvas)
prepareCanvas()

async function revealGame() {
  shell.classList.add("is-revealing")
  const [opening] = shell.getAnimations()
  if (opening) await opening.finished.catch(() => {})
  shell.inert = false
  shell.classList.remove("is-revealing")
  phase = "ready"
  stage.focus({ preventScroll: true })
}

void revealGame()
