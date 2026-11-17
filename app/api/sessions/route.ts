import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const sessions = await prisma.session.findMany({
      include: { players: true },
      orderBy: { updatedAt: "desc" },
    })
    return NextResponse.json(sessions)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "db error" }, { status: 500 })
  }
}
