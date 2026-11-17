"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import LinoBubble from "@/components/LinoBubble"

const CORNER_DIALOGUES = [
  "...",
  "hello~",
  "^ ^",
  "still here",
  "signal ok",
  "hi",
  "👋",
  "wow",
]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function LinoCorner() {
  const [visible, setVisible]   = useState(false)
  const [tip, setTip]           = useState<string | null>(null)

  useEffect(() => {
    // โผล่ครั้งแรกหลัง 30-90 วิ แล้ววนซ้ำ
    function schedule() {
      const delay = 30000 + Math.random() * 60000
      return setTimeout(() => {
        setVisible(true)
        // หายหลัง 6 วิ
        setTimeout(() => {
          setVisible(false)
          schedule()
        }, 6000)
      }, delay)
    }
    const t = schedule()
    return () => clearTimeout(t)
  }, [])

  function handleClick() {
    setTip(randomItem(CORNER_DIALOGUES))
    setTimeout(() => setTip(null), 2000)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="lino-corner"
          className="fixed bottom-6 right-4 z-40 flex flex-col items-end gap-1"
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.7 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
        >
          {/* mini tip bubble */}
          <AnimatePresence>
            {tip && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  fontFamily: "monospace", fontSize: 10,
                  color: "rgba(255,255,255,0.8)",
                  background: "rgba(137,207,240,0.08)",
                  border: "1px solid rgba(137,207,240,0.18)",
                  borderRadius: 8, padding: "4px 10px",
                  backdropFilter: "blur(8px)",
                  whiteSpace: "nowrap",
                }}
              >
                {tip}
              </motion.div>
            )}
          </AnimatePresence>

          {/* mini lino sphere — signal form only, scaled down */}
          <div
            onClick={handleClick}
            style={{ width: 64, height: 64, transform: "scale(0.55)", transformOrigin: "bottom right", cursor: "pointer" }}
          >
            <LinoBubble state="idle" emotion="happy" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
