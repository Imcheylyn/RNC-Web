# Character wardrobe

The Character page opens the wardrobe from the hanger icon. The signature is always visible, using Sign.png until a custom signature is available; clicking it cycles outfits when more than one is saved. The selected outfit is remembered per viewer and character in that browser.

Owners can add, edit, and delete outfits for their regular Character/Human records. Other viewers can browse published characters. Staff must have a valid Staff unlock to manage other or special characters. Default cannot be deleted. Chibi is optional for every outfit, including Default.

`CommunityCharacterSkin` holds outfit metadata in PostgreSQL. Artwork and Chibi files use R2 and authenticated `/api/community/assets/:id` references. Uploads are prepared in the browser and sent as binary multipart files. Replacing either file preserves the other file. Character Editor saves preserve all wardrobe assets.

Outfit artwork always retains the entire image composition, including Full CG. Browser preparation may reduce resolution and encode WebP but never bakes display zoom into the pixels. `CommunityCharacterSkin.imageScale` stores the 50–200% display size separately. Changing only the size does not fetch, upload, replace, or delete an image. Both Character and Wardrobe use the saved size. The editor defaults to a miniature of the Wardrobe scene, sharing its artwork styles and viewport aspect ratio, with a Full image toggle to inspect the complete source. Changing the size returns to the scene preview. Preview toggles never mark the outfit as changed or alter its saved size. Existing saved sizes reopen unchanged, and clients omitting `imageScale` preserve the stored value. Screen edges can still hide part of a zoomed image; reducing the size restores it.

The `20261103120000_wardrobe_image_scale` migration adds the size column with default 100 and a range constraint. It does not rewrite existing artwork. Images cropped by an older release need to be uploaded again from the full source; removed pixels cannot be recovered from the cropped asset.

In Scene preview, drag the artwork in any direction to position it. The pointer uses a movement cursor; the Change image button stays separate. On touch screens, gestures inside the artwork move it in both axes, and gestures outside the preview scroll the form. Keyboard users can use all four arrow keys, Shift for larger steps, or Home to center. Full image remains an unmodified source preview. Reset restores size and both positions. `imageOffsetX` and `imageOffsetY` store percentages of the viewport width and height, rounded to two decimals in the range -100 to 100. Both Wardrobe and Character use these offsets without re-uploading or cropping either image. Omitted offsets from older clients preserve the saved values. The `20261103140000_wardrobe_image_offset_x` and `20261103150000_wardrobe_image_offset_y` migrations initialize each axis at zero without changing the artwork.

Apply the new Prisma migration before deploying this feature to production:

```powershell
cd C:\ProjectsV2\Project-LinuxOs\web
npm run db:migrate:deploy
```

Use the intended database environment when running the command. Local verification must use `.env.local` and a localhost database; do not run the local checks against Neon. The original wardrobe migration creates `CommunityCharacterSkin` and its index/foreign key; subsequent migrations extend its metadata. Existing character images stay attached to the Default outfit without copying image files.

Validation:

```powershell
node --test tests/community-wardrobe.test.mjs tests/community-policy.test.mjs
npx tsc --noEmit --incremental false
```

Local manual checks: create a skin with and without Chibi; reload; cycle with the signature; edit only its description and verify both images survive; replace only one image; remove Chibi; save the character in Editor and verify wardrobe/skills/weapons remain; reject another owner's mutation; verify Staff unlock; delete a disposable skin and confirm Default cannot be deleted.

Signature colors: keep uploaded colors and transparency in the original employee-signature asset, including signatures uploaded through the wardrobe gate. The employee card back renders that original and offers a pen color picker for handwriting. The wardrobe/character-page mark generates a separate red display image with a raised wax-stamp effect; generating the mark never overwrites the stored original.

Owners and authorized Staff can replace the Character-page signature from Edit signature beside the character edit link in Contact. This opens the saved signature for preview, accepts a new drawing or image, and returns to Character after saving. Opening or clearing the draft does not replace the saved signature. The Character-page stamp is displayed at 1.6 times the previous size, bounded to the available width on mobile.
