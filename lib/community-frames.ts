// Ordinary characters use their element's colours across 4/5/6-star artwork.
// Only Magus and President have dedicated seven-star frame treatments.
const frameRoot = "/assets/RNCelement/"
export const COMMUNITY_FRAMES = [
  { key: "star7-magus", label: "Magus", caption: "7 Star · Magus", asset: frameRoot + "7%20Star%20Magus.png", tint: false, defaultBorder: "#d1373f", defaultGlow: "#f43843" },
  { key: "star7-president", label: "President", caption: "7 Star · President", asset: frameRoot + "7%20Star%20%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%98%E0%B8%B2%E0%B8%99.png", tint: false, defaultBorder: "#ff4b62", defaultGlow: "#ff4b62", glowMode: "rainbow" },
  { key: "arcana-natural", label: "Natural", caption: "Human / Neutral", asset: frameRoot + "4%20Star.png", tint: true, defaultBorder: "#8a8187", defaultGlow: "#8a8187" },
  { key: "arcana-beast", label: "Beast", caption: "ธาตุสัตว์", asset: frameRoot + "6%20Star.png", tint: true, defaultBorder: "#ae2b33", defaultGlow: "#ae2b33" },
  { key: "arcana-plant", label: "Plant", caption: "ธาตุพฤกษา", asset: frameRoot + "6%20Star.png", tint: true, defaultBorder: "#23703c", defaultGlow: "#23703c" },
  { key: "arcana-star", label: "Star", caption: "ธาตุดาว", asset: frameRoot + "6%20Star.png", tint: true, defaultBorder: "#3b6fa5", defaultGlow: "#3b6fa5" },
  { key: "arcana-mineral", label: "Mineral", caption: "ธาตุแร่", asset: frameRoot + "6%20Star.png", tint: true, defaultBorder: "#815e32", defaultGlow: "#815e32" },
  { key: "arcana-spirit", label: "Spirit", caption: "ธาตุจิตวิญญาณ", asset: frameRoot + "6%20Star.png", tint: true, defaultBorder: "#783981", defaultGlow: "#783981" },
  { key: "arcana-intellect", label: "Intellect", caption: "ธาตุปัญญา", asset: frameRoot + "6%20Star.png", tint: true, defaultBorder: "#897a30", defaultGlow: "#897a30" },
] as const

export function characterFrameKey(type: string, race: string, arcana: string) {
  if (type === "President") return "star7-president"
  if (type === "Magus") return "star7-magus"
  const key = "arcana-" + (race === "Human" ? "natural" : arcana.toLowerCase())
  return COMMUNITY_FRAMES.some(frame => frame.key === key) ? key : "arcana-natural"
}

export function characterFrameAsset(type: string, rank: number | null) {
  if (type === "President" || type === "Magus") return COMMUNITY_FRAMES[type === "Magus" ? 0 : 1].asset
  return [4, 5, 6].includes(rank ?? 0) ? frameRoot + rank + "%20Star.png" : ""
}

export function frameStylesWithDefaults(saved: { key: string; borderColor: string; glowColor: string; updatedAt: Date }[]) {
  return COMMUNITY_FRAMES.map(frame => {
    const value = saved.find(item => item.key === frame.key)
    return { ...frame, borderColor: value?.borderColor || frame.defaultBorder, glowColor: value?.glowColor || frame.defaultGlow, updatedAt: value?.updatedAt || null }
  })
}
