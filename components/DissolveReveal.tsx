"use client"

import { useEffect, useRef } from "react"

interface DissolveRevealProps {
  onDone: () => void
  duration?: number
}

export default function DissolveReveal({ onDone, duration = 3200 }: DissolveRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    const W = canvas.width  = window.innerWidth
    const H = canvas.height = window.innerHeight

    // CRT scan line — แค่เส้น glow วิ่งจากบนลงล่าง ไม่มีพื้นดำ
    const SCAN_HEIGHT = 3
    const GLOW = 40             // ความยาว glow trail หน้า/หลัง scan line
    let scanY = 0
    let running = true
    let start: number

    function step(now: number) {
      if (!running) return
      if (!start) start = now
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 2)
      scanY = eased * (H + GLOW)

      ctx.clearRect(0, 0, W, H)

      if (scanY < H + GLOW) {
        // leading glow line
        const glowGrad = ctx.createLinearGradient(0, scanY - GLOW, 0, scanY + GLOW)
        glowGrad.addColorStop(0,   "rgba(137,207,240,0)")
        glowGrad.addColorStop(0.4, "rgba(137,207,240,0.18)")
        glowGrad.addColorStop(0.5, "rgba(137,207,240,0.55)")
        glowGrad.addColorStop(0.6, "rgba(137,207,240,0.18)")
        glowGrad.addColorStop(1,   "rgba(137,207,240,0)")
        ctx.fillStyle = glowGrad
        ctx.fillRect(0, Math.max(0, scanY - GLOW), W, GLOW * 2)

        // bright core line
        ctx.fillStyle = "rgba(137,207,240,0.7)"
        ctx.fillRect(0, scanY - SCAN_HEIGHT / 2, W, SCAN_HEIGHT)
      }

      if (progress >= 1) {
        running = false
        ctx.clearRect(0, 0, W, H)
        onDoneRef.current()
        return
      }
      requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
    return () => { running = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 99 }}
    />
  )
}
