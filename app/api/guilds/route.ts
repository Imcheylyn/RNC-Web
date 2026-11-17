import { NextResponse } from "next/server"

export async function GET() {
  const token = process.env.DISCORD_TOKEN
  if (!token) return NextResponse.json({ error: "no token" }, { status: 500 })

  try {
    const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bot ${token}` },
      next: { revalidate: 60 }, // cache 60s
    })
    const guilds = await res.json()
    return NextResponse.json(guilds)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "discord api error" }, { status: 500 })
  }
}
