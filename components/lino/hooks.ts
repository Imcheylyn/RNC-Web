"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useTime, useTransform } from "framer-motion"
import { C } from "./constants"
import type { LinoState } from "./types"

// ── Persistent Instability ────────────────────────────────────────────────────

export function useInstability() {
  const time = useTime()

  const driftX = useTransform(time, t => Math.sin(t * 0.0008) * 0.6)
  const driftY = useTransform(time, t => Math.cos(t * 0.0006) * 0.4)

  const wobble = useTransform(time, t => {
    const s = Math.sin(t * 0.0005)
    const c = Math.cos(t * 0.0007)
    return `${50 + s * 6}% ${50 - s * 6}% ${50 + c * 5}% ${50 - c * 5}% / ${50 - c * 6}% ${50 + c * 6}% ${50 - s * 5}% ${50 + s * 5}%`
  })

  // glow ฟ้าล้วน ไม่มีชมพู
  const asymGlow = useTransform(time, t => {
    const v = (Math.sin(t * 0.0003) + 1) / 2
    return `0 0 ${8 + v * 4}px rgba(${C.blueV},0.2), inset 0 0 6px rgba(255,255,255,0.08)`
  })

  // ตาขวา aberration — interpolate ฟ้าอ่อน→ฟ้าเข้ม (blush→corrupt)
  const rightEyeGlow = useTransform(time, t => {
    const v = (Math.sin(t * 0.0004) + 1) / 2
    const r = Math.round(168 + (74 - 168) * v)
    const g = Math.round(220 + (159 - 220) * v)
    const b = Math.round(255 + (213 - 255) * v)
    return `drop-shadow(0 0 ${6 + v * 8}px rgba(${r},${g},${b},1)) drop-shadow(0 0 ${2 + v * 3}px rgba(${r},${g},${b},0.8))`
  })

  const rightEyeOpacity = useTransform(time, t => 0.75 + Math.sin(t * 0.0011) * 0.25)

  // chromatic aberration — ฟ้าเข้ม/ฟ้าอ่อน แทน pink/blue
  const bodyFilter = useTransform(time, t => {
    const shift = Math.sin(t * 0.0009) * 1 + 1
    return `drop-shadow(${-shift}px 0 rgba(${C.corruptV},0.35)) drop-shadow(${shift}px 0 rgba(${C.blushV},0.35))`
  })

  return { driftX, driftY, wobble, asymGlow, rightEyeGlow, rightEyeOpacity, bodyFilter }
}

// ── Cursor Awareness ──────────────────────────────────────────────────────────
// ติดตาม cursor จริงๆ แล้วแปลงเป็น lookX/lookY และ distance จาก Lino

export function useCursorAwareness(linoRef: React.RefObject<HTMLElement | null>) {
  const [cursor, setCursor] = useState({ lookX: 0, lookY: 0, distance: 999, isHovering: false })

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!linoRef.current) return
      const rect = linoRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top  + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      // normalize lookX/Y — max ±8px สำหรับตา, ±12px สำหรับหัว
      const maxDist = 300
      const t = Math.min(dist / maxDist, 1)
      const lookX = (dx / (dist || 1)) * t * 8
      const lookY = (dy / (dist || 1)) * t * 5

      setCursor({
        lookX: parseFloat(lookX.toFixed(2)),
        lookY: parseFloat(lookY.toFixed(2)),
        distance: dist,
        isHovering: dist < rect.width / 2,
      })
    }

    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [linoRef])

  return cursor
}

// ── Petting Detection ─────────────────────────────────────────────────────────
// ถ้าเมาส์วนอยู่บนหัว Lino หลายครั้งภายใน window สั้นๆ → isPetting = true

export function usePetting(linoRef: React.RefObject<HTMLElement | null>) {
  const [isPetting, setIsPetting] = useState(false)
  const historyRef  = useRef<{ x: number; y: number; t: number }[]>([])
  const timeoutRef  = useRef<NodeJS.Timeout | null>(null)
  const petCountRef = useRef(0)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!linoRef.current) return
      const rect = linoRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top  + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      // ต้องอยู่บน body (ครึ่งบน) ของ Lino เท่านั้น
      if (dist > rect.width / 2 || dy > 0) return

      const now = Date.now()
      historyRef.current.push({ x: e.clientX, y: e.clientY, t: now })
      // เก็บแค่ 1.5 วิล่าสุด
      historyRef.current = historyRef.current.filter(p => now - p.t < 1500)

      if (historyRef.current.length < 8) return

      // คำนวณว่าเมาส์กวัดไปกวัดมามั้ย — ดู direction changes
      let dirChanges = 0
      for (let i = 2; i < historyRef.current.length; i++) {
        const prev = historyRef.current[i - 2]
        const mid  = historyRef.current[i - 1]
        const cur  = historyRef.current[i]
        const d1x  = mid.x - prev.x
        const d2x  = cur.x - mid.x
        if (d1x * d2x < 0) dirChanges++
      }

      if (dirChanges >= 3) {
        petCountRef.current++
        if (petCountRef.current >= 2) {
          setIsPetting(true)
          historyRef.current = []
          petCountRef.current = 0

          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          timeoutRef.current = setTimeout(() => setIsPetting(false), 2500)
        }
      }
    }

    window.addEventListener("mousemove", onMove)
    return () => {
      window.removeEventListener("mousemove", onMove)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [linoRef])

  return isPetting
}

// ── Idle Events ───────────────────────────────────────────────────────────────

export type IdleEvent = "look_left" | "look_right" | "curious" | "pulse" | null

export function useIdleEvents(active: boolean) {
  const [event, setEvent] = useState<IdleEvent>(null)
  const ref = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!active) { setEvent(null); return }
    const loop = () => {
      const delay = 5000 + Math.random() * 12000
      ref.current = setTimeout(() => {
        const pool: IdleEvent[] = ["look_left", "look_right", "look_left", "look_right", "curious", "pulse"]
        const picked = pool[Math.floor(Math.random() * pool.length)]
        setEvent(picked)
        setTimeout(() => { setEvent(null); loop() }, picked === "curious" ? 1400 : 900)
      }, delay)
    }
    loop()
    return () => { if (ref.current) clearTimeout(ref.current) }
  }, [active])

  return event
}
