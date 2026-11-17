# Character Collection and Theme Song

The square control on the Character page opens Relationships and Voice Lines without leaving the character. Existing wardrobe, skills, weapons, signatures and ID-card controls keep their behavior.

## Relationships

Staff Editor → จัดวางภาพในแต่ละหน้า → Relationships adjusts the shared face crop for the board, report, and person picker. The preview and live views use the same original-image renderer. Defaults retain automatic placement; scale and horizontal/vertical focus adjust it per character. Reset restores automatic placement. Settings use the existing imageLayout JSON field, and normal member saves preserve the Staff settings. No additional migration is required.

The current character is the central star. Portraits have a 1:1 face area. Colored solid lines represent this character's perspective; dashed lines represent incoming perspectives. The two directions are independent. Only the source owner or unlocked staff can change a direction. Only characters visible to the viewer appear in search and the map. Pan the empty map, use the mouse wheel/two fingers to zoom, or use the zoom buttons. A keyboard-accessible name directory provides another way to choose a relationship.

## Voice Lines and Theme Song

Voice Lines support YouTube, uploaded audio, or direct HTTPS audio URLs. Start/end inputs accept seconds, mm:ss, or hh:mm:ss, including milliseconds. One uploaded audio asset can serve several clips. Voice Lines can be edited, removed and reordered. Theme Song is optional section 07 in Create/Edit, with title, artist and uploaded cover. The vinyl rotates only while playing. Page load does not autoplay. Starting another track stops the previous player.

YouTube remains a visible video player; the application does not extract audio or hide playback. Embedding may be blocked by the video owner or browser. Direct audio URLs depend on the remote host and browser codec support.

## Storage and rollout

Four additive tables are introduced by `20261105120000_character_collection_media`: CommunityCharacterRelationship, CommunityCharacterVoiceLine, CommunityCharacterThemeSong and CommunityMediaAsset. No existing character/image data is rewritten. Metadata lives in PostgreSQL; audio/cover objects live in the R2 private bucket. Media rows are separate from legacy character-image cleanup. Omitted Theme Song fields preserve existing songs when older editors save.

Uploads use short-lived, signed, create-only PUT URLs directly to R2, avoiding the serverless body limit. The server checks object size, Content-Type and actual file header before marking it ready. Files attach to the character in the same transaction as the saved entry. Revisions reject stale edits. API reads check visibility before issuing short-lived signed GET URLs; R2 handles range streaming. The technical single-PUT limit is 5 GiB. The browser must be able to decode the chosen audio format for duration/preview.

### Required R2 CORS

In Cloudflare, open **rnc-private → Settings → CORS Policy → JSON**. Add the rule from [r2-media-cors.json](./r2-media-cors.json), retaining any unrelated rules already configured. The rule permits localhost:3002 and the production domain, GET/HEAD/PUT and the Content-Type/If-None-Match/Range headers. It does not make the bucket public. Additional Preview domains must be added explicitly before testing uploads there.

The optional helper `node scripts/configure-r2-media-cors.mjs` reads the current rules. `--apply` adds the rule while keeping existing rules. It requires bucket-configuration privileges; object-only keys cannot configure CORS. No new credentials are required for normal uploads.

### Migration

Generate Prisma and apply migrations against the intended database before deploying code that reads the new tables. The implementation session applies this migration only to the local Docker database. Production/Neon remains a separate release step.

```powershell
cd C:\ProjectsV2\Project-LinuxOs\web
npm run db:migrate:deploy
npm run build
```

Verify DATABASE_URL points to the intended database before running migration commands. These commands do not copy local data to Neon.

### Verification

```powershell
node --test tests/community-collection.test.mjs tests/community-media-player.test.mjs
node --test tests/community-collection.integration.test.mjs
node --test tests/community-media-r2.integration.test.mjs
```

Integration tests explicitly load `.env.local`, refuse remote database hosts, create unique disposable fixtures and remove only those fixtures. The R2 integration test uploads a generated silent WAV, validates download/overwrite protection/CORS, then deletes that generated file. It fails when browser CORS is not configured.

### Unused upload cleanup

`node scripts/cleanup-community-media.mjs` inventories unused media without changing data. `--apply` removes unattached drafts older than 24 hours and unreferenced attached media older than 7 days. References are rechecked under a row lock before removing each object. A failed R2 delete retains the metadata for retry. Remote apply additionally requires `--confirm-remote`. Existing voice clips, themes, skills, weapons, wardrobe and ID-card images are excluded. Schedule this only after reviewing the dry run.


## Relationship evidence

Each directed relationship can contain multiple evidence records with an optional title, note, and photograph. Existing relationship notes are retained. Evidence is saved in the same transaction and guarded by the relationship version, so stale saves cannot remove newer evidence. Omitting the evidence field preserves current records.

Photographs use direct R2 uploads with the EVIDENCE purpose and preserve the full image aspect ratio. Only the source character's owner or unlocked Staff can edit its evidence. The reciprocal character's evidence is displayed read-only. Linked files are excluded from unused-media cleanup; removed files receive a fresh cleanup grace period.

Before deploying this feature, apply the additive migrations 20261105160000_relationship_evidence and 20261105163000_relationship_evidence_media_purpose using the production database's normal migration procedure. Local development uses .env.local and must target localhost. No production migration is automatic.


## Audio clip editor

Voice Lines start with no audio. Choose a local file or paste a link; YouTube links are detected automatically. The editor reads the duration without autoplay, then offers draggable start/end handles and a draggable selected window. Preview playback is constrained to that window. Local audio can show a decoded waveform; remote sources use a time ruler. The original audio is retained and only startSeconds/endSeconds are saved. The Voice Line dialog keeps its position and height while source or playback state changes.
