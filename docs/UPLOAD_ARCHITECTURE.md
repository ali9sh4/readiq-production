# Upload Architecture — Canonical Reference (all backends)

The general guide for **every** upload path in this repo: video, course files,
cover/thumbnail images, and payment receipts. Read this before adding or
changing any uploader. It generalizes the hard-won rules from the video pipeline
to the other backends and records the architecture each new uploader should
target.

Companion docs/skills — read the deep one for the path you're touching:
- **Video** deep-dive: `docs/VIDEO_UPLOAD_PIPELINE.md` + the `upload-resilience`
  skill. Those are the source of the cross-cutting rules below; this doc lifts
  them to the file/image paths.
- **iPad / auth-redirect landmine**: `docs/AUDIT_IPAD_UPLOAD.md`.
- **Image-optimization cost** (next/image, not byte transfer):
  `docs/AUDIT_IMAGE_OPTIMIZATION.md`.

Every rule here was paid for in production debugging. Do not "simplify" them away.

---

## 1. The four upload paths (what exists today)

| Path | Backend | Mechanism | Bytes through our server? | Persist trigger | Code |
|---|---|---|---|---|---|
| **Video** | Mux | UpChunk → Mux direct-upload URL → poll until `ready` | **No** (straight to Mux, OCI Virginia) | only on asset `ready` | `hooks/useVideoUpload.ts`, `components/video_uploader.tsx`, `app/actions/upload_video_actions.ts` |
| **Course files** | Cloudflare R2 | Whole `File` in a **server-action `FormData`** → `PutObjectCommand` | **YES — up to 200 MB through the serverless action** ⚠️ | after R2 PUT + Firestore write (R2 orphan cleaned on DB failure) | `components/fileUplaodtoR2.tsx` (`SmartCourseUploader`), `app/actions/upload_File_actions.ts`, `app/course-upload/action.ts` |
| **Cover / thumbnail image** | Firebase Storage | `uploadBytesResumable` client-side → `getDownloadURL` → save URL | **No** (client SDK straight to FB Storage) | after `getDownloadURL` resolves, via `SaveThumbnail` | `components/CourseDashboard.tsx` (`onImageSubmit`), pickers `components/thumb_nail_uploder.tsx` / `components/muti_image_uploader.tsx` |
| **Top-up receipt** | Cloudflare R2 | **Presigned PUT URL**, client PUTs direct | **No** (direct to R2) — *the clean pattern* | top-up request stores `receiptKey` after PUT | `app/api/wallet/topup/upload-receipt/route.ts`, `lib/R2/presignedUpload.ts` |

The pickers `thumb_nail_uploder.tsx` and `muti_image_uploader.tsx` are **pure
file pickers** — they emit `{ id, url: blob:…, file }` and revoke object URLs on
unmount. They never upload. The actual image upload lives in the parent
(`CourseDashboard.onImageSubmit`).

---

## 2. The golden rules (apply to all four)

These are backend-agnostic. The video path follows all of them; the file path
violates #1 today (see §4).

1. **Big bytes must bypass our server.** Never stream a large file through a
   Next server action or route handler. Vercel's request-body cap (~4.5 MB on
   route handlers) and serverless memory/timeout make it a foot-gun, and the
   bytes are billed/processed twice. Use a **direct-to-storage** transport:
   presigned PUT (R2), direct-upload URL (Mux), or the Firebase client SDK.
   *The receipt path and the video path do this. The course-file path does not.*

2. **Persist the DB record ONLY after the upload provably succeeded.** The video
   path writes the course-video record only once polling sees Mux `ready`; the
   file path writes Firestore only after the R2 PUT returns and **deletes the R2
   object if the Firestore write fails** (`fileUplaodtoR2.tsx` upload loop). A
   failed/interrupted upload must leave **no phantom DB entry and no orphaned
   blob**. Order: upload bytes → confirm → write record → (on record failure)
   delete bytes.

