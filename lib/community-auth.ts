import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { shouldRetainCommunitySession } from "@/lib/community-session-policy"

const DEFAULT_GUILD_ID = "1429010352175058946"
const STATE_LIFETIME_MS = 10 * 60 * 1000
const MEMBERSHIP_CACHE_MS = 5 * 60 * 1000
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60
const SESSION_COOKIE = "rnc_session"
const STATE_COOKIE = "rnc_oauth_state"

type CommunityConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
  guildId: string
  botToken: string
  signingSecret: string
  staffRoleId: string
}

type StoredSession = {
  userId: string
  discordId: string
  username: string
  avatarHash: string | null
  name: string
  accessToken: string
  roles?: string[]
  guildNickname?: string | null
  syncedDisplayName?: string
  checkedAt: number
  expiresAt: number
}

export type CommunitySession = Pick<StoredSession, "userId" | "discordId" | "username" | "avatarHash" | "name"> & {
  isStaff: boolean
}

class DiscordApiError extends Error {
  constructor(message: string, readonly status: number, readonly discordCode?: number) {
    super(message)
  }
}

function config(): CommunityConfig {
  const clientSecret = process.env.COMMUNITY_DISCORD_CLIENT_SECRET
    || process.env.DISCORD_CLIENT_SECRET
    || ""

  return {
    clientId: process.env.COMMUNITY_DISCORD_CLIENT_ID
      || process.env.DISCORD_CLIENT_ID
      || process.env.CLIENT_ID
      || "",
    clientSecret,
    redirectUri: process.env.COMMUNITY_DISCORD_REDIRECT_URI
      || process.env.DISCORD_REDIRECT_URI
      || "",
    guildId: process.env.COMMUNITY_GUILD_ID || process.env.GUILD_ID || DEFAULT_GUILD_ID,
    botToken: process.env.COMMUNITY_DISCORD_BOT_TOKEN
      || process.env.BOT_TOKEN
      || process.env.DISCORD_TOKEN
      || "",
    signingSecret: process.env.COMMUNITY_SESSION_SECRET || clientSecret,
    staffRoleId: process.env.COMMUNITY_STAFF_ROLE_ID || "",
  }
}

export function getCommunityGuildId(): string {
  return config().guildId
}

export function isCommunityConfigured(): boolean {
  const settings = config()
  return Boolean(
    settings.clientId
      && settings.clientSecret
      && settings.redirectUri
      && settings.signingSecret,
  )
}

function isSecureRequest(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  return (forwarded || new URL(request.url).protocol.replace(":", "")) === "https"
}

function cookieHeader(
  request: NextRequest,
  name: string,
  value: string,
  maxAge: number,
  cookiePath: string,
): string {
  return `${name}=${value}; Path=${cookiePath}; Max-Age=${Math.max(0, maxAge)}; HttpOnly; SameSite=Lax${isSecureRequest(request) ? "; Secure" : ""}`
}

