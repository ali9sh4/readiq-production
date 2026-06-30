---
name: cover-image-rendering
description: >-
  Use when rendering or debugging course COVER / thumbnail images — broken cover
  icons, book-placeholder cards, or any <img>/<Image> that shows a course's
  thumbnailUrl. Covers the surfaces components/CoursesCardList.tsx (catalog/home/
  instructor lists), components/CoursePreview.tsx (detail hero), and
  components/thumb_nail_uploder.tsx (editor preview), plus the cover delete/upload
  state binding in components/CourseDashboard.tsx. Read before adding a new place
  that displays a course cover, before re-adding next/image to a cover, or when a
  cover renders broken in production but the file exists in Firebase Storage. For
  UPLOAD mechanics (where bytes go) use upload-architecture instead; this skill is
  about RENDERING and the delete/clear binding. Canonical audit:
  docs/COVER_PHOTO_PROPAGATION_AUDIT.md.
---

# Course cover / thumbnail rendering

## The one hard rule
**Render course covers with a plain `<img>`, never `next/image`.** On the Vercel
**Hobby tier the image optimizer (`/_next/image`) returns HTTP 402** once the
monthly transformation quota is hit, so every cover routed through `<Image>`
breaks in production. The **raw Firebase Storage download URL returns 200** with
real bytes — so a plain `<img src={firebaseUrl}>` always works, with zero
dependency on `next.config` `remotePatterns` or optimizer quota.

Symptom signature: editor cover shows a **raw broken-image icon** (the uploader
`<img>` has no `onError`); catalog cards show the **book placeholder** (their
`onError` fires). Both are the *same* 402, not a storage/URL/token/rules problem.

## Where covers come from (don't re-derive)
- Backend: **Firebase Storage** (not R2). Bucket `readiq-1f109.firebasestorage.app`,
  path `courses/<courseId>/thumbnail/<ts>-<name>`.
- Persisted field: `courses/{id}.thumbnailUrl` = the **`getDownloadURL()` result**
  — a tokenized `https://firebasestorage.googleapis.com/v0/b/.../o/<path>?alt=media&token=<uuid>`.
  This is durable and public-via-token; unauthenticated GET returns 200. Do NOT
  hand-build `storage.googleapis.com/...` URLs (no token → 403) and do NOT persist
  `gs://` (not browser-loadable).

## The cover render surfaces (keep them ALL on plain `<img>`)
Fixing one and leaving another is the main failure mode. There are three:
1. `components/CoursesCardList.tsx` — **both** the admin-view and user-view cards.
   This single component backs the public catalog (`publicCoursesCardList.tsx`),
   the home grid (`HomeCoursesSection.tsx`), and the instructor/admin "my courses"
   lists. Keep its `onError → BookOpen` placeholder.
2. `components/CoursePreview.tsx` — the course detail hero.
3. `components/thumb_nail_uploder.tsx` — the instructor editor cover preview
   (also renders `blob:` previews of just-picked files, which plain `<img>`
   handles and `next/image` cannot optimize anyway).

Preserve the `fill` look on a plain `<img>` with
`className="absolute inset-0 h-full w-full object-cover …"` on the existing
`relative` parent; keep `loading="lazy"`; keep any existing `onError` fallback;
add `{/* eslint-disable-next-line @next/next/no-img-element */}`.

## NOT course covers — leave on next/image
Google avatars (`user_dashboard/layout.tsx`), ZainCash logo
(`paymentSelector.tsx`), Mux video thumbnails (`SignedMuxThumbnail.tsx`), and the
legacy `muti_image_uploader.tsx` (only imported by the unused `ui/property-form.tsx`).
Scope changes to covers only. See `docs/AUDIT_IMAGE_OPTIMIZATION.md` for the full
per-surface optimizer inventory.

## The delete/upload state-binding gotcha
The editor cover is bound to the **react-hook-form `image` field**
(`ThumbNailUploader image={field.value}`), **not** to `course.thumbnailUrl`.
- On **delete**, updating `course.thumbnailUrl` alone does NOT clear the visible
  cover — you must `form.setValue("image", undefined)` (the rendered source).
- On **upload**, `onImageSubmit` already does `form.setValue("image", { id, url,
  isExisting: true })` plus `setCourse`.
- Do **NOT** use `router.refresh()` to force the clear — on a stale auth cookie it
  re-runs the protected route through middleware and bounces to `/` (the Symptom 2
  bug; see `docs/NAV_AND_COURSE_EDITOR_AUDIT.md`).

Server-rendered cover surfaces (catalog card, detail hero, lists) read RSC props,
not client state, so they don't reflect a cover change until their cache is
invalidated. `SaveThumbnail` / `DeleteThumbnail` currently do **not**
`revalidatePath` (unlike `publishCourse`/`unpublishCourse`) — add it there if a
cover change must propagate to public surfaces without a manual refresh.

## Verifying a cover change
`npm run build` then `next start`, fetch `/` and a `/course/<id>`, and confirm the
served HTML has `<img src="https://firebasestorage.googleapis.com/...">` with no
`data-nimg` and no `/_next/image?url=` for covers. The local optimizer returns 200
(can't reproduce the Hobby 402), so this check proves only that the bypass is in
effect — which is the point.
