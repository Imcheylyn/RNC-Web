"use client"

import { motion, AnimatePresence } from "framer-motion"
import type { MotionValue } from "framer-motion"
import type { LinoState } from "./types"
import type { EyeShape, MouthShape } from "./expressions"

const W   = "rgba(255,255,255,0.95)"
const DIM = "rgba(255,255,255,0.65)"

// ── Eye Shapes — 4+1 แบบเท่านั้น ─────────────────────────────────────────────
// ลิโนะเป็นสัญญาณที่บังเอิญมีใบหน้า ไม่ใช่มนุษย์
// อารมณ์สื่อด้วย motion ไม่ใช่ SVG ใหม่

function EyeShape({ shape, flip = false, smileDepth = 0.6 }: {
  shape: EyeShape; flip?: boolean; smileDepth?: number
}) {
  const mirror: React.CSSProperties = flip ? { transform: "scale(-1,1)" } : {}

  // smile — DNA หลักของลิโนะ โค้งขึ้น
  // smileDepth 0-1 ควบคุมความแหลมของโค้ง
  if (shape === "smile") {
    const cy = 18 - smileDepth * 12   // 18 = แบน, 6 = โค้งสุด
    return (
      <svg width="32" height="20" viewBox="0 0 32 20" style={mirror}>
        <path d={`M2 16 Q16 ${cy} 30 16`} stroke={W} strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    )
  }

  // neutral — เส้นตรง
  if (shape === "neutral") return (
    <svg width="28" height="8" viewBox="0 0 28 8">
      <line x1="2" y1="4" x2="26" y2="4" stroke={W} strokeWidth="4" strokeLinecap="round" />
    </svg>
  )

  // sleepy — โค้งลง + เส้นบังบน
  if (shape === "sleepy") return (
    <svg width="28" height="18" viewBox="0 0 28 18" style={mirror}>
      <path d="M2 6 Q14 17 26 6" stroke={DIM} strokeWidth="4" fill="none" strokeLinecap="round" />
      <line x1="2" y1="6" x2="26" y2="6" stroke={DIM} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )

  // surprised — วงกลมเส้นเดียว ไม่มี iris
  if (shape === "surprised") return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="7" stroke={W} strokeWidth="3.5" fill="none" />
    </svg>
  )

  // pixel — glitched exception
  if (shape === "pixel") return (
    <svg width="28" height="18" viewBox="0 0 28 18" style={mirror}>
      <rect x="2"  y="3"  width="9"  height="6"  fill={W} rx="1" />
      <rect x="13" y="1"  width="5"  height="5"  fill={W} rx="1" opacity="0.8" />
      <rect x="7"  y="11" width="13" height="4"  fill={W} rx="1" opacity="0.6" />
      <rect x="18" y="6"  width="7"  height="7"  fill="rgba(137,207,240,0.7)" rx="1" />
    </svg>
  )

  // fallback
  return (
    <svg width="28" height="8" viewBox="0 0 28 8">
      <line x1="2" y1="4" x2="26" y2="4" stroke={W} strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

// ── Thinking Eyes ─────────────────────────────────────────────────────────────

function ThinkingEyes() {
  return (
    <motion.div
      style={{ display: "flex", gap: 10, alignItems: "center" }}
      animate={{ x: [0, 5, 5, 0] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", times: [0, 0.3, 0.7, 1] }}
    >
      <motion.svg width="24" height="10" viewBox="0 0 24 10"
        animate={{ scaleY: [1, 0.6, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <line x1="2" y1="5" x2="22" y2="5" stroke={W} strokeWidth="4" strokeLinecap="round" />
      </motion.svg>
      <motion.svg width="20" height="10" viewBox="0 0 20 10"
        animate={{ scaleY: [0.8, 0.4, 0.8] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
      >
        <line x1="2" y1="5" x2="18" y2="5" stroke={W} strokeWidth="3.5" strokeLinecap="round" strokeOpacity="0.75" />
      </motion.svg>
    </motion.div>
  )
}

// ── Single Eye ────────────────────────────────────────────────────────────────

function SingleEye({ shape, flip, state, blinkDelay, lookX, lookY, smileDepth, glowFilter, opacityMv }: {
  shape: EyeShape; flip: boolean; state: LinoState
  blinkDelay: number; lookX: number; lookY: number; smileDepth: number
  glowFilter?: MotionValue<string>
  opacityMv?: MotionValue<number>
}) {
  const isGlitched = shape === "pixel"

  return (
    <motion.div
      style={{ display: "flex", transformOrigin: "center center", opacity: opacityMv, filter: glowFilter }}
      animate={
        isGlitched
          ? { x: [0, -2, 1, -1, 2, 0], scaleY: [1, 0.9, 1.1, 0.8, 1] }
          : state === "idle"
          ? { scaleY: [1, 1, 0.05, 1, 1] }
          : { scaleY: 1 }
      }
      transition={
        isGlitched
          ? { duration: 0.3, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }
          : state === "idle"
          ? { duration: 5, repeat: Infinity, times: [0, 0.62, 0.67, 0.72, 1], ease: "easeInOut" as const, delay: blinkDelay }
          : { duration: 0.2 }
      }
    >
      <motion.div
        animate={{ x: lookX, y: lookY }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{ display: "flex" }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${shape}-${flip}-${smileDepth.toFixed(1)}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ display: "flex" }}
          >
            <EyeShape shape={shape} flip={flip} smileDepth={smileDepth} />
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

// ── Eyes ──────────────────────────────────────────────────────────────────────

export function Eyes({ eyeShape, state, lookX, lookY, smileDepth, rightEyeGlow, rightEyeOpacity }: {
  eyeShape: EyeShape; state: LinoState; lookX: number; lookY: number; smileDepth: number
  rightEyeGlow: MotionValue<string>; rightEyeOpacity: MotionValue<number>
}) {
  const needFlip = eyeShape === "smile" || eyeShape === "sleepy"
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <AnimatePresence mode="wait">
        {state === "thinking" ? (
          <motion.div key="thinking"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ThinkingEyes />
          </motion.div>
        ) : (
          <motion.div key="normal" style={{ display: "flex", gap: 10 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SingleEye shape={eyeShape} flip={false} state={state} blinkDelay={0} lookX={lookX} lookY={lookY} smileDepth={smileDepth} />
            <SingleEye
              shape={eyeShape} flip={needFlip} state={state}
              blinkDelay={0.09} lookX={lookX} lookY={lookY} smileDepth={smileDepth}
              glowFilter={rightEyeGlow}
              opacityMv={rightEyeOpacity}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Mouth Shapes ──────────────────────────────────────────────────────────────

function SpeakingMouth({ shape }: { shape: MouthShape }) {
  if (shape === "surprised") return (
    <motion.svg width="16" height="20" viewBox="0 0 16 20"
      animate={{ scaleY: [1, 0.35, 1, 0.6, 1] }}
      transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut", times: [0, 0.25, 0.5, 0.75, 1] }}
      style={{ marginTop: 4, transformOrigin: "center top" }}
    >
      <ellipse cx="8" cy="10" rx="6" ry="8" fill="rgba(255,255,255,0.82)" />
    </motion.svg>
  )
  if (shape === "neutral" || shape === "sleepy") return (
    <motion.svg width="26" height="14" viewBox="0 0 26 14"
      animate={{ scaleY: [0.15, 1, 0.15, 0.6, 0.15] }}
      transition={{ duration: 0.42, repeat: Infinity, ease: "easeInOut", times: [0, 0.3, 0.5, 0.75, 1] }}
      style={{ marginTop: 4, transformOrigin: "center center" }}
    >
      <rect x="2" y="4" width="22" height="6" rx="3" fill="rgba(255,255,255,0.8)" />
    </motion.svg>
  )
  if (shape === "pixel") return (
    <motion.svg width="28" height="12" viewBox="0 0 28 12"
      animate={{ x: [-1, 2, -1, 0], scaleX: [1, 0.8, 1.1, 1] }}
      transition={{ duration: 0.25, repeat: Infinity, repeatDelay: 1.2 }}
      style={{ marginTop: 4 }}
    >
      <rect x="2"  y="3" width="10" height="5" rx="1" fill={W} opacity="0.9" />
      <rect x="14" y="4" width="12" height="4" rx="1" fill={W} opacity="0.7" />
    </motion.svg>
  )
  // smile default
  return (
    <motion.svg width="36" height="22" viewBox="0 0 36 22"
      animate={{ scaleY: [1, 0.3, 1, 0.55, 1] }}
      transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.25, 0.55, 0.75, 1] }}
      style={{ marginTop: 3, transformOrigin: "center top" }}
    >
      <path d="M3 5 Q18 20 33 5" stroke={W} strokeWidth="4" fill="rgba(255,255,255,0.1)" strokeLinecap="round" />
    </motion.svg>
  )
}

function MouthShape({ shape, state }: { shape: MouthShape; state: LinoState }) {
  if (state === "thinking") return (
    <motion.svg width="20" height="6" viewBox="0 0 20 6" style={{ marginTop: 6 }}
      animate={{ scaleX: [1, 0.7, 1] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
    >
      <line x1="2" y1="3" x2="18" y2="3" stroke={W} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.7" />
    </motion.svg>
  )
  if (state === "speaking") return <SpeakingMouth shape={shape} />

  if (shape === "smile") return (
    <svg width="34" height="18" viewBox="0 0 34 18" style={{ marginTop: 3 }}>
      <path d="M3 3 Q17 16 31 3" stroke={W} strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  )
  if (shape === "surprised") return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ marginTop: 4 }}>
      <ellipse cx="7" cy="7" rx="5.5" ry="5.5" fill="rgba(255,255,255,0.82)" />
    </svg>
  )
  if (shape === "sleepy") return (
    <svg width="22" height="6" viewBox="0 0 22 6" style={{ marginTop: 5 }}>
      <line x1="2" y1="3" x2="20" y2="3" stroke={DIM} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
  if (shape === "pixel") return (
    <svg width="30" height="10" viewBox="0 0 30 10" style={{ marginTop: 4 }}>
      <rect x="2"  y="3" width="8"  height="4" rx="1" fill={W} opacity="0.8" />
      <rect x="12" y="2" width="5"  height="6" rx="1" fill={W} opacity="0.6" />
      <rect x="19" y="4" width="9"  height="3" rx="1" fill={W} opacity="0.9" />
    </svg>
  )
  // neutral
  return (
    <svg width="24" height="6" viewBox="0 0 24 6" style={{ marginTop: 4 }}>
      <line x1="2" y1="3" x2="22" y2="3" stroke={W} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Mouth ─────────────────────────────────────────────────────────────────────

export function Mouth({ mouthShape, state }: { mouthShape: MouthShape; state: LinoState }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${mouthShape}-${state}`}
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -3 }}
        transition={{ duration: 0.18 }}
        style={{ display: "flex", justifyContent: "center" }}
      >
        <MouthShape shape={mouthShape} state={state} />
      </motion.div>
    </AnimatePresence>
  )
}
