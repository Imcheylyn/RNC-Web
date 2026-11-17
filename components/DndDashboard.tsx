"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"

interface Player {
  id: string
  userId: string
  name: string
  className: string
  hp: number
  maxHp: number
  slotIndex: number
  avatarUrl?: string
}

interface Session {
  id: string
  channelId: string
  guildId: string
  hostId: string
  state: string
  maxSlots: number
  players: Player[]
  updatedAt: string
}

interface Guild {
  id: string
  name: string
  icon?: string
}

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.min(1, hp / maxHp))
  const color = pct > 0.5 ? "rgba(74,222,128,0.7)" : pct > 0.25 ? "rgba(251,191,36,0.7)" : "rgba(248,113,113,0.7)"
  return (
    <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
      <motion.div
        style={{ height: "100%", background: color, borderRadius: 2 }}
        initial={{ width: 0 }}
        animate={{ width: `${pct * 100}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  )
}

function SessionCard({ session }: { session: Session }) {
  const stateColor = session.state === "combat" ? "rgba(248,113,113,0.8)" : session.state === "lobby" ? "rgba(74,222,128,0.7)" : "rgba(137,207,240,0.5)"
  const activePlayers = session.players.filter(p => p.name)

  return (
    <div style={{
      border: "1px solid rgba(137,207,240,0.1)",
      borderRadius: 6,
      padding: "12px 14px",
      background: "rgba(137,207,240,0.02)",
      marginBottom: 10,
    }}>
      {/* session header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.1em", color: "rgba(137,207,240,0.4)" }}>
          #{session.channelId.slice(-6)}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.12em", fontWeight: 700, color: stateColor }}>
          [{session.state.toUpperCase()}]
        </span>
      </div>

      {/* players */}
      {activePlayers.length === 0 ? (
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(137,207,240,0.25)", letterSpacing: "0.06em" }}>
          // no players yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activePlayers.map(p => (
            <div key={p.id}>
              <div className="flex items-baseline justify-between" style={{ marginBottom: 3 }}>
                <div className="flex items-baseline gap-2">
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>
                    {p.name}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(137,207,240,0.45)" }}>
                    {p.className}
                  </span>
                </div>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: p.hp < p.maxHp * 0.25 ? "rgba(248,113,113,0.8)" : "rgba(255,255,255,0.5)" }}>
                  {p.hp}/{p.maxHp}
                </span>
              </div>
              <HpBar hp={p.hp} maxHp={p.maxHp} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DndDashboard() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [guilds,   setGuilds]   = useState<Guild[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/sessions").then(r => r.json()),
      fetch("/api/guilds").then(r => r.json()),
    ]).then(([s, g]) => {
      setSessions(Array.isArray(s) ? s : [])
      setGuilds(Array.isArray(g) ? g : [])
    }).catch(() => setError("connection failed"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(137,207,240,0.5)", letterSpacing: "0.1em" }}>
        {"// connecting to database..."}
      </span>
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center">
      <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(248,113,113,0.7)", letterSpacing: "0.06em" }}>
        {"[ERROR] "}{error}
      </span>
    </div>
  )

  const activeSessions = sessions.filter(s => s.state !== "ended")

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px 20px" }}>

      {/* guilds */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.18em", color: "rgba(137,207,240,0.35)", marginBottom: 8 }}>
          SERVERS {"·"} {guilds.length} online
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {guilds.map(g => (
            <div key={g.id} style={{
              fontFamily: "monospace", fontSize: 11,
              color: "rgba(137,207,240,0.7)",
              border: "1px solid rgba(137,207,240,0.15)",
              borderRadius: 3, padding: "3px 8px",
              letterSpacing: "0.05em",
            }}>
              {g.name}
            </div>
          ))}
          {guilds.length === 0 && (
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(137,207,240,0.25)" }}>// no servers</span>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(137,207,240,0.08)", marginBottom: 16 }} />

      {/* sessions */}
      <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.18em", color: "rgba(137,207,240,0.35)", marginBottom: 10 }}>
        ACTIVE SESSIONS {"·"} {activeSessions.length}
      </div>

      {activeSessions.length === 0 ? (
        <div style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(137,207,240,0.3)", letterSpacing: "0.06em" }}>
          // no active sessions
        </div>
      ) : (
        activeSessions.map(s => <SessionCard key={s.id} session={s} />)
      )}
    </div>
  )
}
