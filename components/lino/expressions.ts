import type { LinoEmotion } from "./types"

// ── Eye & Mouth shapes — แค่ 4+1 แบบ ─────────────────────────────────────────
export type EyeShape   = "smile" | "neutral" | "sleepy" | "surprised" | "pixel"
export type MouthShape = "smile" | "neutral" | "sleepy" | "surprised" | "pixel"

// ── Particle modes ────────────────────────────────────────────────────────────
export type ParticleMode = "none" | "normal" | "excited" | "sparkle"

// ── Glow levels ───────────────────────────────────────────────────────────────
export type GlowLevel = "low" | "normal" | "high"

// ── Behavior object — สิ่งที่ Body/Face/Effects รับไปใช้ ─────────────────────
export type LinoExpression = {
  eyeShape:     EyeShape
  mouthShape:   MouthShape
  headTilt:     number       // องศา หัวเอียง  (-15 ถึง +15)
  bodyLean:     number       // px เข้าหา cursor (บวก = เข้า ลบ = ถอย)
  glowLevel:    GlowLevel
  blush:        number       // 0 = ไม่มี, 1 = เต็ม
  particleMode: ParticleMode
  lookStrength: number       // multiplier ของ lookX/Y (1 = ปกติ)
  smileDepth:   number       // 0-1 ความโค้งของ smile (1 = โค้งสุด)
}

// ── Resolver ──────────────────────────────────────────────────────────────────

export function resolveExpression(emotion: LinoEmotion): LinoExpression {
  switch (emotion) {
    case "happy": return {
      eyeShape:     "smile",
      mouthShape:   "smile",
      headTilt:     0,
      bodyLean:     0,
      glowLevel:    "normal",
      blush:        0,
      particleMode: "normal",
      lookStrength: 1,
      smileDepth:   0.6,
    }
    case "excited": return {
      eyeShape:     "smile",
      mouthShape:   "smile",
      headTilt:     0,
      bodyLean:     4,
      glowLevel:    "high",
      blush:        0,
      particleMode: "excited",
      lookStrength: 1,
      smileDepth:   1,        // โค้งมากสุด
    }
    case "surprised": return {
      eyeShape:     "surprised",
      mouthShape:   "surprised",
      headTilt:     0,
      bodyLean:     0,
      glowLevel:    "high",
      blush:        0,
      particleMode: "normal",
      lookStrength: 1,
      smileDepth:   0,
    }
    case "sleepy": return {
      eyeShape:     "sleepy",
      mouthShape:   "sleepy",
      headTilt:     4,
      bodyLean:     0,
      glowLevel:    "low",
      blush:        0,
      particleMode: "none",
      lookStrength: 0.3,
      smileDepth:   0,
    }
    case "curious": return {
      eyeShape:     "neutral",
      mouthShape:   "neutral",
      headTilt:     8,
      bodyLean:     6,
      glowLevel:    "normal",
      blush:        0,
      particleMode: "normal",
      lookStrength: 1.6,      // ตาตาม cursor แรงขึ้น
      smileDepth:   0,
    }
    case "embarrassed": return {
      eyeShape:     "smile",
      mouthShape:   "neutral",
      headTilt:     -4,
      bodyLean:     -4,       // ถอยเล็กน้อย
      glowLevel:    "low",
      blush:        0.75,
      particleMode: "none",
      lookStrength: 0.4,      // ตาไม่ค่อยสบตา
      smileDepth:   0.3,      // ยิ้มน้อย
    }
    case "love": return {
      eyeShape:     "smile",
      mouthShape:   "smile",
      headTilt:     0,
      bodyLean:     0,
      glowLevel:    "high",
      blush:        0.5,
      particleMode: "sparkle",
      lookStrength: 1,
      smileDepth:   0.8,
    }
    case "glitched": return {
      eyeShape:     "pixel",
      mouthShape:   "pixel",
      headTilt:     0,
      bodyLean:     0,
      glowLevel:    "low",
      blush:        0,
      particleMode: "none",
      lookStrength: 0,
      smileDepth:   0,
    }
    case "neutral":
    default: return {
      eyeShape:     "neutral",
      mouthShape:   "neutral",
      headTilt:     0,
      bodyLean:     0,
      glowLevel:    "low",
      blush:        0,
      particleMode: "none",
      lookStrength: 1,
      smileDepth:   0,
    }
  }
}
