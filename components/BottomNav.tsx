"use client"

import { motion } from "framer-motion"

const TABS = [
  { id: "character", label: "Character" },
  { id: "community", label: "Community" },
  { id: "world", label: "World" },
  { id: "settings", label: "Settings" },
]

interface BottomNavProps {
  active: string
  onChange: (id: string) => void
}

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <div className="flex items-center justify-center gap-2 pb-2 flex-wrap">
      {TABS.map((tab) => {
        const isActive = active === tab.id
        return (
          <motion.button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            whileTap={{ scale: 0.95 }}
            className="relative px-5 py-2 rounded-full text-sm font-medium transition-colors"
            style={{
              background: isActive
                ? "linear-gradient(135deg, rgba(168,216,255,0.25), rgba(255,179,217,0.2))"
                : "rgba(255,255,255,0.04)",
              border: isActive
                ? "1px solid rgba(168,216,255,0.5)"
                : "1px solid rgba(255,255,255,0.08)",
              color: isActive ? "#a8d8ff" : "rgba(255,255,255,0.45)",
              boxShadow: isActive
                ? "0 0 12px rgba(168,216,255,0.2), 0 0 24px rgba(255,179,217,0.1)"
                : "none",
            }}
          >
            {isActive && (
              <motion.div
                layoutId="pill-glow"
                className="absolute inset-0 rounded-full"
                style={{
                  background: "linear-gradient(135deg, rgba(168,216,255,0.1), rgba(255,179,217,0.08))",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