3. **Validate at the trust boundary, server-side.** File type, extension, and
   size are validated in the server action / route, not just in the client
   picker. Canonical validator: `lib/R2/file-security.ts` (`validateFile`,
   `sanitizeFilename`, per-type size caps). Receipts validate `contentType` +
   `sizeBytes` with zod (`lib/validation/api/wallet.ts`) *before* minting the
   presigned URL. Client-side checks are UX only — never the gate.

4. **Rate-limit authenticated uploads.** Both R2 paths rate-limit per uid via
   Upstash (`uploadCourseFileToR2`: 10/min; video `createMuxUpload`: 10/10min).
   Apply the limit **after** auth so anonymous traffic can't burn another user's
   budget.

5. **Show progress that can only move forward.** Never display a value that can
   decrease (see the video bar rule in §5). For resumable transports, drive the
   bar from *committed* bytes, not in-flight optimistic bytes.

6. **A long upload + a status/keep-alive call to a middleware-matched page route
   = an auth-redirect landmine.** See §6. This bit the video path on iPad.

---

## 3. Decision matrix — which backend/transport for a new uploader

| You're uploading… | Backend | Transport | Why |
|---|---|---|---|
| Instructor **video** | Mux | UpChunk direct-upload URL | needs encoding + signed playback; Mux owns the pipeline |
| **Course resource files** (pdf/zip/3D/audio, up to ~200 MB) | R2 | **presigned PUT, direct** (target) | private, access-gated downloads via signed GET; large → must bypass server |
| **Cover / thumbnail images** | Firebase Storage *(today)* or R2 | client SDK *(today)* / presigned PUT | small, **publicly readable**, rendered through `next/image` |
| **Payment receipts** | R2 | presigned PUT, direct | private, never rendered through `next/image`; admin-only access |

Backend split rationale:
- **R2** = private artifacts gated behind signed URLs (`getFileSignedUrl`,
  `getPresignedDownloadUrl`). R2 is **deliberately absent from
  `next.config.ts` remotePatterns** — keep it that way (see §7).
- **Firebase Storage** = publicly readable course thumbnails that *do* go
  through `next/image` (host `firebasestorage.googleapis.com` is in
  remotePatterns).
- **Mux** = anything that needs transcoding + signed playback.

---

## 4. Course-file uploader — current anti-pattern + target

**Today** (`uploadCourseFileToR2`, `app/actions/upload_File_actions.ts`): the
client puts the whole `File` into a server-action `FormData`; the action reads
`file.arrayBuffer()` into a Node `Buffer` and `PutObjectCommand`s it to R2. The
100 MB `serverActions.bodySizeLimit` in `next.config.ts` exists to keep this
alive, and per-type caps go to 200 MB (`file-security.ts`) — i.e. the design
**relies on pushing up to 200 MB through a serverless function**. That is the
one path that violates golden rule #1: memory pressure, cold-start timeouts, and
double-billed bytes, with no chunking, no resumability, and no per-file progress.

What it already gets **right** (keep these): server-side `validateFile`,
post-auth rate limit, AES256 SSE, secure key (`courses/{courseId}/{ts}_{hash}{ext}`),
and persist-after-success with R2-orphan cleanup on Firestore failure.

**Target architecture — presigned direct-to-R2** (mirror the receipt path):

```
client picks file
  → validate (client UX) ────────────────────────────────────────────┐
  → server action/route: verifyIdToken → rate-limit → validate type/  │
      size/owner → mint presigned PUT for courses/{courseId}/{ts}_{hash}{ext}
  → client PUTs the bytes STRAIGHT TO R2 (bytes never touch our server)
  → on 200: server action saveCourseFilesToFirebase (persist record)
  → on Firestore failure: delete the R2 object (no orphan)
```

