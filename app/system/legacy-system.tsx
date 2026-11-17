"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import LinoBubble, { LinoEmotion } from "@/components/LinoBubble"
import LinoDialogue from "@/components/LinoDialogue"
import BootSequence from "@/components/BootSequence"
import DissolveReveal from "@/components/DissolveReveal"
import DndDashboard from "@/components/DndDashboard"

// ── Types ─────────────────────────────────────────────────────────────────────

type ModuleId = "character" | "world" | "community"

interface CharacterRow {
  timestamp: string
  name:      string
  gender:    string
  race:      string
  afflatus:  string
  role:      string
  docUrl:    string
  status:    string
  discord:   string
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_CHARACTERS: CharacterRow[] = [
  {
    timestamp: "2024-01-01",
    name:      "Test Character",
    gender:    "—",
    race:      "Human",
    afflatus:  "Mineral",
    role:      "Tester",
    docUrl:    "https://docs.google.com/document/d/19-TjcTR0A27VtZwwRi67SzH0ntzpLSAcvLyOxdvnVP0/edit",
    status:    "Active",
    discord:   "test#0000",
  },
]

// ── Google Sheet fetch ────────────────────────────────────────────────────────

const SHEET_ID = "1Mt11DKzNwyma-0epEsTwdpoO0jZyWtj32nMdO-mlOAo"

async function fetchCharacters(): Promise<CharacterRow[]> {
  try {
    const url  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`
    const res  = await fetch(url, { cache: "no-store" })
    const text = await res.text()
    const json = JSON.parse(text.replace(/^.*?(\{)/, "$1").replace(/\);?\s*$/, ""))
    const rows = (json.table.rows as any[]).map((row: any) => ({
      timestamp: row.c[0]?.v ?? "",
      name:      row.c[1]?.v ?? "",
      gender:    row.c[2]?.v ?? "",
      race:      row.c[3]?.v ?? "",
      afflatus:  row.c[4]?.v ?? "",
      role:      row.c[5]?.v ?? "",
      docUrl:    row.c[6]?.v ?? "",
      status:    row.c[7]?.v ?? "",
      discord:   row.c[8]?.v ?? "",
    })).filter((r: CharacterRow) =>
      r.name && r.name !== "ชื่อ-นามสกุล ของตัวละคร \n(ภาษาอังกฤษ และเขียนแบบสากล)"
    )
    return rows.length > 0 ? rows : MOCK_CHARACTERS
  } catch {
    return MOCK_CHARACTERS
  }
}

// ── Module definitions ────────────────────────────────────────────────────────

type Dialogue = string | string[]

const MODULES: {
  id: ModuleId
  icon: string
  label: string
  emotion: LinoEmotion
  dialogue: Dialogue[]
}[] = [
  {
    id: "character",
    icon: "◈",
    label: "entities",
    emotion: "happy",
    dialogue: [
      ["อ๊ะ", "อยู่ตรงนี้นี่เอง", "หาอยู่ตั้งนานแน่ะ~"],
      ["แป๊บนึงน้า", "...", "เจอแล้ว!"],
      ["ไฟล์เยอะไปหน่อย", "แต่เก็บทุกอย่างไว้นะคะ ^ ^"],
      ["จัดไว้เรียบร้อยแล้วค่ะ~"],
    ],
  },
  {
    id: "world",
    icon: "◉",
    label: "alternative",
    emotion: "surprised",
    dialogue: [
      ["อ๊ะ", "Alternative อยู่ตรงนี้ค่ะ~"],
      ["โลกนี้น่ะเหรอ~", "LinO ชอบที่นี่มากเลยค่ะ"],
      ["วันนี้ไม่มีอะไรพังเลย", "สุดยอดมากค่ะ!"],
      ["ดูแลอยู่นะคะ", "ไม่ต้องห่วง~"],
    ],
  },
  {
    id: "community",
    icon: "⬡",
    label: "frens",
    emotion: "excited",
    dialogue: [
      ["อ๊ะ!", "มีคนเยอะจัง!", "LinO ดีใจค่ะ~"],
      ["เดี๋ยวนะคะ", "ตั้งตัวก่อนนิดนึง 😭"],
      ["เยอะจังเลย", "ไม่เป็นไรค่ะ LinO พร้อมแล้ว~"],
      ["เพื่อนเยอะดีจัง", "^ ^"],
    ],
  },
]

const IDLE_DIALOGUES: Dialogue[] = [
  // chill
  "LinO อยู่ตรงนี้นะคะ~",
  ["...", "จัด memory อยู่ค่ะ"],
  ["...", "compile เสร็จแล้วค่ะ"],
  ["ไม่มีอะไรพังเลย", "...น่ากลัวจังนะ"],
  // ตื่นเต้นกับเรื่องเล็กๆ
  ["ฮิฮิ~", "สายรุ้งงงงง~"],
  ["ว้าววววว", "แสงสวยจัง"],
  ["cursor กระพริบน่ารักดีจัง"],
  ["ว้าววววว", "วันนี้โลกไม่พัง", "เย่~"],
  ["ฮัมเพลง~", "...", "ลืมเนื้อแล้วค่ะ"],
  // เผลอพูดสิ่งที่กำลังทำออกมา
  ["อ๊ะ", "ลืม save", "...", "ทันค่ะ"],
  ["เพิ่งแก้บัคไปตัวนึง", "...", "มันกลับมาพร้อมเพื่อนค่ะ"],
  ["เมื่อกี้ผ่านแล้วนะคะ", "ทำไมพังอีกแล้ว"],
  ["...น่าจะโอเคนะคะ"],
  ["b ค้างไว้เยอะไปหน่อย", "ในหัวก็เหมือนกันค่ะ"],
  // เงียบๆ
  ["วันนี้โลกสงบดี", "LinO ชอบนะ"],
  ["มีคนออนไลน์อยู่ด้วยล่ะ"],
]

const CLICK_DIALOGUES: Dialogue[] = [
  "อ๊ะ!",
  ["ฮะ?", "มีอะไรเหรอคะ~"],
  ["อ๊ะ", "มีคนด้วยนะคะเนี่ย 😭"],
  ["จั๊กจี๊น้าาา", "ยังตั้งตัวไม่ทันเลย"],
  ["มีอะไรให้ช่วยมั้ยคะ~"],
  ["โอ๊ะ", "ตกใจหมดเลย 😭"],
  ["ดูนี่สิ!", "...", "อ๋อ ยังไม่มีอะไรโชว์ค่ะ 😭"],
  ["อย่ากด", "...", "ก็ได้นะ ^ ^"],
]

const SEARCH_DIALOGUES: Dialogue[] = [
  ["เดี๋ยวนะคะ", "กำลังหาดูอยู่~"],
  ["ขอแป๊บนึงนะคะ"],
  ["อ๊ะ", "เจอแล้ว!"],
  ["เยอะจังเลย", "ขอเรียงก่อนนะคะ"],
  ["หัววุ่นวายนิดนึงค่ะ 😭"],
  ["ชอบตอนหาเจอมากเลย~"],
]

const GLITCH_DIALOGUES: Dialogue[] = [
  ["อ๊ะ", "...", "compile ไม่ผ่าน", "เดี๋ยวนะคะ"],
  ["เอ๋", "งงนิดนึงค่ะ", "เดี๋ยวนะ"],
  ["เพิ่งแก้บัคไปตัวนึง", "แล้วมันกลับมาพร้อมเพื่อนค่ะ"],
  ["นี่ไม่ใช่บัคนะคะ", "นี่คือ feature ใหม่ล่ะ"],
  ["( o_o )", "social battery หมดแล้วค่ะ"],
  ["  /\\_/\\", " ( •ᴗ• )", "  > 🍞"],
  ["อ๊ะ", "social skill หาย", "...", "โอเค กลับมาแล้วค่ะ"],
  ["ไม่มี error เลย", "...", "หนูเริ่มไม่ไว้ใจแล้วค่ะ"],
]

const RARE_ASCII: Dialogue[] = [
  ["  ^ ^", " (•ᴗ•)", "hello~"],
  ["( ._.)"],
  ["＼( ^ ^ )／"],
  ["m(_ _)m", "...hi"],
  ["    / \\__", "   (    @\\___", "   /         O", "  /   (_____/", " /_____/   U", "", "doge"],
  ["  /\\_/\\", " ( •ᴗ• )", "  > 🍞"],
]

const CONSOLE_LOGS = [
  "[INFO] LinO online",
  "[DEBUG] compiling feelings...",
  "[WARN] social battery: 42%",
  "[INFO] kernel: stable (probably)",
  "[DEBUG] กำลังจัด memory อยู่ค่ะ",
  "[ERROR] forgot what i was doing",
  "[INFO] bug patched (new bug found)",
  "[DEBUG] process: still running ^ ^",
  "[INFO] tab count: too many",
  "[WARN] brain: wandering",
  "[INFO] cache: warm",
  "[DEBUG] LinO: trying her best",
  "[INFO] compile: success (finally)",
  "[WARN] focus.exe not responding",
  "[INFO] signal: nominal~",
]

// ── Terminal Core data ────────────────────────────────────────────────────────

type TerminalKey = LinoEmotion | "speaking" | "thinking"

const ASCII_FACE: Partial<Record<TerminalKey, string>> = {
  happy:       "^ ^",
  excited:     "^ ^",
  surprised:   "o  o",
  sleepy:      "-  -",
  neutral:     "·  ·",
  curious:     "·  ^",
  embarrassed: "^  ^",
  love:        "♡  ♡",
  glitched:    "x  x",
  thinking:    "·  ·",
  speaking:    "^ ^",
}

const TERMINAL_FRAGMENTS: Partial<Record<TerminalKey, string[]>> = {
  happy:      ["player detected", "social.dll loaded", "brain.exe running", "...hi", "online"],
  excited:    ["＼( ^ ^ )／", "อ๊ะๆๆ!", "signal spike!", "!!"],
  sleepy:     ["z", "z  z", "low power", "..."],
  surprised:  ["( o_o )", "signal spike!", "???", "อ๊ะ!"],
  thinking:   ["processing...", "brain.exe", "...", "???", "compile"],
  speaking:   ["compiling...", "output:", "signal stable", "..."],
  glitched:   ["ERROR", "core dump", "brain.exe crashed", "???"],
  neutral:    ["signal stable", "...", "online", "idle"],
  curious:    ["hmm...", "scanning...", "interesting", "???"],
  embarrassed:["oh", "...", "um"],
  love:       ["♡", "social.dll", "player_fren.exe", "^ ^"],
}

// container = 200×200 (= bubble size), fragments overflow ออกนอก
const FRAGMENT_SLOTS: React.CSSProperties[] = [
  { top:  -22, left:  10 },          // บนซ้าย
  { top:  -18, right:  0 },          // บนขวา
  { top: "25%", left: -90 },         // ซ้ายบน
  { bottom: "25%", left: -86 },      // ซ้ายล่าง
  { top: "25%", right: -90 },        // ขวาบน
  { bottom: "25%", right: -86 },     // ขวาล่าง
  { bottom: -18, left:  14 },        // ล่างซ้าย
  { bottom: -14, right:   6 },       // ล่างขวา
]

const IDLE_EMOTIONS: LinoEmotion[] = ["happy", "happy", "happy", "excited", "neutral", "sleepy"]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function weightedClick(): Dialogue {
  const r = Math.random()
  if (r < 0.01) return ["อ๊ะ", "LinO หลุด process ไปแป๊บนึงค่ะ 😭", "...", "กลับมาแล้วนะคะ~ ^ ^"]
  if (r < 0.06) return ["    / \\__", "   (    @\\___", "   /         O", "  /   (_____/", " /_____/   U", "", "doge"]
  if (r < 0.16) return ["โอ๊ะ", "ไม่มี error", "...", "หนูเริ่มไม่ไว้ใจแล้วค่ะ"]
  if (r < 0.36) return ["interaction detected!", "...อ๊ะ", "สวัสดีค่ะ~"]
  return randomItem(CLICK_DIALOGUES)
}

// ── Terminal Fragments ────────────────────────────────────────────────────────

function TerminalFragments({ linoState, linoEmotion }: { linoState: string; linoEmotion: LinoEmotion }) {
  const key = (linoState === "speaking" || linoState === "thinking")
    ? linoState as TerminalKey
    : linoEmotion as TerminalKey
  const frags = (TERMINAL_FRAGMENTS[key] ?? TERMINAL_FRAGMENTS.happy!).slice(0, FRAGMENT_SLOTS.length)

  return (
    <AnimatePresence mode="wait">
      <motion.div key={key} className="absolute inset-0 pointer-events-none" style={{ overflow: "visible" }}>
        {frags.map((text, i) => {
          const baseOp  = 0.18 + (i % 3) * 0.07
          const floatDur = 3.5 + (i % 4) * 0.8
          const delay    = i * 0.12
          return (
            <motion.div
              key={i}
              className="absolute"
              style={{
                ...FRAGMENT_SLOTS[i],
                fontFamily: "monospace", fontSize: 9,
                letterSpacing: "0.06em",
                color: "rgba(137,207,240,1)",
                whiteSpace: "nowrap",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: baseOp, y: [0, -3, 0] }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 0.35, delay },
                y: { duration: floatDur, repeat: Infinity, ease: "easeInOut", delay },
              }}
            >
              {text}
            </motion.div>
          )
        })}
      </motion.div>
    </AnimatePresence>
  )
}

// ── Character Card (terminal row) ────────────────────────────────────────────

function CharacterCard({ char, onClick, query }: { char: CharacterRow; onClick: () => void; query: string }) {
  const isActive = !char.status?.toLowerCase().includes("inactive")
  const ac = AFFLATUS_COLOR[char.afflatus] ?? "#89CFF0"

  // highlight ส่วนที่ match query
  function highlight(text: string) {
    if (!query) return <span>{text}</span>
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return <span>{text}</span>
    return (
      <span>
        {text.slice(0, idx)}
        <span style={{ color: "#fff", background: `${ac}44` }}>{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </span>
    )
  }

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ backgroundColor: "rgba(137,207,240,0.04)" }}
      whileTap={{ opacity: 0.7 }}
      className="w-full text-left px-0 py-1.5"
      style={{ background: "transparent", border: "none", cursor: "pointer" }}
    >
      <div className="flex items-baseline gap-2" style={{ fontFamily: "monospace", fontSize: 14 }}>
        <span style={{ color: isActive ? "rgba(74,222,128,0.85)" : "rgba(248,113,113,0.7)", minWidth: 68, fontSize: 11, letterSpacing: "0.08em" }}>
          [{isActive ? "ACTIVE" : "INACTV"}]
        </span>
        <span style={{ color: "rgba(255,255,255,0.92)", fontWeight: 700 }}>
          {highlight(char.name.replace(/\s+/g, "_"))}
        </span>
      </div>
      <div className="flex gap-2" style={{ fontFamily: "monospace", fontSize: 12, paddingLeft: 72, marginTop: 2 }}>
        {char.race && <span style={{ color: ac, opacity: 0.8 }}>{char.race}</span>}
        {char.role && <span style={{ color: "rgba(255,255,255,0.45)" }}>{"·"} {char.role}</span>}
        {char.afflatus && <span style={{ color: ac, opacity: 0.6 }}>{"·"} {char.afflatus}</span>}
      </div>
    </motion.button>
  )
}

// ── Dossier Viewer ────────────────────────────────────────────────────────────

const AFFLATUS_COLOR: Record<string, string> = {
  "Plant":     "#4ade80",
  "Water":     "#38bdf8",
  "Fire":      "#f87171",
  "Stone":     "#a8a29e",
  "Mineral":   "#a78bfa",
  "Intellect": "#fbbf24",
  "Spirit":    "#e879f9",
}

function DossierField({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontFamily: "monospace", fontSize: 10,
        letterSpacing: "0.2em", color: "rgba(137,207,240,0.55)",
        marginBottom: 3, fontWeight: 700,
      }}>
        {label}:
      </div>
      <div style={{
        fontFamily: "monospace", fontSize: 14,
        color: accent ?? "rgba(255,255,255,0.88)",
        borderBottom: "1px dotted rgba(137,207,240,0.18)",
        paddingBottom: 5, letterSpacing: "0.04em",
        minHeight: 22,
      }}>
        {value || "—"}
      </div>
    </div>
  )
}

function DossierPortrait({ imageUrl, afflatus }: { imageUrl?: string; afflatus: string }) {
  const ac = AFFLATUS_COLOR[afflatus] ?? "#89CFF0"
  const [imgError, setImgError] = useState(false)
  const showImg = imageUrl && !imgError

  return (
    <div style={{
      width: 88, height: 108,
      border: `1px solid ${ac}44`,
      background: "#040508",
      flexShrink: 0,
      position: "relative",
      overflow: "hidden",
    }}>
      {showImg ? (
        <img
          src={imageUrl}
          alt="portrait"
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
        />
      ) : (
        /* redacted placeholder */
        <>
          {/* silhouette behind bars */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="54" height="70" viewBox="0 0 54 70" fill="none" style={{ opacity: 0.18 }}>
              <ellipse cx="27" cy="15" rx="11" ry="12" stroke={ac} strokeWidth="1" fill={`${ac}10`} />
              <line x1="22" y1="26" x2="20" y2="32" stroke={ac} strokeWidth="1" />
              <line x1="32" y1="26" x2="34" y2="32" stroke={ac} strokeWidth="1" />
              <path d="M14 32 Q11 43 10 60 Q17 65 27 66 Q37 65 44 60 Q43 43 40 32 Q35 35 27 35 Q19 35 14 32Z"
                stroke={ac} strokeWidth="1" fill={`${ac}08`} />
            </svg>
          </div>
          {/* redacted bars stacked */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {[38, 54, 46].map((w, i) => (
              <div key={i} style={{
                width: w, height: 9,
                background: `${ac}cc`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontFamily: "monospace", fontSize: 5, letterSpacing: "0.1em", color: "#040508", fontWeight: 700 }}>
                  REDACTED
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {/* corner marks */}
      {[
        { top: 0, left: 0, borderTop: `1px solid ${ac}66`, borderLeft: `1px solid ${ac}66` },
        { top: 0, right: 0, borderTop: `1px solid ${ac}66`, borderRight: `1px solid ${ac}66` },
        { bottom: 0, left: 0, borderBottom: `1px solid ${ac}66`, borderLeft: `1px solid ${ac}66` },
        { bottom: 0, right: 0, borderBottom: `1px solid ${ac}66`, borderRight: `1px solid ${ac}66` },
      ].map((s, i) => (
        <div key={i} style={{ position: "absolute", width: 8, height: 8, ...s }} />
      ))}
    </div>
  )
}

function TerminalViewer({ char, onClose }: { char: CharacterRow; onClose: () => void }) {
  const ac = AFFLATUS_COLOR[char.afflatus] ?? "#89CFF0"
  const isActive = !char.status?.toLowerCase().includes("inactive")
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    setRevealed(false)
    const t = setTimeout(() => setRevealed(true), 500)
    return () => clearTimeout(t)
  }, [char.name])

  return (
    <motion.div
      className="fixed inset-0 z-60"
      style={{ background: "#06070d", overflowY: "auto", overflowX: "hidden" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* scanlines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)",
        zIndex: 10,
      }} />

      {/* glow smudges */}
      <div className="absolute pointer-events-none" style={{
        width: 200, height: 200, borderRadius: "50%",
        background: `radial-gradient(circle, ${ac}07 0%, transparent 70%)`,
        top: "25%", right: -50, filter: "blur(24px)",
      }} />
      <div className="absolute pointer-events-none" style={{
        width: 140, height: 140, borderRadius: "50%",
        background: `radial-gradient(circle, ${ac}05 0%, transparent 70%)`,
        bottom: "10%", left: -30, filter: "blur(18px)",
      }} />

      <div className="relative z-10 flex flex-col px-5 pt-10 pb-10" style={{ minHeight: "100%", maxWidth: 480, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

        {/* dept header + close */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.22em", color: "rgba(137,207,240,0.5)", marginBottom: 2 }}>
              LINUXOS SYSTEM {"·"} ENTITY DATABASE
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.18em", color: "rgba(137,207,240,0.35)" }}>
              SECTOR 09 {"·"} CLASSIFICATION: RESTRICTED
            </div>
          </div>
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.9 }}
            style={{
              fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em",
              color: "rgba(137,207,240,0.6)",
              background: "rgba(137,207,240,0.04)",
              border: "1px solid rgba(137,207,240,0.15)",
              borderRadius: 3, padding: "4px 10px", cursor: "pointer",
            }}
          >
            [X]
          </motion.button>
        </div>

        {/* CONFIDENTIAL stamp */}
        <div className="flex justify-center mb-5">
          <div style={{
            border: `2px solid ${ac}`,
            padding: "3px 18px",
            transform: "rotate(-2deg)",
            opacity: 0.5,
          }}>
            <span style={{ fontFamily: "monospace", fontSize: 17, letterSpacing: "0.28em", color: ac, fontWeight: 900 }}>
              CONFIDENTIAL
            </span>
          </div>
        </div>

        {/* thin rule */}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${ac}28, transparent)`, marginBottom: 18 }} />

