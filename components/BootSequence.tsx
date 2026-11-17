"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const BOOT_LINES = [
  "LINUXOS BIOS v2.4.1",
  "Copyright (C) AlternativeWorld33023718",
  "",
  "CPU: LINO_CORE @ 1.0GHz",
  "Memory test: 640K OK",
  "Detecting signal cluster... FOUND",
  "",
  "[    0.000] ENTITY_INIT: ego = true",
  "[    0.042] social_interaction.dll ... loaded",
  "[    0.088] brain.exe ... running",
  "[    0.113] respect.exe ... loaded",
  "[    0.201] identity stabilized",
  "",
  "SYS_OK — booting LinuxOS...",
]

// components ที่ต้อง "load" พร้อม progress bar แต่ละตัว
const LOAD_ITEMS = [
  { label: "kernel",              size: "4.20 MiB",  speed: "12.4 MiB/s" },
  { label: "social.dll",         size: "1.88 MiB",  speed: "8.7 MiB/s"  },
  { label: "brain.exe",          size: "21.32 MiB", speed: "6.1 MiB/s"  },
  { label: "animation.core",     size: "9.71 MiB",  speed: "11.2 MiB/s" },
  { label: "identity.cfg",       size: "0.42 MiB",  speed: "9.9 MiB/s"  },
  { label: "LinO.personality",   size: "68.42 MiB", speed: "7.5 MiB/s"  },
]

const BAR_WIDTH = 16

function renderBar(progress: number) {
  const filled = Math.round(progress * BAR_WIDTH)
  return "[" + "#".repeat(filled) + " ".repeat(BAR_WIDTH - filled) + "]"
}

function ProgressRow({ item, onDone }: { item: typeof LOAD_ITEMS[0]; onDone: () => void }) {
  const [progress, setProgress] = useState(0)
  const [done, setDone]         = useState(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  // ใช้เวลา 600-1100ms ต่อ item
  const duration = useRef(600 + Math.random() * 500)

  useEffect(() => {
    const animate = (now: number) => {
      if (!startRef.current) startRef.current = now
      const t = Math.min((now - startRef.current) / duration.current, 1)
      // easeOutQuad
      const eased = 1 - (1 - t) * (1 - t)
      setProgress(eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDone(true)
        onDone()
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const bar = renderBar(progress)
  const pct  = Math.round(progress * 100)

  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, lineHeight: 1.85 }}>
      {/* label */}
      <span style={{ color: "rgba(137,207,240,0.55)", minWidth: 130, fontSize: 11 }}>
        {item.label}
      </span>
      {/* bar */}
      <span style={{ color: done ? "rgba(137,207,240,0.9)" : "rgba(137,207,240,0.7)", fontSize: 11, letterSpacing: "0.02em" }}>
        {bar}
      </span>
      {/* size / speed / done */}
      <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, minWidth: 90 }}>
        {done
          ? <span style={{ color: "rgba(74,222,128,0.7)" }}>installed</span>
          : `${item.size}  (${item.speed})`
        }
      </span>
      {/* percent เฉพาะตอนกำลัง load */}
      {!done && (
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>
          {pct}%
        </span>
      )}
    </div>
  )
}

export default function BootSequence({ onDone }: { onDone: () => void }) {
  const [lines, setLines]           = useState<string[]>([])
  const [showProgress, setShowProgress] = useState(false)
  const [loadIdx, setLoadIdx]       = useState(0)   // item ที่กำลัง load อยู่
  const [visible, setVisible]       = useState(true)
  const onDoneRef                   = useRef(onDone)

  // phase 1 — พิมพ์ text lines
  useEffect(() => {
    let i = 0
    function addLine() {
      if (i >= BOOT_LINES.length) {
        setTimeout(() => setShowProgress(true), 300)
        return
      }
      setLines(prev => [...prev, BOOT_LINES[i]])
      i++
      const prev = BOOT_LINES[i - 1]
      const delay = prev === ""
        ? 220
        : prev.startsWith("[")
        ? 120 + Math.random() * 80
        : 180 + Math.random() * 140
      setTimeout(addLine, delay)
    }
    addLine()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // phase 2 — progress items โผล่ทีละตัวหลัง prev เสร็จ
  function handleItemDone() {
    setLoadIdx(prev => {
      const next = prev + 1
      if (next >= LOAD_ITEMS.length) {
        // ทุกตัวโหลดเสร็จ — รอแล้ว fade ออก
        setTimeout(() => {
          setVisible(false)
          setTimeout(() => onDoneRef.current(), 500)
        }, 900)
      }
      return next
    })
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col justify-center px-8"
          style={{ background: "#000", fontFamily: "monospace" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* scanlines */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(255,255,255,0.03) 3px, rgba(255,255,255,0.03) 4px)",
          }} />

          <div className="relative flex flex-col" style={{ maxWidth: 560, width: "100%" }}>
            {/* text lines */}
            {lines.map((line, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.05 }}
                style={{
                  fontSize: 11,
                  lineHeight: 1.9,
                  color: !line ? "transparent"
                    : line.startsWith("LINUXOS") || line.startsWith("SYS_OK")
                    ? "rgba(137,207,240,0.9)"
                    : line.startsWith("[")
                    ? "rgba(255,255,255,0.55)"
                    : "rgba(255,255,255,0.75)",
                  letterSpacing: "0.04em",
                }}
              >
                {line || " "}
              </motion.div>
            ))}

            {/* cursor ระหว่างพิมพ์ text */}
            {lines.length < BOOT_LINES.length && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                style={{ display: "inline-block", width: 7, height: 12, background: "rgba(137,207,240,0.8)", marginTop: 2 }}
              />
            )}

            {/* progress section */}
            {showProgress && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                style={{ marginTop: 8 }}
              >
                {/* header */}
                <div style={{ fontSize: 10, color: "rgba(137,207,240,0.35)", letterSpacing: "0.12em", marginBottom: 6 }}>
                  {"installing components..."}
                </div>

                {/* progress rows — โผล่ทีละตัว */}
                {LOAD_ITEMS.slice(0, loadIdx + 1).map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.1 }}
                  >
                    <ProgressRow
                      item={item}
                      onDone={i === loadIdx ? handleItemDone : () => {}}
                    />
                  </motion.div>
                ))}

                {/* done message */}
                {loadIdx >= LOAD_ITEMS.length && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    style={{ marginTop: 10, fontSize: 11, color: "rgba(137,207,240,0.8)", letterSpacing: "0.08em" }}
                  >
                    {"[ OK ] LinO is ready~"}
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