Notes for the migration (when it happens — not in this doc's scope):
- The presigned helper already exists: `createPresignedUploadUrl` in
  `lib/R2/presignedUpload.ts`. The receipt route is the reference implementation.
- Validation must stay **server-side**: the presigned URL is minted only after
  the server validates `contentType`/`sizeBytes`/extension/owner. Don't trust
  the client `File`.
- Keep the per-type size caps and `sanitizeFilename`/secure-key generation from
  `file-security.ts`.
- R2 presigned PUT is a **single PUT**, not multipart — genuinely large files
  (the 200 MB archive case) still can't resume mid-transfer. If resumable large
  files are required, that's R2 **multipart** (per-part PUTs), the same Phase-B
  shape noted for video. Don't silently ship single-PUT and call it resumable.
- Downloads stay gated: `getFileSignedUrl` checks owner/admin/enrolled/free
  before signing a short-lived GET. Don't expose raw R2 URLs.

---

## 5. Cross-cutting resilience invariants (generalized from video)

The seven video non-negotiables (`upload-resilience` skill /
`docs/VIDEO_UPLOAD_PIPELINE.md`) are Mux/UpChunk-specific in wording but most
generalize. Which apply where:

| Invariant | Video (UpChunk/Mux) | File (R2) | Image (FB Storage) |
|---|---|---|---|
| **Progress = committed bytes, never in-flight** (bar must never go backward) | ✅ core | applies if you add progress | `uploadBytesResumable` exposes `bytesTransferred` — only ever increasing, safe |
| **Fixed small chunks, no dynamic growth** | ✅ 8 MB fixed | only relevant if you adopt R2 multipart | n/a (single resumable session) |
| **Detect a degraded link via "N failures, 0 commits", not `navigator.onLine`** | ✅ | applies to any retry loop | applies |
| **Real disconnect → abandon + restart fresh; never resume a half-dead session** | ✅ (seam corruption) | a presigned single-PUT either fully succeeds or you re-PUT from byte 0 — already "restart fresh" | FB resumable can resume; a mid-transfer drop is generally safe to retry, but prefer restart over a stuck session |
| **Retry = a NEW upload URL/session, never reuse a dead one** | ✅ (reused Mux URL → 400) | mint a **fresh presigned URL** per retry; a presigned URL is single-shot and time-boxed | get a fresh `uploadBytesResumable` task |
| **One upload instance live at a time; dispose before starting another** | ✅ | applies to any client loop with an abortable transport | dispose the prior `uploadTask` |
| **Write the DB record ONLY on confirmed success** | ✅ (`ready`) | ✅ (after PUT, cleanup on DB fail) | ✅ (after `getDownloadURL`) |

**Build-pass ≠ verified.** `tsc`/`build` prove compilation, nothing about
runtime upload behavior — every real upload bug in this repo passed the build.
See §8.

---

## 6. The iPad / auth-redirect landmine (any long upload)

Source: `docs/AUDIT_IPAD_UPLOAD.md`. Generalized statement:

> Any upload that takes minutes **and** makes a server-action / fetch call to a
> **middleware-matched page route** during the upload (status poll, keep-alive,
> chunk-complete callback) can be answered with an **auth redirect** mid-flight,
> navigating the page away and dropping upload state.

Mechanism: `middleware.ts` redirects page routes to `/api/refresh-token` (→
reload) or `/` (home) once the Firebase cookie token is within 5 min of expiry
or fails JWKS verify. On iPad/WebKit the 60s token-refresh interval
(`authContext.tsx`) is throttled while backgrounded/asleep, so the token lapses
and the next poll trips the redirect. The chunk bytes themselves are safe (they
go direct to Mux/R2/FB and never hit middleware) — it's the **metadata call to
the page route** that gets redirected.

Implications for any new uploader:
- Prefer pushing status polling / metadata calls to an **`/api/*` route**
  (Bearer-token auth, **not** in the middleware matcher) over a server action
  bound to the current page path. `/api/*` is intentionally outside the matcher.
- There is **no `beforeunload` guard or Wake Lock** anywhere in the repo today
  (grep confirms 0 hits). A long upload has no navigation guard. If you harden
  uploads, a `beforeunload` warning + `navigator.wakeLock` during active upload
  are the documented gaps to close.
- Don't add `/api/:path*` to the middleware matcher to "fix" auth — that breaks
  mobile + ZainCash callbacks (see CLAUDE.md / Auth model).

---

## 7. Image-optimization cost (separate from byte transfer)

Source: `docs/AUDIT_IMAGE_OPTIMIZATION.md`. Uploading an image and *rendering* it
are billed separately — `next/image` (Vercel Image Optimization) bills per
transformation, independent of where bytes are stored. Rules an image uploader
must respect:

- **R2 stays out of `next.config.ts` remotePatterns.** Receipts and other
  private R2 uploads must never be wrapped in `<Image>`; serve raw or via a
  plain `<img>`/`unoptimized`. Adding the R2 host would let payment-volume drive
  transformations.
- **Course thumbnails (Firebase Storage) are the one place optimization earns
  its keep** — instructor originals can be up to 10–20 MB. Keep them optimized,
  but add accurate `sizes` and trimmed `deviceSizes`/`imageSizes`.
- **Token-minted / cache-busting URLs must not go through `next/image`** (Mux
  signed thumbnails rotate their `token` query → every mint is a new cache key →
  unbounded re-optimization). Use `unoptimized` or a plain `<img>`.
- **Do NOT enable AVIF** (`formats`) — it doubles every variant. WebP-only.
- Transient picker previews (`blob:` URLs in `thumb_nail_uploder` /
  `muti_image_uploader`, tiny fixed boxes) gain nothing from optimization →
  candidates for `unoptimized`.

---

## 8. Verifying an upload change — build-pass is NOT enough

Adapt the video checklist (`docs/VIDEO_UPLOAD_PIPELINE.md`) to the path:

1. **Happy path** — bar climbs 0→100 monotonically; the artifact actually lands
   (R2 object exists / FB `getDownloadURL` resolves / Mux asset `ready`) **and**
   the DB record is written.
2. **Degraded line** (DevTools → Network throttle) — bar never decreases; the
   stall/retry UX fires.
3. **Full disconnect + restore** — no silent resume-to-completion; a retry uses
   a **fresh** upload URL/session (new presigned URL / new Mux upload id / new
   FB task), not the dead one.
4. **Failure leaves no junk** — kill the DB write after a successful byte upload
   and confirm the orphaned blob is deleted (R2) — no phantom record, no orphan.
5. **Access gating still holds** — a non-owner/non-enrolled user cannot fetch
   the signed download URL.

If a change can't be exercised by one of these on a **real upload**, say so
explicitly.

---

## 9. Validation & security reference

- `lib/R2/file-security.ts` — allowed extensions + MIME map, per-type size caps
  (image 20 MB, video 200 MB, model3d/archive 100–150 MB, default 50 MB),
  `sanitizeFilename`, `generateSecureFilename` (`courses/{courseId}/{ts}_{hash}{ext}`),
  SHA-256 hashing, path-traversal guards (`..` rejection, `courses/` prefix).
- `lib/validation/api/wallet.ts` — receipt `contentType`/`sizeBytes` zod schema +
  `extFromContentType`.
- Signed access: `getFileSignedUrl` (owner/admin/enrolled/free gate, short TTL),
  `getPresignedDownloadUrl` / `createPresignedUploadUrl` (`lib/R2/presignedUpload.ts`).
- Never expose raw R2 URLs; never expose Mux signing keys to the client
  (`SignedMuxPlayer`/`SignedMuxThumbnail` only).

---

## 10. Locked / don't-touch

Per `docs/MANUAL_CLEANUP_DO_NOT_AUTOMATE.md`: `lib/mux/playbackToken.ts`,
`lib/mux/thumbnailToken.ts`, the financial ledger, and sectional/`accessScope`
logic. The auth files in the iPad landmine (`middleware.ts`, `authContext.tsx`,
`app/api/refresh-token/route.ts`) are read-to-understand, change-with-care.
