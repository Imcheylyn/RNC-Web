"use client"

import { useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useInstability, useIdleEvents, useCursorAwareness, usePetting } from "./hooks"
import {
  AsciiBody,
  OrbitParticles,
  LinoAura,
  ThinkingRing,
  EdgeCorruption,
  CorruptionLayer,
} from "./Effects"
import type { LinoState, LinoEmotion } from "./types"
import { C } from "./constants"

interface LinoBodyProps {
  state?:   LinoState
  emotion?: LinoEmotion
  face?:    string
  sleeping?: boolean
  onClick?: () => void
}

const SPARKLE_CHARS = ["·", "*", "✦", "·", "*"]

export default function LinoBody({ state = "idle", emotion = "happy", face = "^ ^", sleeping = false, onClick }: LinoBodyProps) {
  const linoRef = useRef<HTMLDivElement>(null)

  const isIdle     = state === "idle"
  const isSpeaking = state === "speaking"
  const isThinking = state === "thinking"
  const isExcited  = emotion === "excited" && isSpeaking

  const { driftX, driftY, wobble, asymGlow, bodyFilter } = useInstability()
  const idleEvent = useIdleEvents(isIdle)
  const cursor    = useCursorAwareness(linoRef)
  const isPetting = usePetting(linoRef)

  const isHumming = Array.isArray(face)
    ? false
    : typeof face === "string" && face.includes("~")

  const idleLookX = idleEvent === "look_left" ? -6 : idleEvent === "look_right" ? 6 : idleEvent === "curious" ? 4 : 0
  const cursorLean = cursor.distance < 250 && isIdle
    ? Math.max(-12, Math.min(12, cursor.lookX * 1.5))
    : 0
  const headRotate = idleLookX * 0.4 + cursorLean * 0.4

  const bodyLeanX = isIdle && cursor.distance < 300 ? cursor.lookX / 10 : 0

  const isPulse     = idleEvent === "pulse"
  const auraActive  = isSpeaking || isPulse || (cursor.isHovering && isIdle)
  const particleActive = isIdle && !sleeping

  const glitching = isSpeaking || (cursor.isHovering && !isIdle)
  const glitchFilter = glitching ? "brightness(1.4) contrast(1.6)" : bodyFilter

  // excited bounce: เด้ง y ขึ้นนิดนึง
  const bodyY = isExcited ? [0, -7, 0, -4, 0] : 0

  const bodyScale = sleeping               ? [1, 1.015, 1]
    : isSpeaking             ? [1, 1.02, 1]
    : isPulse                ? [1, 1.03, 1]
    : 1
  const bodyScaleDur = sleeping ? 3 : isExcited ? 0.45 : 0.65
  const bodyRepeat   = isSpeaking || isPulse || sleeping || isExcited

  // petting wiggle — ส่ายซ้ายขวาแทน headRotate ชั่วคราว
  const outerRotate = isPetting ? [-8, 8, -5, 5, -3, 3, 0] : headRotate
  const outerTransition = isPetting
    ? { duration: 1.2, ease: "easeInOut" as const }
    : { duration: 0.45, ease: "easeInOut" as const }

  return (
    <motion.div
      ref={linoRef}
      className="relative flex items-center justify-center cursor-pointer select-none"
      style={{ width: 200, height: 200, x: driftX, y: driftY }}
      onClick={onClick}
      animate={{ rotate: outerRotate, x: isPetting ? 0 : bodyLeanX }}
      transition={outerTransition}
      whileTap={{ scale: 0.95, transition: { duration: 0.1 } }}
    >
      <OrbitParticles active={particleActive} />
      <LinoAura isSpeaking={isSpeaking} isPulse={auraActive} />
      <ThinkingRing active={isThinking} />

      {/* cursor sparkle — โผล่เวลา hover */}
      <AnimatePresence>
        {cursor.isHovering && isIdle && !sleeping && (
          <>
            {SPARKLE_CHARS.map((ch, i) => {
              const angle = (i / SPARKLE_CHARS.length) * Math.PI * 2
              const r = 68 + (i % 2) * 14
              return (
                <motion.div
                  key={i}
                  className="absolute pointer-events-none select-none"
                  style={{
                    fontFamily: "monospace", fontSize: 10,
                    color: `rgba(${C.blueV},0.7)`,
                    top: "50%", left: "50%",
                  }}
                  initial={{ opacity: 0, x: Math.cos(angle) * r * 0.5, y: Math.sin(angle) * r * 0.5, scale: 0 }}
                  animate={{ opacity: [0, 0.7, 0], x: Math.cos(angle) * r, y: Math.sin(angle) * r, scale: [0, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.4, delay: i * 0.15, repeat: Infinity, ease: "easeOut" }}
                >
                  {ch}
                </motion.div>
              )
            })}
          </>
        )}
      </AnimatePresence>

      <motion.div
        className="relative flex items-center justify-center"
        style={{
          width: 118, height: 118,
          borderRadius: wobble,
          background: "transparent",
          boxShadow: asymGlow,
          filter: glitchFilter,
          overflow: "visible",
        }}
        animate={{ scale: isPetting ? [1, 1.06, 1, 1.06, 1] : bodyScale, y: bodyY }}
        transition={{ duration: isPetting ? 1.2 : bodyScaleDur, repeat: (isPetting || bodyRepeat) ? Infinity : 0, ease: "easeInOut" }}
      >
        <AsciiBody face={face} hum={isHumming} lookX={sleeping ? 0 : cursor.lookX} />
        <EdgeCorruption />
        <CorruptionLayer isThinking={isThinking} isSpeaking={isSpeaking} />
      </motion.div>
    </motion.div>
  )
}
