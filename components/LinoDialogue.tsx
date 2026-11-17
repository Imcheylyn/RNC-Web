"use client"

import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface LinoDialogueProps {
  text:   string | string[]
  speed?: number
}

// typewriter hook — returns displayed text + typing state
function useTypewriter(line: string, speed: number, active: boolean, onDone?: () => void) {
  const [displayed, setDisplayed] = useState(active ? "" : line)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!active) { setDisplayed(line); return }
    doneRef.current = false
    setDisplayed("")
    let i = 0
    const iv = setInterval(() => {
      i++
      setDisplayed(line.slice(0, i))
      if (i >= line.length) {
        clearInterval(iv)
        if (!doneRef.current) { doneRef.current = true; onDone?.() }
      }
    }, speed)
    return () => clearInterval(iv)
  }, [active, line, speed]) // eslint-disable-line react-hooks/exhaustive-deps

  return { displayed, typing: displayed.length < line.length }
}

// single prompt line: > text_
function PromptLine({
  line, speed, active, showCursor, onDone, dim,
}: {
  line: string; speed: number; active: boolean; showCursor: boolean; onDone?: () => void; dim?: boolean
}) {
  const { displayed, typing } = useTypewriter(line, speed, active, onDone)

  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, opacity: dim ? 0 : 1, transition: "opacity 0.2s" }}>
      <span style={{ color: "rgba(137,207,240,0.45)", userSelect: "none" }}>{">"}</span>
      <span style={{ color: "rgba(255,255,255,0.88)" }}>
        {dim ? " " : displayed}
        {(typing || showCursor) && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.55, repeat: Infinity }}
            style={{ display: "inline-block", width: 7, height: 13, marginLeft: 2, verticalAlign: "middle", background: "#89CFF0" }}
          />
        )}
      </span>
    </div>
  )
}

// multi-line: render ทุกบรรทัดทันที (reserve height) แต่ typewriter ทีละบรรทัด
function MultiPrompt({ lines, speed }: { lines: string[]; speed: number }) {
  const [mounted, setMounted]     = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [allDone, setAllDone]     = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    setActiveIdx(0)
    setAllDone(false)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [lines, mounted])

  function onLineDone(idx: number) {
    if (idx < lines.length - 1) {
      timerRef.current = setTimeout(() => setActiveIdx(idx + 1), 320)
    } else {
      setAllDone(true)
    }
  }

  if (!mounted) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <PromptLine line={lines[0]} speed={speed} active={false} showCursor={false} />
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {lines.map((line, idx) => (
        <PromptLine
          key={idx}
          line={line}
          speed={speed}
          active={idx === activeIdx && !allDone}
          showCursor={idx === activeIdx && !allDone}
          onDone={() => onLineDone(idx)}
          dim={idx > activeIdx}
        />
      ))}
    </div>
  )
}

export default function LinoDialogue({ text, speed = 90 }: LinoDialogueProps) {
  const lines  = Array.isArray(text) ? text : null
  const single = Array.isArray(text) ? null : text
  const key    = Array.isArray(text) ? text.join("|") : text

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22 }}
        style={{ fontFamily: "monospace", fontSize: 13, letterSpacing: "0.03em", lineHeight: 1.7, minWidth: 200, maxWidth: 260 }}
      >
        {single !== null ? (
          <PromptLine line={single} speed={speed} active showCursor={false} />
        ) : (
          <MultiPrompt lines={lines!} speed={speed} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
