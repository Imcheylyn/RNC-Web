import type { NextRequest } from "next/server"
import { staffRequest, readCommunityBody } from "@/lib/community-staff"
import { staffDashboard, manageCommunity } from "@/lib/community-management"
export const maxDuration = 60
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET(request: NextRequest) { return staffRequest(request, async () => staffDashboard()) }
export async function POST(request: NextRequest) { return staffRequest(request, async actor => manageCommunity(actor, await readCommunityBody(request))) }