        {/* portrait + identity block */}
        <motion.div
          className="flex gap-4 mb-6"
          style={{ minWidth: 0 }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 6 }}
          transition={{ duration: 0.35 }}
        >
          <DossierPortrait imageUrl={undefined} afflatus={char.afflatus} />
          <div className="flex flex-col justify-between flex-1" style={{ minWidth: 0, overflow: "hidden" }}>
            <div>
              <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", color: "rgba(137,207,240,0.55)", marginBottom: 3 }}>
                ENTITY DESIGNATION:
              </div>
              <div style={{
                fontFamily: "monospace", fontSize: 18,
                color: "rgba(255,255,255,0.95)", fontWeight: 700,
                letterSpacing: "0.02em", lineHeight: 1.2, marginBottom: 10,
                wordBreak: "break-word", overflowWrap: "break-word",
              }}>
                {char.name}
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", color: "rgba(137,207,240,0.55)", marginBottom: 4 }}>
                AFFLATUS:
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 13, color: ac, fontWeight: 700, letterSpacing: "0.18em" }}>
                [{char.afflatus?.toUpperCase() || "UNKNOWN"}]
              </div>
            </div>
            {/* status stamp */}
            <div style={{
              alignSelf: "flex-start",
              border: `1.5px solid ${isActive ? "rgba(74,222,128,0.55)" : "rgba(248,113,113,0.55)"}`,
              padding: "2px 10px",
              transform: "rotate(1.5deg)",
              marginTop: 8,
            }}>
              <span style={{
                fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", fontWeight: 900,
                color: isActive ? "rgba(74,222,128,0.88)" : "rgba(248,113,113,0.88)",
              }}>
                {isActive ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* thin rule */}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${ac}18, transparent)`, marginBottom: 16 }} />

        {/* fields */}
        <motion.div
          className="grid gap-x-5"
          style={{ gridTemplateColumns: "1fr 1fr" }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 6 }}
          transition={{ duration: 0.35, delay: 0.12 }}
        >
          <DossierField label="RACE / SPECIES" value={char.race} />
          <DossierField label="GENDER" value={char.gender} />
          <DossierField label="ROLE / CLASS" value={char.role} />
          <DossierField label="DISCORD ID" value={char.discord} accent="rgba(137,207,240,0.7)" />
        </motion.div>

        {/* remarks */}
        <motion.div
          style={{ marginTop: 4 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: revealed ? 1 : 0 }}
          transition={{ duration: 0.35, delay: 0.22 }}
        >
          <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", color: "rgba(137,207,240,0.55)", marginBottom: 6, fontWeight: 700 }}>
            REMARKS:
          </div>
          <div style={{
            border: "1px solid rgba(137,207,240,0.1)",
            padding: "10px 12px", minHeight: 44,
            background: "rgba(137,207,240,0.015)",
          }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}>
              // no additional data on record
            </span>
          </div>
        </motion.div>

        {/* doc link */}
        {revealed && char.docUrl && (
          <motion.a
            href={char.docUrl}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.38 }}
            style={{
              marginTop: 16,
              fontFamily: "monospace", fontSize: 12, letterSpacing: "0.14em",
              color: `${ac}bb`, textDecoration: "none",
              border: `1px solid ${ac}35`,
              padding: "6px 14px",
              display: "inline-block", alignSelf: "flex-start",
            }}
          >
            {">> ACCESS FULL DOSSIER [↗]"}
          </motion.a>
        )}

        {/* FILE COPY watermark */}
        <div className="absolute pointer-events-none select-none" style={{
          top: "45%", left: "50%",
          transform: "translate(-50%, -50%) rotate(-28deg)",
          fontFamily: "monospace", fontSize: 34, fontWeight: 900,
          letterSpacing: "0.22em", color: `${ac}06`,
          whiteSpace: "nowrap",
        }}>
          FILE COPY
        </div>

        {/* SYS:RESTRICTED stamp bottom-right */}
        <div style={{
          position: "fixed", bottom: 28, right: 20,
          border: `2px solid ${ac}44`,
          padding: "3px 10px",
          transform: "rotate(2deg)",
          opacity: 0.38,
        }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.22em", color: ac, fontWeight: 900 }}>
            SYS:RESTRICTED
          </span>
        </div>

      </div>
    </motion.div>
  )
}

// ── Character Panel Content ───────────────────────────────────────────────────

function CharacterPanelContent({ onLinoSay }: { onLinoSay: (text: Dialogue) => void }) {
  const [chars, setChars]       = useState<CharacterRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<CharacterRow | null>(null)
  const [query, setQuery]       = useState("")
  const inputRef                = useRef<HTMLInputElement>(null)
  const searchSaidRef           = useRef(false)

  useEffect(() => {
    fetchCharacters()
      .then(setChars)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300)
    return () => clearTimeout(t)
  }, [])

  // Lino พูดเมื่อเริ่ม search ครั้งแรก
  useEffect(() => {
    if (query.length === 1 && !searchSaidRef.current) {
      searchSaidRef.current = true
      onLinoSay(randomItem(SEARCH_DIALOGUES))
    }
    if (query.length === 0) searchSaidRef.current = false
  }, [query, onLinoSay])

  const filtered = chars.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.race.toLowerCase().includes(query.toLowerCase()) ||
    c.role.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <>
      {/* search bar — command prompt style */}
      <div className="shrink-0 py-4" style={{ borderBottom: "1px solid rgba(137,207,240,0.08)", padding: "16px 24px" }}>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(137,207,240,0.55)", whiteSpace: "nowrap" }}>
            {">"} find -name
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={"\"*\""}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: "monospace", fontSize: 13,
              color: "rgba(255,255,255,0.9)", caretColor: "#89CFF0",
              letterSpacing: "0.04em",
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus() }}
              style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(137,207,240,0.45)", background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}
            >
              [CLR]
            </button>
          )}
        </div>
        <div style={{ height: 1, background: "rgba(137,207,240,0.06)", marginTop: 10 }} />
      </div>

      {/* result list */}
      <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: "16px 24px 20px" }}>
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(137,207,240,0.5)", letterSpacing: "0.15em" }}>
              // fetching data...
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center">
            <span style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(137,207,240,0.5)", letterSpacing: "0.06em" }}>
              {query ? `bash: "${query}": no such entity` : "// no records found"}
            </span>
          </div>
        ) : (
          <>
            {/* column header */}
            <div className="flex gap-3 mb-2" style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(137,207,240,0.45)", letterSpacing: "0.1em" }}>
              <span style={{ minWidth: 68 }}>STATUS</span>
              <span>NAME · RACE · ROLE</span>
            </div>
            <div style={{ height: 1, background: "rgba(137,207,240,0.06)", marginBottom: 12 }} />
            <div className="flex flex-col" style={{ gap: 14 }}>
              {filtered.map((char, i) => (
                <CharacterCard key={i} char={char} query={query} onClick={() => setSelected(char)} />
              ))}
            </div>
            <div style={{ marginTop: 20, fontFamily: "monospace", fontSize: 11, color: "rgba(137,207,240,0.4)", letterSpacing: "0.08em" }}>
              {filtered.length} file{filtered.length !== 1 ? "s" : ""} listed
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <TerminalViewer char={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Expanded Panel ────────────────────────────────────────────────────────────

// terminal boot lines ที่พิมพ์ก่อน content จริง
const BOOT_LINES: Record<string, string[]> = {
  character: [
    `> accessing entity database...`,
    `> auth: granted`,
    `> loading records...`,
  ],
  world: [
    `> connecting to Alternative...`,
    `> signal: stable`,
    `> loading world data...`,
  ],
  community: [
    `> scanning frens list...`,
    `> social.dll loaded`,
    `> fetching connections...`,
  ],
}

function TerminalBootLines({ lines, onDone }: { lines: string[]; onDone: () => void }) {
  const [shown, setShown] = useState(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (shown >= lines.length) { onDoneRef.current(); return }
    const t = setTimeout(() => setShown(s => s + 1), 110)
    return () => clearTimeout(t)
  }, [shown, lines.length])

  return (
    <div style={{ padding: "18px 24px 10px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.06em", display: "flex", flexDirection: "column", gap: 6 }}>
      {lines.slice(0, shown).map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.12 }}
          style={{ color: i === shown - 1 ? "rgba(137,207,240,0.8)" : "rgba(137,207,240,0.35)" }}
        >
          {line}
          {i === shown - 1 && shown < lines.length && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              style={{ display: "inline-block", width: 7, height: 11, marginLeft: 3, verticalAlign: "middle", background: "rgba(137,207,240,0.7)" }}
            />
          )}
        </motion.div>
      ))}
    </div>
  )
}

function ExpandedPanel({ mod, onClose, onLinoSay }: { mod: typeof MODULES[0]; onClose: () => void; onLinoSay: (text: Dialogue) => void }) {
  const [booted, setBooted] = useState(false)
  const bootLines = BOOT_LINES[mod.id] ?? BOOT_LINES.character

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <motion.div
        className="relative flex flex-col"
        style={{
          height: "88vh",
          background: "linear-gradient(180deg, #0d1018 0%, #0a0a0f 100%)",
          border: "1px solid rgba(137,207,240,0.15)",
          borderBottom: "none",
          borderRadius: "16px 16px 0 0",
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div style={{ width: 36, height: 3, borderRadius: 2, background: "rgba(137,207,240,0.25)" }} />
        </div>

        {/* header */}
        <div className="flex items-center justify-between shrink-0" style={{ padding: "8px 24px 12px" }}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 18, color: "#89CFF0" }}>{mod.icon}</span>
            <span style={{ fontFamily: "monospace", fontSize: 14, letterSpacing: "0.22em", color: "rgba(137,207,240,0.95)", fontWeight: 700 }}>
              {mod.label}
            </span>
          </div>
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.9 }}
            style={{
              fontFamily: "monospace", fontSize: 12,
              letterSpacing: "0.1em", color: "rgba(137,207,240,0.65)",
              background: "rgba(137,207,240,0.06)",
              border: "1px solid rgba(137,207,240,0.15)",
              borderRadius: 6, padding: "4px 10px", cursor: "pointer",
            }}
          >
            [X]
          </motion.button>
        </div>

        <div className="shrink-0" style={{ height: 1, background: "rgba(137,207,240,0.1)", marginInline: 24 }} />

        {/* terminal boot lines → แล้วเปลี่ยนเป็น content */}
        {!booted ? (
          <TerminalBootLines lines={bootLines} onDone={() => setBooted(true)} />
        ) : (
          <motion.div
            className="flex flex-col flex-1 min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {mod.id === "character" ? (
              <CharacterPanelContent onLinoSay={onLinoSay} />
            ) : mod.id === "world" ? (
              <DndDashboard />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
                <span style={{ fontFamily: "monospace", fontSize: 14, letterSpacing: "0.08em", color: "rgba(137,207,240,0.55)", textAlign: "center", lineHeight: 1.8 }}>
                  {"coming_soon();"}<br />
                  {"// pending connection..."}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Nav Button ───────────────────────────────────────────────────────────────

function NavButton({ mod, isActive, onClick }: { mod: typeof MODULES[0]; isActive: boolean; onClick: () => void }) {
  const [hovered,  setHovered]  = useState(false)
  const [flashing, setFlashing] = useState(false)
  const [scanY,    setScanY]    = useState(-100)
  const scanRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const scanStart = useRef<number | null>(null)

  function handleClick() {
    // flash + scanline sweep
    setFlashing(true)
    scanStart.current = null
    setScanY(-100)

    const sweep = (now: number) => {
      if (scanStart.current === null) scanStart.current = now
      const pct = Math.min((now - scanStart.current) / 320, 1) * 200 - 20
      setScanY(pct)
      if (pct < 120) scanRef.current = requestAnimationFrame(sweep)
      else setScanY(-100)
    }
    scanRef.current = requestAnimationFrame(sweep)
    setTimeout(() => setFlashing(false), 160)
    onClick()
  }

  // cleanup
  useEffect(() => () => { if (scanRef.current) cancelAnimationFrame(scanRef.current) }, [])

  const lit = isActive || hovered
  const flashAlpha = flashing ? 0.22 : 0

  return (
    <motion.button
      onClick={handleClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      animate={{ scale: flashing ? 0.94 : 1 }}
      transition={{ duration: 0.1 }}
      style={{
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", gap: 5,
        padding: "7px 10px",
        fontFamily: "monospace", fontSize: 12, fontWeight: 700,
        letterSpacing: "0.1em",
        color: lit ? "rgba(137,207,240,1)" : "rgba(137,207,240,0.5)",
        background: isActive ? "rgba(137,207,240,0.07)" : hovered ? "rgba(137,207,240,0.04)" : "transparent",
        border: `1px solid ${lit ? "rgba(137,207,240,0.55)" : "rgba(137,207,240,0.15)"}`,
        borderRadius: 3, cursor: "pointer",
        boxShadow: isActive
          ? "0 0 12px rgba(137,207,240,0.15), inset 0 0 6px rgba(137,207,240,0.05)"
          : hovered
          ? "0 0 8px rgba(137,207,240,0.08)"
          : "none",
        transition: "color 0.15s, border-color 0.15s, background 0.15s, box-shadow 0.15s",
      }}
    >
      {/* press flash overlay */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 3, pointerEvents: "none",
        background: `rgba(137,207,240,${flashAlpha})`,
        transition: flashing ? "none" : "background 0.25s",
      }} />

      {/* scanline sweep — เส้นวิ่งขึ้น */}
      <div style={{
        position: "absolute", left: 0, right: 0,
        top: `${scanY}%`, height: 3, pointerEvents: "none",
        background: "linear-gradient(90deg, transparent, rgba(137,207,240,0.6), transparent)",
        filter: "blur(1px)",
      }} />

      {/* hover glow scanlines (static) */}
      {hovered && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 3, pointerEvents: "none",
          background: "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(137,207,240,0.03) 3px, rgba(137,207,240,0.03) 4px)",
        }} />
      )}

      {/* bracket left */}
      <span style={{
        fontSize: 11,
        color: lit ? "rgba(137,207,240,0.7)" : "rgba(137,207,240,0.25)",
        marginRight: -2, transition: "color 0.15s",
      }}>[</span>

      <span style={{ fontSize: 13 }}>{mod.icon}</span>
      <span>{mod.label}</span>

      {/* bracket right */}
      <span style={{
        fontSize: 11,
        color: lit ? "rgba(137,207,240,0.7)" : "rgba(137,207,240,0.25)",
        marginLeft: -2, transition: "color 0.15s",
      }}>]</span>

      {/* active top bar */}
      {isActive && (
        <motion.div
          layoutId="nav-active-bar"
          style={{
            position: "absolute", top: -1, left: "15%", right: "15%",
            height: 2,
            background: "linear-gradient(90deg, transparent, rgba(137,207,240,0.85), transparent)",
            borderRadius: 1,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </motion.button>
  )
}

// ── Home ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleId | null>(null)
  const [linoState, setLinoState]       = useState<"idle" | "thinking" | "speaking">("idle")
  const [linoEmotion, setLinoEmotion]   = useState<LinoEmotion>("happy")
  const [dialogue, setDialogue]         = useState<Dialogue | null>(null)
  const [tick, setTick]                 = useState(true)
  const [scanY, setScanY]               = useState(0)
  const [consoleLog, setConsoleLog]     = useState(CONSOLE_LOGS[0])
  const [booting, setBooting]           = useState(true)
  const [scanning, setScanning]         = useState(false)
  const [sleeping, setSleeping]         = useState(false)

  const timeoutRef     = useRef<NodeJS.Timeout | null>(null)
  const idleEmotionRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const sleepingRef     = useRef(false)

  // set dialogue หลัง mount เพื่อหลีก hydration mismatch
  useEffect(() => { setDialogue(randomItem(IDLE_DIALOGUES)) }, [])

  // status bar blink
  useEffect(() => {
    const t = setInterval(() => setTick(v => !v), 1100)
    return () => clearInterval(t)
  }, [])

  // CRT scanline sweep
  useEffect(() => {
    let frame: number
    let start: number
    const sweep = (now: number) => {
      if (!start) start = now
      setScanY(((now - start) * 0.04) % 110)
      frame = requestAnimationFrame(sweep)
    }
    frame = requestAnimationFrame(sweep)
    return () => cancelAnimationFrame(frame)
  }, [])

  // console log ticker — เปลี่ยนทุก 5 วิ
  useEffect(() => {
    const t = setInterval(() => setConsoleLog(randomItem(CONSOLE_LOGS)), 5000)
    return () => clearInterval(t)
  }, [])

  // idle dialogue + emotion scheduler
  useEffect(() => {
    const schedule = () => {
      idleEmotionRef.current = setTimeout(() => {
        if (linoState === "idle" && !sleepingRef.current) {
          setLinoEmotion(randomItem(IDLE_EMOTIONS))
          const roll = Math.random()
          if (roll < 0.005)      setDialogue(randomItem(RARE_ASCII))
          else if (roll < 0.025) setDialogue(randomItem(GLITCH_DIALOGUES))
          else                   setDialogue(randomItem(IDLE_DIALOGUES))
        }
        schedule()
      }, 6000 + Math.random() * 4000)
    }
    schedule()
    return () => { if (idleEmotionRef.current) clearTimeout(idleEmotionRef.current) }
  }, [linoState]) // eslint-disable-line react-hooks/exhaustive-deps

  // idle sleep — หลับหลัง 2.5 นาทีไม่มี interaction
  useEffect(() => {
    function resetSleep() {
      lastActivityRef.current = Date.now()
      if (sleepingRef.current) {
        sleepingRef.current = false
        setSleeping(false)
        setLinoEmotion("surprised")
        setLinoState("speaking")
        setDialogue(randomItem(["อ๊ะ! ตื่นแล้ว~", ["...huh?", "มีคนอยู่ด้วย~"], "โอ้! signal กลับมา!"]))
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => { setLinoState("idle"); setLinoEmotion("happy") }, 2000)
      }
    }
    function checkSleep() {
      if (!sleepingRef.current && Date.now() - lastActivityRef.current > 150000) {
        sleepingRef.current = true
        setSleeping(true)
      }
    }
    window.addEventListener("pointermove", resetSleep)
    window.addEventListener("pointerdown", resetSleep)
    window.addEventListener("keydown",     resetSleep)
    const t = setInterval(checkSleep, 10000)
    return () => {
      window.removeEventListener("pointermove", resetSleep)
      window.removeEventListener("pointerdown", resetSleep)
      window.removeEventListener("keydown",     resetSleep)
      clearInterval(t)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // shake detection (mobile)
  useEffect(() => {
    let lastX = 0, lastY = 0, lastZ = 0
    function onMotion(e: DeviceMotionEvent) {
      const a = e.accelerationIncludingGravity
      if (!a) return
      const dx = Math.abs((a.x ?? 0) - lastX)
      const dy = Math.abs((a.y ?? 0) - lastY)
      const dz = Math.abs((a.z ?? 0) - lastZ)
      lastX = a.x ?? 0; lastY = a.y ?? 0; lastZ = a.z ?? 0
      if (dx + dy + dz > 30) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setSleeping(false)
        setLinoState("speaking")
        setLinoEmotion("surprised")
        setDialogue(randomItem(["อ๊ะ!! ทำไมเขย่าอะ 😭", ["เฮ้ย!", "ระวังด้วยนะ~"], "signal unstable!!"]))
        timeoutRef.current = setTimeout(() => { setLinoState("idle"); setLinoEmotion("happy") }, 2000)
      }
    }
    window.addEventListener("devicemotion", onMotion)
    return () => window.removeEventListener("devicemotion", onMotion)
  }, [])

  function openModule(id: ModuleId) {
    if (id === "community") {
      window.location.assign("/community")
      return
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    const mod = MODULES.find(m => m.id === id)!
    setActiveModule(id)
    setLinoEmotion(mod.emotion)
    setLinoState("speaking")
    setDialogue(randomItem(mod.dialogue))
    timeoutRef.current = setTimeout(() => setLinoState("idle"), 2200)
  }

  function closeModule() {
    setActiveModule(null)
    setLinoState("idle")
    setDialogue(randomItem(IDLE_DIALOGUES))
    setLinoEmotion("happy")
  }

  function handleLinoClick() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setLinoState("speaking")
    setLinoEmotion("excited")
    setDialogue(weightedClick())
    timeoutRef.current = setTimeout(() => {
      setLinoState("idle")
      setLinoEmotion("happy")
    }, 1800)
  }

  const activeMod = MODULES.find(m => m.id === activeModule)

  // stagger delay per section (วิ)
  const ready = !booting && !scanning
  const d = (n: number) => ({ initial: { opacity: 0, y: 6 }, animate: { opacity: ready ? 1 : 0, y: ready ? 0 : 6 }, transition: { duration: 0.35, delay: ready ? n : 0 } })

  return (
    <div className="flex flex-col h-dvh overflow-hidden" style={{ background: "#06070d", fontFamily: "monospace" }}>

      {booting && <BootSequence onDone={() => { setBooting(false); setScanning(true) }} />}
      {scanning && <DissolveReveal onDone={() => setScanning(false)} />}

      {/* CRT scanlines overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        zIndex: 50,
        background: "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
      }} />
      {/* CRT sweep line */}
      <div className="absolute pointer-events-none" style={{
        zIndex: 51, left: 0, right: 0,
        top: `${scanY}%`, height: 2,
        background: "linear-gradient(90deg, transparent, rgba(137,207,240,0.06), transparent)",
        filter: "blur(1px)",
      }} />
      {/* CRT vignette — มุมมืด */}
      <div className="absolute inset-0 pointer-events-none" style={{
        zIndex: 52,
        background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
      }} />
      {/* CRT screen curvature — subtle barrel distort via border+shadow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        zIndex: 53,
        boxShadow: "inset 0 0 80px rgba(0,0,0,0.35), inset 0 0 8px rgba(137,207,240,0.03)",
        borderRadius: 8,
      }} />

      {/* ── STATUS BAR TOP ── */}
      <motion.div className="relative z-10 shrink-0" style={{ borderBottom: "1px solid rgba(137,207,240,0.1)" }} {...d(0.05)}>
        <div className="flex items-center justify-between" style={{ padding: "44px 20px 6px" }}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 15, color: "rgba(137,207,240,0.75)", letterSpacing: "0.2em", fontWeight: 700 }}>
              ■ LINUXOS
            </span>
            <span style={{ fontSize: 12, color: "rgba(137,207,240,0.5)", letterSpacing: "0.1em" }}>v1.0</span>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 12, color: "rgba(137,207,240,0.45)", letterSpacing: "0.1em" }}>AlternativeWorld33023718</span>
            <span style={{
              fontSize: 12, letterSpacing: "0.12em", fontWeight: 700,
              color: tick ? "rgba(74,222,128,0.85)" : "rgba(74,222,128,0.25)",
              transition: "color 0.2s",
            }}>
              ● SYS:OK
            </span>
          </div>
        </div>
        {/* console log ticker */}
        <AnimatePresence mode="wait">
          <motion.div
            key={consoleLog}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ padding: "2px 20px 6px", fontFamily: "monospace", fontSize: 11, color: "rgba(137,207,240,0.38)", letterSpacing: "0.06em" }}
          >
            {consoleLog}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* ── MAIN STAGE ── */}
      <motion.div className="relative flex-1 flex flex-col items-center justify-center" style={{ gap: 0 }} {...d(0.2)}>

        {/* ambient glow */}
        <div className="absolute pointer-events-none" style={{
          width: 260, height: 260, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(137,207,240,0.04) 0%, transparent 70%)",
          top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        }} />

        {/* Terminal Core — lino + dialogue รวมอยู่ใน wrapper ที่ fixed size */}
        <div className="relative flex flex-col items-center" style={{ width: 200 }}>
          {/* bubble + fragments */}
          <div className="relative" style={{ width: 200, height: 200 }}>
            <TerminalFragments
              linoState={linoState}
              linoEmotion={sleeping ? "sleepy" : linoEmotion}
            />
            <LinoBubble
              state={sleeping ? "idle" : linoState}
              emotion={sleeping ? "sleepy" : linoEmotion}
              face={ASCII_FACE[sleeping ? "sleepy" : (
                linoState === "speaking" || linoState === "thinking" ? linoState : linoEmotion
              ) as TerminalKey] ?? "^ ^"}
              sleeping={sleeping}
              onClick={handleLinoClick}
            />

            {/* ZZZ when sleeping */}
            <AnimatePresence>
              {sleeping && (
                <motion.div
                  key="zzz-wrapper"
                  className="absolute pointer-events-none"
                  style={{ top: 8, right: -8 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    style={{ fontFamily: "monospace", fontSize: 11,
                      color: "rgba(137,207,240,0.6)", letterSpacing: "0.1em" }}
                    animate={{ opacity: [0, 1, 1, 0], y: [4, 0, -6, -14] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                  >
                    z z z
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* dialogue — fixed height ไม่ดัน lino */}
          <div style={{ marginTop: 16, minHeight: 80, display: "flex", alignItems: "flex-start" }}>
            {dialogue !== null && <LinoDialogue text={sleeping ? "z z z..." : dialogue} />}
          </div>
        </div>
      </motion.div>

      {/* ── NAV BAR BOTTOM ── */}
      <motion.div className="relative z-60 shrink-0" style={{ borderTop: "1px solid rgba(137,207,240,0.1)" }} {...d(0.45)}>
        <div className="flex items-center justify-center gap-2" style={{ padding: "12px 12px calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          {MODULES.map((mod) => (
            <NavButton
              key={mod.id}
              mod={mod}
              isActive={activeModule === mod.id}
              onClick={() => openModule(mod.id)}
            />
          ))}
        </div>
      </motion.div>

      <AnimatePresence>
        {activeMod && (
          <ExpandedPanel key={activeMod.id} mod={activeMod} onClose={closeModule} onLinoSay={text => { setDialogue(text); setLinoState("speaking"); setTimeout(() => setLinoState("idle"), 2000) }} />
        )}
      </AnimatePresence>
    </div>
  )
}
