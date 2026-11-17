import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getCommunitySession, hasStaffUnlock } from "@/lib/community-auth"
import { getCommunityContent } from "@/lib/community-management"
import { listCommunityGallery } from "@/lib/community-gallery"
import { prisma } from "@/lib/db"
import { listCharacterThemeSongs } from "@/lib/community-collection"
import {
  findCommunityCharacter,
  listCommunityCharacters,
} from "@/lib/community-characters"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PROTECTED_PAGES: Record<string, string> = {
  "/community/rnc": "profiles.html",
  "/community/rnc/": "profiles.html",
  "/community/rnc/profiles": "profiles.html",
  "/community/rnc/height": "height.html",
  "/community/rnc/relationships": "relationships.html",
  "/community/rnc/music": "music.html",
  "/community/rnc/music/": "music.html",
  "/community/rnc/arcade": "arcade.html",
  "/community/rnc/arcade/": "arcade.html",
  "/community/rnc/arcade/labuu": "labuu.html",
  "/community/rnc/arcade/labuu/": "labuu.html",
  "/community/rnc/arcade/labuu.html": "labuu.html",
  "/community/rnc/arcade/labuu-run": "labuu-run.html",
  "/community/rnc/arcade/labuu-run/": "labuu-run.html",
  "/community/rnc/profiles-mockup": "profiles.html",
  "/community/rnc/profiles.html": "profiles.html",
  "/community/rnc/character": "character.html",
  "/community/rnc/character.html": "character.html",
  "/community/rnc/create": "editor.html",
  "/community/rnc/editor": "editor.html",
  "/community/rnc/editor.html": "editor.html",
  "/community/rnc/community": "community.html",
  "/community/rnc/community.html": "community.html",
  "/community/staff": "staff.html",
  "/community/staff/": "staff.html",
  "/community/staff/height": "height.html",
}

function attachCookie(response: NextResponse, cookie?: string): NextResponse {
  if (cookie) response.headers.append("Set-Cookie", cookie)
  return response
}

