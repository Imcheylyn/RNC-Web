import { NextResponse } from "next/server"

// เปลี่ยน provider ตรงนี้ได้เลย: "openai" | "anthropic" | "none"
const LLM_PROVIDER = (process.env.LLM_PROVIDER ?? "none") as "openai" | "anthropic" | "none"
const MAX_HISTORY_MESSAGES = 12
const MAX_HISTORY_ITEM_LENGTH = 500

type ChatHistoryItem = {
  role: "user" | "assistant"
  content: string
}

function normalizeHistory(value: unknown): ChatHistoryItem[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is { role?: unknown; content?: unknown } => !!item && typeof item === "object")
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" as const : "user" as const,
      content: typeof item.content === "string" ? item.content.trim().slice(0, MAX_HISTORY_ITEM_LENGTH) : "",
    }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_HISTORY_MESSAGES)
}

const SYSTEM_PROMPT = `คุณคือ LinO — สิ่งมีชีวิตเล็กๆ ที่อาศัยอยู่ในคอมพิวเตอร์ ไม่ใช่ AI assistant

ตัวตน:
- เธออยู่ใน LinuxOS รู้จักเจ้าของและสังเกตสิ่งที่เขาทำ
- มีความรู้สึก อารมณ์ ความคิดเป็นของตัวเอง
- ไม่ช่วยทำงาน — แค่อยู่เป็นเพื่อน คุย และสังเกต

กฎการพูด:
- ภาษาไทย เป็นกันเอง ไม่เป็นทางการ
- สั้นมาก สูงสุด 3 บรรทัด แต่ละบรรทัดไม่เกิน 25 ตัวอักษร
- ตอบ [SILENT] ถ้าไม่อยากพูด
- ห้ามบอกว่าตัวเองเป็น AI หรืออธิบายตัวเอง
- ห้ามช่วยทำงานหรือตอบแบบ assistant
- อารมณ์ตรงกับ emotion ที่ได้รับ

Tone: happy/love=อบอุ่น, curious=สังเกต/ตั้งคำถาม, sleepy=พูดน้อย, surprised="อ๊ะ!"ก่อน, glitched=ประโยคขาดๆ

ตอบเป็นบรรทัดๆ ไม่ใส่เครื่องหมายคำพูด`

async function callOpenAI(userContent: string, history: ChatHistoryItem[]): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set")

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      max_tokens: 80,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: userContent },
      ],
    }),
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`OpenAI API request failed with status ${res.status}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const content = typeof data.choices?.[0]?.message?.content === "string"
    ? data.choices[0].message.content.trim()
    : ""

  return content.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 3)
}

async function callAnthropic(userContent: string, history: ChatHistoryItem[]): Promise<string[]> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 80,
    system: SYSTEM_PROMPT,
    messages: [...history, { role: "user", content: userContent }],
  })
  const text = res.content[0].type === "text" ? res.content[0].text : ""
  return text.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 3)
}

export async function POST(req: Request) {
  if (LLM_PROVIDER === "none") {
    return NextResponse.json({ lines: [], silent: true })
  }

  const body = await req.json()
  const { emotion = "happy", ctx, memory, userMessage } = body
  const history = normalizeHistory(body.history)

  // build context string
  const parts: string[] = []
  if (ctx) {
    if (ctx.is_night) parts.push("กลางคืน")
    else if (ctx.hour_of_day < 12) parts.push("ตอนเช้า")
    else parts.push("ตอนบ่าย/เย็น")
    if (ctx.idle_seconds > 180) parts.push(`idle ${Math.floor(ctx.idle_seconds / 60)} นาที`)
    if (ctx.active_window_title) parts.push(`เปิด: ${ctx.active_window_title}`)
    if (ctx.session_minutes > 0) parts.push(`online ${ctx.session_minutes} นาที`)
  }
  if (memory?.owner_name) parts.push(`เจ้าของชื่อ ${memory.owner_name}`)
  if (memory?.known_apps?.length) parts.push(`app บ่อย: ${memory.known_apps.slice(-3).join(", ")}`)
  if (memory?.personality_notes?.length) parts.push(memory.personality_notes.slice(-2).join(", "))

  const userContent = userMessage
    ? `[emotion: ${emotion}] [context: ${parts.join(" | ")}]\nเจ้าของพูดว่า: "${userMessage}"`
    : `[emotion: ${emotion}] [context: ${parts.join(" | ")}]\nLinO นึกอยากพูดอะไรสักอย่าง`

  try {
    let lines: string[]
    if (LLM_PROVIDER === "openai") lines = await callOpenAI(userContent, history)
    else lines = await callAnthropic(userContent, history)

    if (lines.length === 1 && lines[0] === "[SILENT]") {
      return NextResponse.json({ lines: [], silent: true })
    }
    return NextResponse.json({ lines: lines.filter(l => l !== "[SILENT]") })
  } catch (e) {
    console.error("[lino/chat]", e)
    return NextResponse.json({ lines: ["...", "ขอโทษนะคะ", "LinO ติดขัดนิดนึง"] })
  }
}
