import { createHash } from "node:crypto"

// Read metadata only: building an image URL must never fetch the image bytes.
export const communityAssetSelect = {
  id: true, kind: true, contentType: true, storageBucket: true, storageKey: true,
} as const

type AssetVersion = { contentType?: string; storageBucket?: string | null; storageKey?: string | null }
type ImageAsset = AssetVersion & { id: string }

export function communityAssetVersion(asset: AssetVersion, fallback?: Date | null): string {
  if (asset.storageBucket && asset.storageKey) {
    return createHash("sha256")
      .update(asset.storageBucket + "\0" + asset.storageKey + "\0" + asset.contentType)
      .digest("hex").slice(0, 16)
  }
  const timestamp = fallback?.getTime()
  return timestamp !== undefined && Number.isFinite(timestamp) ? String(timestamp) : ""
}

export function communityAssetUrl(asset: ImageAsset | undefined | null, fallback?: Date | null): string {
  if (!asset) return ""
  const version = communityAssetVersion(asset, fallback)
  return "/api/community/assets/" + encodeURIComponent(asset.id) + (version ? "?v=" + version : "")
}

// Gallery backgrounds can follow an authenticated redirect without reading pixels into a canvas.
export function communityAssetDisplayUrl(asset: ImageAsset | undefined | null, fallback?: Date | null): string {
  const url = communityAssetUrl(asset, fallback)
  return url && asset?.storageBucket && asset.storageKey ? url + "&display=1" : url
}

export function communityAssetReferenceId(value: string): string | null {
  return /^\/api\/community\/assets\/([A-Za-z0-9_-]+)(?:\?v=[A-Za-z0-9_-]+)?$/.exec(value)?.[1] || null
}