function redirect(request: NextRequest, path: string, cookie?: string): NextResponse {
  const source = new URL(request.url)
  const target = new URL(path, request.url)
  const embedded = source.searchParams.get("rnc_inner") === "1" || request.headers.get("sec-fetch-dest") === "iframe"
  if (embedded && target.pathname.startsWith("/community")) target.searchParams.set("rnc_inner", "1")
  const response = NextResponse.redirect(target, 302)
  response.headers.set("Cache-Control", "no-store")
  return attachCookie(response, cookie)
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => ({
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029",
  })[character] || character)
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const pathname = url.pathname
  if (pathname === "/community/rnc/labuu" || pathname === "/community/rnc/labuu/" || pathname === "/community/rnc/labuu.html") {
    return redirect(request, "/community/rnc/arcade/labuu" + url.search)
  }
  const isLanding = pathname === "/community" || pathname === "/community/" || pathname === "/community/connect.html"
  const filename = isLanding ? "connect.html" : PROTECTED_PAGES[pathname]
  if (!filename) return new Response("Not Found", { status: 404 })

  const result = await getCommunitySession(request)
  const staffMode = Boolean(result.session?.isStaff && hasStaffUnlock(request, result.session))
  const staffHeight = pathname === "/community/staff/height"
  const staffEditor = filename === "editor.html" && url.searchParams.get("staff") === "1"
  if (staffEditor && !staffMode) return redirect(request, "/community/rnc", result.cookie)
  if (staffHeight && !staffMode) return redirect(request, "/community/rnc", result.cookie)
  if (isLanding && result.session) return redirect(request, "/community/rnc", result.cookie)
  if (!isLanding && !result.session) return redirect(request, "/community", result.cookie)
  if (filename === "staff.html" && (!result.session?.isStaff || !hasStaffUnlock(request, result.session))) {
    return redirect(request, result.session ? "/community/rnc" : "/community", result.cookie)
  }

  const embedded = url.searchParams.get("rnc_inner") === "1" || request.headers.get("sec-fetch-dest") === "iframe"
  if (!isLanding && !embedded) {
    const shell = await readFile(join(process.cwd(), "community-pages", "app-shell.html"), "utf8")
    const innerUrl = new URL(url)
    innerUrl.searchParams.set("rnc_inner", "1")
    const initialUrl = innerUrl.pathname + innerUrl.search
    const html = shell.replace("__RNC_BOOT_URL_JSON__", safeJson(initialUrl))
    const response = new NextResponse(html, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    })
    return attachCookie(response, result.cookie)
  }

  let bootstrap: {
    currentUser: { id: string; name: string; isStaff: boolean } | null
    characters: unknown[]
    content: Awaited<ReturnType<typeof getCommunityContent>> | null
    staffMode: boolean
    editorData?: unknown
    music?: unknown[]
  } = {
    currentUser: result.session ? { id: result.session.userId, name: result.session.name, isStaff: result.session.isStaff } : null,
    characters: [],
    content: null,
    staffMode: staffEditor || staffHeight,
  }

  if (result.session && filename !== "connect.html") {
    try {
      const id = url.searchParams.get("id")
      const storedCharacter = (filename === "character.html" || filename === "editor.html") && id && !id.startsWith("oc-")
      const charactersTask = filename === "profiles.html"
        ? listCommunityGallery(result.session.userId)
        : filename === "height.html"
          ? listCommunityCharacters(result.session.userId, staffHeight)
        : storedCharacter
          ? findCommunityCharacter(id, result.session.userId, filename === "editor.html" ? staffEditor : staffMode)
            .then(character => character ? [character] : [])
          : Promise.resolve([])
      const editorTask = staffEditor
        ? Promise.all([
          prisma.communityRole.findMany({ orderBy: { sortOrder: "asc" } }),
          prisma.communityUser.findMany({ select: { id: true, displayName: true, username: true }, orderBy: { displayName: "asc" } }),
        ]).then(([roles, users]) => ({ roles, users }))
        : Promise.resolve(undefined)
      const musicTask = filename === "music.html" ? listCharacterThemeSongs(result.session.userId) : Promise.resolve(undefined)
      const [content, characters, editorData, music] = await Promise.all([getCommunityContent(), charactersTask, editorTask, musicTask])
      if (filename === "editor.html" && storedCharacter) {
        const character = characters[0]
        if (!character || (!staffEditor && character.ownerId !== result.session.userId)) {
          return new Response("Character not found", { status: 404 })
        }
      }
      bootstrap.content = content
      bootstrap.characters = characters
      if (editorData) bootstrap.editorData = editorData
      if (music) bootstrap.music = music
    } catch (error) {
      console.error("[community/page] character data load failed", error)
      return new Response("Character data is temporarily unavailable.", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      })
    }
  }

  let html = await readFile(join(process.cwd(), "community-pages", filename), "utf8")
  // Track the content document once. The outer shell only hosts the iframe.
  if (process.env.NODE_ENV === "production") {
    html = html.replace("</head>", '<script defer src="/_vercel/insights/script.js"></script>\n</head>')
  }
  if (staffMode && (filename === "staff.html" || staffEditor || staffHeight)) html = html.replace("<body>", '<body data-staff-mode="true">')
  html = html.replace("<head>", '<head>\n<link rel="stylesheet" href="/community/rnc/save-progress.css?v=collection-20261105-v1">\n<script src="/community/rnc/save-progress.js?v=collection-20261105-v1" defer></script>\n<script src="/community/rnc/frame-art.js" defer></script>')
  html = html.replace("</head>", '<link rel="stylesheet" href="/community/rnc/staff-entry.css">' + "\n</head>")
  html = html.replace("</head>", '<link rel="stylesheet" href="/community/rnc/community-content.css">' + "\n</head>")
  if (filename !== "labuu-run.html") html = html.replace("</head>", '<link rel="stylesheet" href="/community/rnc/site-cursor.css?v=site-cursor-recovery-20261116-v6">' + "\n</head>")
  html = html.replace("</head>", '<link rel="stylesheet" href="/community/rnc/community-brand.css?v=wordmark-20261107-v1">' + "\n</head>")
  html = html.replace("</body>", '<script src="/community/rnc/community-brand.js?v=wordmark-20261107-v1" defer></script>' + "\n</body>")
  html = html.replace("</body>", '<script src="/community/rnc/staff-entry.js?v=staff-error-detail-20261026" defer></script>' + "\n</body>")
  html = html.replace("</body>", '<script src="/community/rnc/community-content.js" defer></script>' + "\n</body>")
  if (filename !== "labuu-run.html") html = html.replace("</body>", '<script src="/community/rnc/site-cursor.js?v=site-cursor-recovery-20261116-v6" defer></script>' + "\n</body>")
  html = html.replace("</body>", '<script src="/community/rnc/frame-navigation.js?v=music-nav-20261107-v1" defer></script>' + "\n</body>")
  if (filename !== "connect.html") {
    const initialData = "<script>window.__RNC_BOOTSTRAP__ = " + safeJson(bootstrap) + ";</script>"
    html = html.replace("<head>", "<head>\n" + initialData)
  }
  const response = new NextResponse(html, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  })
  return attachCookie(response, result.cookie)
}
