// ── Lino Color DNA ────────────────────────────────────────────────────────────
// Core = digital signal = white/clean blue
// Blush = incorrect human imitation (thinks human skin = blue)
// Corrupt = incomplete code = darker blue at edges

export const C = {
  white:   "#ffffff",
  blue:    "#89CFF0",   // identity — ฟ้ากลาง
  blue2:   "#6BB8E8",   // body mid
  corrupt: "#5BBDE0",   // corruption — ฟ้าเข้มกว่า body นิดๆ ไม่ตัดมาก
  blush:   "#A8DCFF",   // แก้มฟ้าอ่อน (blush ผิดๆ เลียนแบบมนุษย์)
  whiteV:  "255,255,255",
  blueV:   "137,207,240",
  blue2V:  "107,184,232",
  corruptV:"91,189,224",
  blushV:  "168,220,255",
} as const

// ── Orbit Particles ───────────────────────────────────────────────────────────

export const PARTICLES = [
  { r: 62, speed: 0.0006, offset: 0,    size: 4,   opacity: 0.75 },
  { r: 68, speed: 0.0004, offset: 2.1,  size: 3,   opacity: 0.6  },
  { r: 57, speed: 0.0007, offset: 4.2,  size: 3.5, opacity: 0.65 },
  { r: 72, speed: 0.0003, offset: 1.05, size: 2.5, opacity: 0.55 },
  { r: 60, speed: 0.0005, offset: 3.3,  size: 3,   opacity: 0.5  },
  { r: 65, speed: 0.0008, offset: 5.1,  size: 2,   opacity: 0.45 },
]

// ── Edge Corruption ───────────────────────────────────────────────────────────
// blocks งอกออกจากขอบ เหมือน pixel ที่ compile ไม่ครบ

export const EDGE_SEGS: {
  side: "right" | "left" | "top" | "bottom"
  pos: number
  w: number; h: number
  color: string
  dur: number; delay: number; repeatDelay: number
}[] = [
  { side:"right",  pos:18, w:8,  h:22, color:`rgba(${C.corruptV},0.55)`, dur:1.4, delay:0, repeatDelay:2.1 },
  { side:"right",  pos:48, w:5,  h:14, color:`rgba(${C.blueV},0.45)`,   dur:1.8, delay:0, repeatDelay:3.5 },
  { side:"right",  pos:70, w:9,  h:18, color:`rgba(${C.corruptV},0.5)`,  dur:1.3, delay:0, repeatDelay:1.8 },
  { side:"left",   pos:30, w:7,  h:20, color:`rgba(${C.blueV},0.45)`,   dur:1.6, delay:0, repeatDelay:2.7 },
  { side:"left",   pos:62, w:8,  h:12, color:`rgba(${C.corruptV},0.5)`,  dur:1.5, delay:0, repeatDelay:4.0 },
  { side:"top",    pos:28, w:20, h:7,  color:`rgba(${C.blueV},0.45)`,   dur:1.7, delay:0, repeatDelay:3.2 },
  { side:"top",    pos:62, w:14, h:5,  color:`rgba(${C.corruptV},0.5)`,  dur:1.4, delay:0, repeatDelay:2.4 },
  { side:"bottom", pos:42, w:18, h:8,  color:`rgba(${C.corruptV},0.55)`, dur:1.6, delay:0, repeatDelay:1.9 },
  { side:"bottom", pos:18, w:10, h:6,  color:`rgba(${C.blueV},0.45)`,   dur:1.8, delay:0, repeatDelay:3.8 },
]
