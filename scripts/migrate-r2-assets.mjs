#!/usr/bin/env node
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import pg from "pg"
import ts from "typescript"

const { Pool } = pg
const help = `Migrate legacy character image bytes to Cloudflare R2.

Usage:
  node scripts/migrate-r2-assets.mjs             # read-only inventory (default)
  node scripts/migrate-r2-assets.mjs --apply    # upload, verify, then update a local database
  node scripts/migrate-r2-assets.mjs --apply --confirm-remote  # explicitly allow a remote database

The script loads web/.env explicitly (not .env.local). --apply uploads images and clears
BYTEA only after reading the R2 object back and verifying its SHA-256 digest. It never deletes
R2 objects. Re-running after interruption is safe because each asset uses a deterministic key.
`
const args = new Set(process.argv.slice(2))
if (args.has("--help") || args.has("-h")) {
  process.stdout.write(help)
  process.exit(0)
}
const apply = args.has("--apply")
const confirmRemote = args.has("--confirm-remote")
for (const arg of args) {
  if (arg !== "--apply" && arg !== "--confirm-remote") throw new Error(`Unknown option: ${arg}\nUse --help for usage.`)
}

if (confirmRemote && !apply) throw new Error("--confirm-remote requires --apply.")
const webDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(webDirectory, ".env"), override: false })
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing from the process environment and web/.env.")

