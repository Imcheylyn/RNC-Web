import { createHash, createHmac } from "node:crypto"
import { readR2Config } from "@/lib/r2-storage"

type MediaObject = { storageBucket: string; storageKey: string; contentType: string }
const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const hmac = (key: string | Uint8Array, value: string) => createHmac("sha256", key).update(value).digest()
const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, char => "%" + char.charCodeAt(0).toString(16).toUpperCase())

export function mediaBucket() {
  const config = readR2Config()
  if (!config) throw new Error("R2 ยังไม่พร้อมสำหรับไฟล์เสียง")
  return config.privateBucket
}

export function mediaSignedUrl(asset: MediaObject, method: "GET" | "PUT" | "HEAD" | "DELETE", expires = 900) {
  const config = readR2Config()
  if (!config || asset.storageBucket !== config.privateBucket || !/^media\/[A-Za-z0-9_-]{1,100}\/[a-f0-9-]{36}\.(mp3|m4a|aac|wav|ogg|webm|flac|png|jpg|webp)$/.test(asset.storageKey)) throw new Error("ที่เก็บไฟล์เสียงไม่ถูกต้อง")
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "")
  const date = now.slice(0,8), scope = date + "/auto/s3/aws4_request"
  const url = new URL(config.endpoint.origin + "/" + [asset.storageBucket, ...asset.storageKey.split("/")].map(encode).join("/"))
  const headers: Record<string,string> = { host: url.host }
  if (method === "PUT") { headers["content-type"] = asset.contentType; headers["if-none-match"] = "*" }
  const signedHeaders = Object.keys(headers).sort().join(";")
  const params: Record<string,string> = {
    "X-Amz-Algorithm":"AWS4-HMAC-SHA256", "X-Amz-Credential":config.accessKeyId + "/" + scope,
    "X-Amz-Date":now, "X-Amz-Expires":String(expires), "X-Amz-SignedHeaders":signedHeaders,
  }
  const canonicalQuery = Object.entries(params).sort(([a],[b]) => a.localeCompare(b)).map(([key,value]) => encode(key) + "=" + encode(value)).join("&")
  const canonicalHeaders = Object.keys(headers).sort().map(key => key + ":" + headers[key].trim() + "\n").join("")
  const canonical = [method,url.pathname,canonicalQuery,canonicalHeaders,signedHeaders,"UNSIGNED-PAYLOAD"].join("\n")
  const key = hmac(hmac(hmac(hmac("AWS4" + config.secretAccessKey,date),"auto"),"s3"),"aws4_request")
  const signature = createHmac("sha256",key).update(["AWS4-HMAC-SHA256",now,scope,digest(canonical)].join("\n")).digest("hex")
  url.search = canonicalQuery + "&X-Amz-Signature=" + signature
  return url.href
}

export async function inspectMediaObject(asset: MediaObject) {
  const head = await fetch(mediaSignedUrl(asset,"HEAD"),{method:"HEAD",cache:"no-store",signal:AbortSignal.timeout(20000)})
  if (!head.ok) throw new Error("ยังไม่พบไฟล์ที่อัปโหลด กรุณาลองอีกครั้ง")
  const response = await fetch(mediaSignedUrl(asset,"GET"),{headers:{Range:"bytes=0-63"},cache:"no-store",signal:AbortSignal.timeout(20000)})
  if (!response.ok || response.status !== 206) { await response.body?.cancel(); throw new Error("อ่านข้อมูลไฟล์ที่อัปโหลดไม่สำเร็จ") }
  return { byteSize:Number(head.headers.get("content-length")), contentType:head.headers.get("content-type")?.split(";")[0].trim(), bytes:new Uint8Array(await response.arrayBuffer()) }
}

export async function deleteMediaObject(asset: MediaObject) {
  const result = await fetch(mediaSignedUrl(asset,"DELETE"),{method:"DELETE",signal:AbortSignal.timeout(20000)})
  if (!result.ok && result.status !== 404) throw new Error("ลบไฟล์เก่าจาก R2 ไม่สำเร็จ")
}