function clearCookie(request: NextRequest, name: string, cookiePath: string): string {
  return `${cookieHeader(request, name, "", 0, cookiePath)}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

function redirect(request: NextRequest, pathname: string): NextResponse {
  const response = NextResponse.redirect(new URL(pathname, request.url), 302)
  response.headers.set("Cache-Control", "no-store")
  return response
}

function signingKey(secret: string): Buffer {
  return createHash("sha256").update("Project-LinuxOS:RNC:community:v1:").update(secret).digest()
}

function signState(value: string, secret: string): string {
  return createHmac("sha256", signingKey(secret)).update(value).digest("base64url")
}

function makeState(secret: string): string {
  const body = `${randomBytes(32).toString("base64url")}.${Date.now()}`
  return `${body}.${signState(body, secret)}`
}

function isValidState(state: string, cookieState: string, secret: string): boolean {
  if (!state || state !== cookieState) return false
  const signatureStart = state.lastIndexOf(".")
  if (signatureStart < 0) return false
  const body = state.slice(0, signatureStart)
  const signature = state.slice(signatureStart + 1)
  const issuedAt = Number(body.slice(body.lastIndexOf(".") + 1))
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > STATE_LIFETIME_MS || issuedAt > Date.now() + 60_000) {
    return false
  }
  const expected = Buffer.from(signState(body, secret))
  const received = Buffer.from(signature)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

function sealSession(session: StoredSession, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", signingKey(secret), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ])
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString("base64url")).join(".")
}

function openSession(value: string, secret: string): StoredSession | null {
  try {
    const [ivText, tagText, ciphertextText] = value.split(".")
    if (!ivText || !tagText || !ciphertextText) return null
    const decipher = createDecipheriv("aes-256-gcm", signingKey(secret), Buffer.from(ivText, "base64url"))
    decipher.setAuthTag(Buffer.from(tagText, "base64url"))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, "base64url")),
      decipher.final(),
    ]).toString("utf8")
    const session = JSON.parse(plaintext) as StoredSession
    if (
      typeof session.userId !== "string"
      || typeof session.discordId !== "string"
      || typeof session.username !== "string"
      || !(typeof session.avatarHash === "string" || session.avatarHash === null)
      || typeof session.name !== "string"
      || typeof session.accessToken !== "string"
      || (session.roles !== undefined && (!Array.isArray(session.roles) || !session.roles.every(role => typeof role === "string")))
      || (session.guildNickname !== undefined && !(typeof session.guildNickname === "string" || session.guildNickname === null))
      || (session.syncedDisplayName !== undefined && typeof session.syncedDisplayName !== "string")
      || !Number.isFinite(session.checkedAt)
      || !Number.isFinite(session.expiresAt)
    ) return null
    if (!session.roles || session.guildNickname === undefined) session.checkedAt = 0
    return session
  } catch {
    return null
  }
}

function sessionProfile(session: StoredSession): CommunitySession {
  return {
    userId: session.userId,
    discordId: session.discordId,
    username: session.username,
    avatarHash: session.avatarHash,
    name: session.guildNickname?.trim() || session.name,
    isStaff: Boolean(config().staffRoleId && session.roles?.includes(config().staffRoleId)),
  }
}

function sessionCookie(request: NextRequest, session: StoredSession, settings: CommunityConfig): string {
  const remaining = Math.floor((session.expiresAt - Date.now()) / 1000)
  const maxAge = Math.min(SESSION_MAX_AGE_SECONDS, remaining)
  return cookieHeader(request, SESSION_COOKIE, sealSession(session, settings.signingSecret), maxAge, "/")
}

// Persist the verified server name once per change so every owner's cards can
// read it locally, without Discord lookups for each character or Gallery visit.
async function sessionResult(
  request: NextRequest,
  stored: StoredSession,
  settings: CommunityConfig,
  renewCookie = false,
): Promise<{ session: CommunitySession; cookie?: string }> {
  const profile = sessionProfile(stored)
  if (stored.guildNickname !== undefined && stored.syncedDisplayName !== profile.name) {
    try {
      await prisma.communityUser.updateMany({
        where: { id: stored.userId, displayName: { not: profile.name } },
        data: { displayName: profile.name },
      })
      stored.syncedDisplayName = profile.name
      renewCookie = true
    } catch {
      // A display-name sync must not invalidate an otherwise verified login.
      console.warn("[community-auth] Display name sync failed; keeping verified session")
    }
  }
  return { session: profile, ...(renewCookie ? { cookie: sessionCookie(request, stored, settings) } : {}) }
}

async function discordJson<T extends Record<string, unknown>>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  })
  let payload: Record<string, unknown> = {}
  try {
    payload = await response.json() as Record<string, unknown>
  } catch {
    // Discord errors can occasionally have an empty body.
  }
  if (!response.ok) {
    throw new DiscordApiError(
      typeof payload.message === "string" ? payload.message : `Discord returned ${response.status}`,
      response.status,
      typeof payload.code === "number" ? payload.code : undefined,
    )
  }
  return payload as T
}

async function getGuildMember(accessToken: string, settings: CommunityConfig): Promise<{ roles: string[]; nickname: string | null } | null> {
  try {
    const member = await discordJson<{ roles?: unknown; nick?: unknown }>(
      "https://discord.com/api/v10/users/@me/guilds/" + settings.guildId + "/member",
      { headers: { Authorization: "Bearer " + accessToken } },
    )
    const nickname = typeof member.nick === "string" ? member.nick.trim() : ""
    return {
      roles: Array.isArray(member.roles)
        ? member.roles.filter((role): role is string => typeof role === "string")
        : [],
      nickname: nickname || null,
    }
  } catch (error) {
    if (error instanceof DiscordApiError && error.status === 404) return null
    throw error
  }
}

function withCookie(response: NextResponse, cookie: string): NextResponse {
  response.headers.append("Set-Cookie", cookie)
  return response
}

function failureRedirect(request: NextRequest, status: string, extra?: Record<string, string>): NextResponse {
  const query = new URLSearchParams({ status, ...extra })
  return redirect(request, `/community?${query.toString()}`)
}

export function startDiscordOAuth(request: NextRequest): NextResponse {
  const settings = config()
  if (!isCommunityConfigured()) return redirect(request, "/community?status=setup")

  const state = makeState(settings.signingSecret)
  const authorization = new URL("https://discord.com/oauth2/authorize")
  authorization.search = new URLSearchParams({
    response_type: "code",
    client_id: settings.clientId,
    redirect_uri: settings.redirectUri,
    scope: "identify guilds.members.read",
    state,
    ...(new URL(request.url).searchParams.get("consent") === "1" ? { prompt: "consent" } : {}),
  }).toString()

  const response = NextResponse.redirect(authorization, 302)
  response.headers.set("Cache-Control", "no-store")
  return withCookie(response, cookieHeader(request, STATE_COOKIE, state, 600, "/auth/discord/callback"))
}

export async function completeDiscordOAuth(request: NextRequest): Promise<NextResponse> {
  const settings = config()
  const clearState = clearCookie(request, STATE_COOKIE, "/auth/discord/callback")
  if (!isCommunityConfigured()) {
    return withCookie(redirect(request, "/community?status=setup"), clearState)
  }

  const url = new URL(request.url)
  const state = url.searchParams.get("state") || ""
  const stateCookie = request.cookies.get(STATE_COOKIE)?.value || ""
  if (!isValidState(state, stateCookie, settings.signingSecret)) {
    return withCookie(redirect(request, "/community?status=state"), clearState)
  }
  if (url.searchParams.get("error") === "access_denied") {
    return withCookie(redirect(request, "/community?status=cancelled"), clearState)
  }

  const code = url.searchParams.get("code")
  if (!code) return withCookie(redirect(request, "/community?status=oauth"), clearState)

  let phase: "token" | "identity" | "membership" | "database" = "token"
  try {
    const token = await discordJson<{
      access_token?: string
      token_type?: string
      expires_in?: number
      scope?: string
    }>("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: settings.redirectUri,
      }),
    })
    if (!token.access_token || token.token_type?.toLowerCase() !== "bearer") {
      throw new Error("Discord returned an invalid token response")
    }
    if (token.scope && !token.scope.split(/\s+/).includes("guilds.members.read")) {
      return withCookie(redirect(request, "/community?status=scope"), clearState)
    }

    phase = "identity"
    const user = await discordJson<{
      id?: string
      global_name?: string | null
      username?: string
      avatar?: string | null
    }>(
      "https://discord.com/api/v10/users/@me",
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    )
    if (!user.id) throw new Error("Discord returned an invalid user")

    phase = "membership"
    const guildMember = await getGuildMember(token.access_token, settings)
    if (guildMember === null) {
      return withCookie(redirect(request, "/community?status=not-member"), clearState)
    }

    phase = "database"
    const username = user.username?.trim() || "Discord member"
    const globalName = user.global_name?.trim() || username
    const displayName = guildMember.nickname || globalName
    const avatarHash = user.avatar || null
    const communityUser = await prisma.communityUser.upsert({
      where: { discordId: user.id },
      create: { discordId: user.id, username, displayName, avatarHash },
      update: { username, displayName, avatarHash, lastLoginAt: new Date() },
      select: { id: true, discordId: true, username: true, displayName: true, avatarHash: true },
    })

    const now = Date.now()
    const tokenLifetime = Number.isFinite(token.expires_in) && token.expires_in! > 0
      ? token.expires_in! * 1000
      : SESSION_MAX_AGE_SECONDS * 1000
    const session: StoredSession = {
      userId: communityUser.id,
      discordId: communityUser.discordId,
      username: communityUser.username,
      avatarHash: communityUser.avatarHash,
      name: globalName,
      accessToken: token.access_token,
      roles: guildMember.roles,
      guildNickname: guildMember.nickname,
      syncedDisplayName: communityUser.displayName,
      checkedAt: now,
      expiresAt: now + Math.min(SESSION_MAX_AGE_SECONDS * 1000, tokenLifetime),
    }
    const response = redirect(request, "/community/rnc")
    response.headers.append("Set-Cookie", clearState)
    return withCookie(response, sessionCookie(request, session, settings))
  } catch (error) {
    const status = phase === "token" ? "oauth"
      : phase === "database" ? "database-error"
        : phase === "membership" && error instanceof DiscordApiError && [401, 403].includes(error.status)
        ? "scope"
        : "discord-error"
    const extra: Record<string, string> = {}
    if (phase === "token" && error instanceof DiscordApiError) {
      extra.discord_status = String(error.status)
      if (error.discordCode !== undefined) extra.discord_code = String(error.discordCode)
    }
    const errorCode = error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : null
    console.error("[community-auth] Login verification failed", {
      phase,
      status: error instanceof DiscordApiError ? error.status : null,
      discordCode: error instanceof DiscordApiError ? error.discordCode || null : null,
      errorName: error instanceof Error ? error.name : null,
      errorCode,
    })
    const response = failureRedirect(request, status, extra)
    return withCookie(response, clearState)
  }
}

export async function getCommunitySession(
  request: NextRequest,
  forceMembershipCheck = false,
): Promise<{ session: CommunitySession | null; cookie?: string }> {
  const settings = config()
  if (!settings.signingSecret) return { session: null }
  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value || ""
  if (!cookieValue) return { session: null }

  const stored = openSession(cookieValue, settings.signingSecret)
  if (!stored || Date.now() >= stored.expiresAt) {
    return { session: null, cookie: clearCookie(request, SESSION_COOKIE, "/") }
  }

  if (forceMembershipCheck || Date.now() - stored.checkedAt >= MEMBERSHIP_CACHE_MS) {
    try {
      const guildMember = await getGuildMember(stored.accessToken, settings)
      if (guildMember === null) {
        return { session: null, cookie: clearCookie(request, SESSION_COOKIE, "/") }
      }
      stored.roles = guildMember.roles
      stored.guildNickname = guildMember.nickname
      stored.checkedAt = Date.now()
      return sessionResult(request, stored, settings, true)
    } catch (error) {
      const status = error instanceof DiscordApiError ? error.status : null
      if (!shouldRetainCommunitySession(status)) {
        return { session: null, cookie: clearCookie(request, SESSION_COOKIE, "/") }
      }

      // Keep the last verified roles for one cache interval when Discord is temporarily unavailable.
      stored.checkedAt = Date.now()
      console.warn("[community-auth] Membership refresh failed; using cached session", {
        status,
        errorName: error instanceof Error ? error.name : "unknown",
      })
      return sessionResult(request, stored, settings, true)
    }
  }

  return sessionResult(request, stored, settings)
}

const STAFF_COOKIE = "rnc_staff"
const STAFF_ACCESS_LIFETIME_SECONDS = 12 * 60 * 60

export function isCommunityStaffConfigured(): boolean {
  const settings = config()
  return Boolean(settings.staffRoleId && process.env.COMMUNITY_STAFF_PASSCODE && settings.signingSecret)
}

export function verifyCommunityStaffPasscode(candidate: string): boolean {
  const expected = process.env.COMMUNITY_STAFF_PASSCODE || ""
  const secret = config().signingSecret
  if (!expected || !secret || typeof candidate !== "string") return false
  const expectedDigest = createHmac("sha256", signingKey(secret)).update(expected).digest()
  const candidateDigest = createHmac("sha256", signingKey(secret)).update(candidate).digest()
  return timingSafeEqual(expectedDigest, candidateDigest)
}

export function staffUnlockCookie(request: NextRequest, session: CommunitySession): string {
  const settings = config()
  const expiresAt = Date.now() + STAFF_ACCESS_LIFETIME_SECONDS * 1000
  const payload = Buffer.from(JSON.stringify({ discordId: session.discordId, expiresAt })).toString("base64url")
  const value = payload + "." + signState("staff:" + payload, settings.signingSecret)
  return cookieHeader(request, STAFF_COOKIE, value, STAFF_ACCESS_LIFETIME_SECONDS, "/")
}

export function clearStaffUnlockCookie(request: NextRequest): string {
  return clearCookie(request, STAFF_COOKIE, "/")
}

export function logoutCommunitySession(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/community", request.url), 303)
  response.headers.set("Cache-Control", "no-store")
  response.headers.append("Set-Cookie", clearCookie(request, SESSION_COOKIE, "/"))
  response.headers.append("Set-Cookie", clearCookie(request, STATE_COOKIE, "/auth/discord/callback"))
  response.headers.append("Set-Cookie", clearStaffUnlockCookie(request))
  return response
}

export function hasStaffUnlock(request: NextRequest, session: CommunitySession): boolean {
  const settings = config()
  if (!settings.signingSecret || !session.isStaff) return false
  const value = request.cookies.get(STAFF_COOKIE)?.value || ""
  const separator = value.lastIndexOf(".")
  if (separator <= 0) return false

  const payload = value.slice(0, separator)
  const received = Buffer.from(value.slice(separator + 1))
  const expected = Buffer.from(signState("staff:" + payload, settings.signingSecret))
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false

  try {
    const ticket = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      discordId?: unknown
      expiresAt?: unknown
    }
    return ticket.discordId === session.discordId
      && typeof ticket.expiresAt === "number"
      && Number.isFinite(ticket.expiresAt)
      && ticket.expiresAt > Date.now()
      && ticket.expiresAt <= Date.now() + (STAFF_ACCESS_LIFETIME_SECONDS + 5) * 1000
  } catch {
    return false
  }
}

let previewCache: { value: { name: string; iconUrl: string | null; onlineCount: number | null }; fetchedAt: number } | null = null

export async function getCommunityServerPreview(): Promise<{
  name: string
  iconUrl: string | null
  onlineCount: number | null
}> {
  const settings = config()
  if (previewCache && Date.now() - previewCache.fetchedAt < 60_000) return previewCache.value
  if (!settings.botToken) throw new Error("Discord bot token is not configured")

  const guild = await discordJson<{
    id?: string
    name?: string
    icon?: string | null
    approximate_presence_count?: number
  }>(
    `https://discord.com/api/v10/guilds/${settings.guildId}?with_counts=true`,
    { headers: { Authorization: `Bot ${settings.botToken}` } },
  )
  if (!guild.id || !guild.name) throw new Error("Discord returned an incomplete guild")

  const extension = guild.icon?.startsWith("a_") ? "gif" : "png"
  const value = {
    name: guild.name,
    iconUrl: guild.icon
      ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${extension}?size=256`
      : null,
    onlineCount: Number.isFinite(guild.approximate_presence_count)
      ? guild.approximate_presence_count!
      : null,
  }
  previewCache = { value, fetchedAt: Date.now() }
  return value
}

export function hasCommunityBotToken(): boolean {
  return Boolean(config().botToken)
}