const sourcePath = new URL("../lib/r2-storage.ts", import.meta.url)
const r2Source = await readFile(sourcePath, "utf8")
const compiled = ts.transpileModule(r2Source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
})
const errors = (compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error)
if (errors.length) throw new Error("Could not load the R2 storage helper: " + errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, " ")).join("; "))
const r2 = await import("data:text/javascript;base64," + Buffer.from(compiled.outputText).toString("base64"))
if (apply && !r2.isR2StorageConfigured()) throw new Error("R2 configuration is incomplete; no migration was started.")
const databaseHost = new URL(process.env.DATABASE_URL).hostname
const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(databaseHost.toLowerCase())
if (apply && !isLocalDatabase && !confirmRemote) {
  throw new Error(`DATABASE_URL points to remote host ${databaseHost}; pass --confirm-remote only after verifying the destination.`)
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

function hash(data) {
  return createHash("sha256").update(data).digest("hex")
}

function deterministicUuid(assetId) {
  const hex = createHash("sha256").update("rnc-legacy-asset:" + assetId).digest("hex").slice(0, 32).split("")
  hex[12] = "4"
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16)
  const value = hex.join("")
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

function expectedBucket(kind) {
  return ["employee-card", "employee-signature"].includes(kind)
    ? (process.env.R2_PRIVATE_BUCKET?.trim() || "rnc-private")
    : (process.env.R2_PUBLIC_BUCKET?.trim() || "rnc-public")
}

try {
  const columns = await pool.query(
    'SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = ANY($2::text[])',
    ["CommunityCharacterAsset", ["data", "storageBucket", "storageKey"]],
  )
  const columnMetadata = new Map(columns.rows.map(row => [row.column_name, row.is_nullable]))
  if (!columnMetadata.has("data") || columnMetadata.get("data") !== "YES" || !columnMetadata.has("storageBucket") || !columnMetadata.has("storageKey")) {
    throw new Error("Database schema is missing R2 asset columns or nullable data; apply Prisma migrations before moving images.")
  }
  const inventory = await pool.query(`
    SELECT "kind", "contentType", COUNT(*)::int AS count,
           COALESCE(SUM(octet_length("data")), 0)::bigint AS bytes
    FROM "CommunityCharacterAsset"
    WHERE "data" IS NOT NULL
    GROUP BY "kind", "contentType"
    ORDER BY "kind", "contentType"
  `)
  const total = inventory.rows.reduce((sum, row) => sum + row.count, 0)
  const totalBytes = inventory.rows.reduce((sum, row) => sum + Number(row.bytes), 0)
  process.stdout.write(`Database host: ${databaseHost}\n`)
  process.stdout.write(`Mode: ${apply ? "APPLY (uploads to R2 and updates database)" : "DRY RUN (read-only)"}\n`)
  process.stdout.write(`Legacy images with database bytes: ${total}; total size: ${totalBytes} bytes\n`)
  for (const row of inventory.rows) {
    process.stdout.write(`  ${row.kind} | ${row.contentType} | ${row.count} file(s) | ${row.bytes} bytes\n`)
  }
  if (!apply) {
    process.stdout.write("No data was changed. Re-run with --apply only when ready to migrate this database.\n")
    process.exitCode = 0
  } else if (total === 0) {
    process.stdout.write("Nothing to migrate.\n")
  } else {
    const assets = await pool.query(`
      SELECT "id" FROM "CommunityCharacterAsset"
      WHERE "data" IS NOT NULL
      ORDER BY "id"
    `)
    let migrated = 0
    let failures = 0
    for (const { id } of assets.rows) {
      const result = await pool.query(`
        SELECT "id", "characterId", "kind", "contentType", "data", "storageBucket", "storageKey"
        FROM "CommunityCharacterAsset" WHERE "id" = $1
      `, [id])
      const asset = result.rows[0]
      if (!asset?.data) continue
      const bytes = Buffer.from(asset.data)
      if (bytes.byteLength === 0) {
        process.stderr.write(`SKIP ${id}: empty image data\n`)
        failures++
        continue
      }
      const contentType = asset.contentType
      if (!/^image\/(png|jpeg|webp)$/.test(contentType)) {
        process.stderr.write(`SKIP ${id}: unsupported content type ${contentType}\n`)
        failures++
        continue
      }
      if (!asset.kind || !/^[A-Za-z0-9_-]{1,100}$/.test(asset.characterId)) {
        process.stderr.write(`SKIP ${id}: invalid character or asset kind\n`)
        failures++
        continue
      }
      const wantedBucket = expectedBucket(asset.kind)
      let stored = null
      try {
        if (asset.storageBucket || asset.storageKey) {
          if (asset.storageBucket !== wantedBucket || !asset.storageKey) {
            throw new Error("existing R2 pointer does not match the expected bucket")
          }
          stored = { bucket: asset.storageBucket, key: asset.storageKey }
          const existingBytes = await r2.readR2Asset(stored.bucket, stored.key)
          if (!existingBytes || hash(existingBytes) !== hash(bytes)) {
            throw new Error("existing R2 object is missing or does not match the database image")
          }
        } else {
          stored = await r2.uploadR2Asset(
            asset.characterId,
            asset.kind,
            contentType,
            bytes,
            deterministicUuid(asset.id),
          )
          const uploadedBytes = await r2.readR2Asset(stored.bucket, stored.key)
          if (!uploadedBytes || hash(uploadedBytes) !== hash(bytes)) {
            throw new Error("R2 read-back verification failed")
          }
        }
        const updated = await pool.query(`
          UPDATE "CommunityCharacterAsset"
          SET "data" = NULL, "storageBucket" = $2, "storageKey" = $3
          WHERE "id" = $1 AND "data" = $4
            AND ("storageBucket" IS NULL OR "storageBucket" = $2)
            AND ("storageKey" IS NULL OR "storageKey" = $3)
        `, [asset.id, stored.bucket, stored.key, bytes])
        if (updated.rowCount !== 1) {
          const latest = await pool.query(`
            SELECT "data", "storageBucket", "storageKey"
            FROM "CommunityCharacterAsset" WHERE "id" = $1
          `, [asset.id])
          const current = latest.rows[0]
          if (current?.storageBucket === stored.bucket && current?.storageKey === stored.key && !current?.data) {
            migrated++
            process.stdout.write(`OK ${asset.id} (${asset.kind})\n`)
            continue
          }
          throw new Error("database row changed during migration; original bytes were retained")
        }
        migrated++
        process.stdout.write(`OK ${asset.id} (${asset.kind})\n`)
      } catch (error) {
        failures++
        process.stderr.write(`FAIL ${asset.id} (${asset.kind}): ${error instanceof Error ? error.message : "unknown error"}\n`)
      }
    }
    process.stdout.write(`Finished: ${migrated} migrated, ${failures} failed. Failed database images were retained.\n`)
    if (failures) process.exitCode = 1
  }
} finally {
  await pool.end()
}
