import { createHash, createHmac, randomUUID } from "node:crypto"

type R2Config = {
  accessKeyId: string
  secretAccessKey: string
  endpoint: URL
  publicBucket: string
  privateBucket: string
}

export type StoredR2Asset = { bucket: string; key: string }

export function readR2Config() { return readConfig() }

function readConfig(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() || ""
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || ""
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || ""
  if (!accountId && !accessKeyId && !secretAccessKey) return null
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Cloudflare R2 configuration is incomplete.")
  }
  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    throw new Error("R2_ACCOUNT_ID must be a 32-character Cloudflare account ID.")
  }

  const publicBucket = process.env.R2_PUBLIC_BUCKET?.trim() || "rnc-public"
  const privateBucket = process.env.R2_PRIVATE_BUCKET?.trim() || "rnc-private"
  if (![publicBucket, privateBucket].every(bucket => /^[a-z0-9-]{3,63}$/.test(bucket))) {
    throw new Error("R2 bucket names are invalid.")
  }

  return {
    accessKeyId,
    secretAccessKey,
    endpoint: new URL("https://" + accountId + ".r2.cloudflarestorage.com"),
    publicBucket,
    privateBucket,
  }
}

export function isR2StorageConfigured(): boolean {
  return readConfig() !== null
}

function selectedBucket(config: R2Config, bucket: string): string {
  if (bucket !== config.publicBucket && bucket !== config.privateBucket) {
    throw new Error("R2 object bucket is not configured for this application.")
  }
  return bucket
}

function validateObjectKey(key: string): void {
  const parts = key.split("/")
  const supportedKind = ["portrait", "gallery", "skill-0", "skill-1", "skill-2", "skill-3", "employee-card", "employee-signature"].includes(parts[1])
    || /^weapon-[A-Za-z0-9_-]{1,40}$/.test(parts[1] || "")
    || /^wardrobe-(?:default|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})-(?:portrait|chibi|medium)$/i.test(parts[1] || "")
  if (
    parts.length !== 3 ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(parts[0]) ||
    !supportedKind ||
    !/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(parts[2])
  ) {
    throw new Error("R2 object key is invalid.")
  }
}

function encodedSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, char =>
    "%" + char.charCodeAt(0).toString(16).toUpperCase(),
  )
}

function hmac(key: string | Uint8Array, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest()
}

async function requestObject(
  method: "PUT" | "GET" | "DELETE",
  bucket: string,
  key: string,
  body?: Uint8Array,
  contentType?: string,
): Promise<Response | null> {
  const config = readConfig()
  if (!config) throw new Error("Cloudflare R2 is not configured.")
  const safeBucket = selectedBucket(config, bucket)
  validateObjectKey(key)

  const canonicalUri = "/" + [safeBucket, ...key.split("/")].map(encodedSegment).join("/")
  const url = new URL(config.endpoint.origin + canonicalUri)
  const payload = method === "PUT" ? body || new Uint8Array() : new Uint8Array()
  const payloadHash = createHash("sha256").update(payload).digest("hex")
  const date = new Date()
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "")
  const dateStamp = amzDate.slice(0, 8)
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  }
  if (contentType) headers["content-type"] = contentType
  const signedHeaders = Object.keys(headers).sort().join(";")
  const canonicalHeaders = Object.keys(headers).sort()
    .map(name => name + ":" + headers[name].trim().replace(/\s+/g, " ") + "\n")
    .join("")
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")
  const scope = dateStamp + "/auto/s3/aws4_request"
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
  ].join("\n")
  const dateKey = hmac("AWS4" + config.secretAccessKey, dateStamp)
  const regionKey = hmac(dateKey, "auto")
  const serviceKey = hmac(regionKey, "s3")
  const signingKey = hmac(serviceKey, "aws4_request")
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex")
  const authorization = "AWS4-HMAC-SHA256 Credential=" + config.accessKeyId + "/" + scope +
    ", SignedHeaders=" + signedHeaders + ", Signature=" + signature
  const requestHeaders = new Headers({
    Authorization: authorization,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  })
  if (contentType) requestHeaders.set("content-type", contentType)

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: method === "PUT" ? new Blob([Uint8Array.from(payload).buffer]) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  })
  if (method === "GET" && response.status === 404) return null
  if (method === "DELETE" && response.status === 404) return response
  if (!response.ok) throw new Error("Cloudflare R2 request failed with status " + response.status + ".")
  return response
}

function extensionFor(contentType: string): string {
  if (contentType === "image/png") return "png"
  if (contentType === "image/jpeg") return "jpg"
  if (contentType === "image/webp") return "webp"
  throw new Error("Unsupported R2 image content type.")
}

export async function uploadR2Asset(
  characterId: string,
  kind: string,
  contentType: string,
  data: Uint8Array,
  objectId: string = randomUUID(),
): Promise<StoredR2Asset> {
  if (!/^[a-f0-9-]{36}$/i.test(objectId)) throw new Error("R2 object ID is invalid.")
  const config = readConfig()
  if (!config) throw new Error("Cloudflare R2 is not configured.")
  const bucket = ["employee-card", "employee-signature"].includes(kind) ? config.privateBucket : config.publicBucket
  const key = characterId + "/" + kind + "/" + objectId + "." + extensionFor(contentType)
  await requestObject("PUT", bucket, key, data, contentType)
  return { bucket, key }
}

export async function readR2Asset(bucket: string, key: string): Promise<Uint8Array | null> {
  const response = await requestObject("GET", bucket, key)
  return response ? new Uint8Array(await response.arrayBuffer()) : null
}

export async function deleteR2Asset(asset: StoredR2Asset): Promise<void> {
  await requestObject("DELETE", asset.bucket, asset.key)
}
