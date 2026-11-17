import type { NextRequest } from "next/server"
import { communityAssetUrl } from "@/lib/community-asset-urls"
import { NextResponse } from "next/server"
import { getCommunitySession, hasStaffUnlock } from "@/lib/community-auth"
import { prisma } from "@/lib/db"
import { deleteR2Asset, isR2StorageConfigured, uploadR2Asset, type StoredR2Asset } from "@/lib/r2-storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const MAX_SIGNATURE_BYTES = 512 * 1024
type RouteContext = { params: Promise<{ id: string }> }

class EmployeeCardError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code) }
}

function imageType(data: Buffer): string | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png"
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg"
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "image/webp"
  return null
}

async function saveEmployeeCardAsset(request: NextRequest, context: RouteContext) {
  const { session } = await getCommunitySession(request)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const isUnlockedStaff = session.isStaff && hasStaffUnlock(request, session)
  let uploadedR2Asset: StoredR2Asset | null = null
  let previousR2Asset: StoredR2Asset | null = null
  let committed = false
  try {
    const { id } = await context.params
    const character = await prisma.communityCharacter.findUnique({
      where: { id }, select: { ownerId: true, employeeId: true },
    })
    if (!character) throw new EmployeeCardError("not-found", 404)
    if (character.ownerId !== session.userId && !isUnlockedStaff) throw new EmployeeCardError("forbidden", 403)
    const form = await request.formData()
    const photo = form.get("photo")
    const signature = form.get("signature")
    const isSignature = signature instanceof File
    const file = isSignature ? signature : photo
    const kind = isSignature ? "employee-signature" : "employee-card"
    const invalidFile = isSignature ? "invalid-signature" : "invalid-photo"
    if (!(file instanceof File) || (isSignature && photo instanceof File)) throw new EmployeeCardError(invalidFile, 400)
    if (!isSignature && !character.employeeId) throw new EmployeeCardError("employee-id-required", 409)
    if (file.size > (isSignature ? MAX_SIGNATURE_BYTES : MAX_PHOTO_BYTES)) {
      throw new EmployeeCardError(isSignature ? "signature-too-large" : "photo-too-large", 413)
    }
    const data = Buffer.from(await file.arrayBuffer())
    const contentType = imageType(data)
    if (!contentType || contentType !== file.type || (isSignature && contentType !== "image/png")) throw new EmployeeCardError(invalidFile, 400)

    const r2Enabled = isR2StorageConfigured()
    // Upload before taking the row lock so object storage latency cannot expire the transaction.
    if (r2Enabled) uploadedR2Asset = await uploadR2Asset(id, kind, contentType, data)
    const asset = await prisma.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT "id" FROM "CommunityCharacter" WHERE "id" = ${id} FOR UPDATE`
      const character = await transaction.communityCharacter.findUnique({
        where: { id },
        select: { id: true, ownerId: true, employeeId: true },
      })
      if (!character) throw new EmployeeCardError("not-found", 404)
      if (character.ownerId !== session.userId && !isUnlockedStaff) throw new EmployeeCardError("forbidden", 403)
      if (!isSignature && !character.employeeId) throw new EmployeeCardError("employee-id-required", 409)

      const existing = await transaction.communityCharacterAsset.findUnique({
        where: { characterId_kind: { characterId: id, kind } },
        select: { storageBucket: true, storageKey: true },
      })
      if (existing?.storageBucket && existing.storageKey) {
        previousR2Asset = { bucket: existing.storageBucket, key: existing.storageKey }
      }
      const values = {
        contentType,
        data: uploadedR2Asset ? null : new Uint8Array(data),
        storageBucket: uploadedR2Asset?.bucket || null,
        storageKey: uploadedR2Asset?.key || null,
      }
      return transaction.communityCharacterAsset.upsert({
        where: { characterId_kind: { characterId: id, kind } },
        create: { characterId: id, kind, ...values },
        update: values,
        select: { id: true },
      })
    })
    committed = true
    if (previousR2Asset) {
      try { await deleteR2Asset(previousR2Asset) }
      catch { console.error("[community/employee-card] failed to clean up replaced R2 asset") }
    }
    return NextResponse.json({ image: communityAssetUrl({id:asset.id,contentType,storageBucket:uploadedR2Asset?.bucket,storageKey:uploadedR2Asset?.key},new Date()) }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    if (uploadedR2Asset && !committed) {
      try { await deleteR2Asset(uploadedR2Asset) }
      catch { console.error("[community/employee-card] failed to clean up R2 upload after save error") }
    }
    if (error instanceof EmployeeCardError) return NextResponse.json({ error: error.code }, { status: error.status })
    console.error("[community/employee-card] upload failed", error)
    return NextResponse.json({ error: "upload-failed" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return saveEmployeeCardAsset(request, context)
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return saveEmployeeCardAsset(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { session } = await getCommunitySession(request)
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const isUnlockedStaff = session.isStaff && hasStaffUnlock(request, session)
  try {
    const { id } = await context.params
    const previous = await prisma.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT "id" FROM "CommunityCharacter" WHERE "id" = ${id} FOR UPDATE`
      const character = await transaction.communityCharacter.findUnique({ where: { id }, select: { ownerId: true } })
      if (!character) throw new EmployeeCardError("not-found", 404)
      if (character.ownerId !== session.userId && !isUnlockedStaff) throw new EmployeeCardError("forbidden", 403)
      const signature = await transaction.communityCharacterAsset.findUnique({
        where: { characterId_kind: { characterId: id, kind: "employee-signature" } },
        select: { storageBucket: true, storageKey: true },
      })
      await transaction.communityCharacterAsset.deleteMany({ where: { characterId: id, kind: "employee-signature" } })
      return signature
    })
    if (previous?.storageBucket && previous.storageKey) {
      try { await deleteR2Asset({ bucket: previous.storageBucket, key: previous.storageKey }) }
      catch { console.error("[community/employee-card] failed to clean up removed signature object") }
    }
    return NextResponse.json({ removed: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof EmployeeCardError) return NextResponse.json({ error: error.code }, { status: error.status })
    console.error("[community/employee-card] signature removal failed", error)
    return NextResponse.json({ error: "delete-failed" }, { status: 500 })
  }
}
