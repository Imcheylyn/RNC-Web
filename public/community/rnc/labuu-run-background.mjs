import { WIDTH, HEIGHT, GROUND } from "./labuu-run-core.mjs?v=9"

function layer(paint) {
  const canvas = document.createElement("canvas")
  canvas.width = WIDTH
  canvas.height = HEIGHT
  paint(canvas.getContext("2d"))
  return canvas
}

function drawRooftops(ctx) {
  const buildings = [
    [-19, 55, 26], [43, 37, 41], [88, 68, 32], [152, 45, 59], [202, 29, 41],
    [243, 60, 29], [300, 41, 48], [344, 70, 36], [407, 41, 57], [457, 33, 37],
    [503, 58, 25], [555, 55, 43], [621, 35, 60], [651, 47, 41], [704, 44, 28],
  ]
  for (const [x, width, height] of buildings) {
    const y = GROUND - 4 - height
    ctx.fillStyle = "#c8ab7d"
    for (const left of x < 0 ? [x, x + WIDTH] : [x]) {
      ctx.fillRect(left, y, width, height + 4)
      ctx.fillRect(left - 2, y, width + 4, 2)
      ctx.fillRect(left + width - 11, y - 6, 6, 6)
      ctx.fillStyle = "#e8cea6"
      for (let column = 8; column < width - 9; column += 13) {
        ctx.fillRect(left + column, y + 9, 4, 7)
        if (height > 34) ctx.fillRect(left + column, y + 25, 4, 7)
      }
      ctx.fillStyle = "#c8ab7d"
    }
  }
  ctx.fillStyle = "#b79a70"
  ctx.fillRect(158, GROUND - 85, 24, 13)
  ctx.fillRect(160, GROUND - 72, 2, 9)
  ctx.fillRect(178, GROUND - 72, 2, 9)
  ctx.beginPath()
  ctx.moveTo(155, GROUND - 85)
  ctx.lineTo(170, GROUND - 94)
  ctx.lineTo(185, GROUND - 85)
  ctx.fill()
}

function drawRepeated(ctx, scene, offset) {
  const start = ((offset % WIDTH) + WIDTH) % WIDTH
  ctx.drawImage(scene, -start, 0)
  ctx.drawImage(scene, WIDTH - start, 0)
}

export function createRunnerBackground(screenColor) {
  const sky = layer(ctx => {
    const gradient = ctx.createLinearGradient(0, 0, 0, GROUND)
    gradient.addColorStop(0, screenColor)
    gradient.addColorStop(.53, "#efd7ac")
    gradient.addColorStop(1, "#dec098")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.fillStyle = "#f8e7c9"
    ctx.beginPath()
    ctx.arc(560, 76, 28, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#e8cca0"
    ctx.fillRect(543, 81, 46, 2)
    ctx.fillRect(538, 89, 54, 2)
  })
  const distantHills = layer(ctx => {
    ctx.fillStyle = "#d6bb90"
    ctx.beginPath()
    ctx.moveTo(0, 195)
    ctx.bezierCurveTo(72, 195, 89, 148, 143, 154)
    ctx.bezierCurveTo(212, 161, 254, 207, 315, 198)
    ctx.bezierCurveTo(374, 192, 420, 135, 484, 143)
    ctx.bezierCurveTo(543, 152, 561, 169, 610, 171)
    ctx.bezierCurveTo(676, 174, 693, 195, WIDTH, 195)
    ctx.lineTo(WIDTH, HEIGHT)
    ctx.lineTo(0, HEIGHT)
    ctx.fill()
  })
  const rooftops = layer(drawRooftops)
  return function drawBackground(ctx, distance, cameraX, reducedMotion) {
    const travel = reducedMotion ? 0 : distance
    ctx.drawImage(sky, 0, 0)
    drawRepeated(ctx, distantHills, travel * .12 - cameraX * .25)
    drawRepeated(ctx, rooftops, travel * .27 - cameraX * .58)
  }
}
