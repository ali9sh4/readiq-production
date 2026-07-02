---
name: upload-architecture
description: >-
  Use when working on ANY upload path except the video deep-internals — course
  file uploads (components/fileUplaodtoR2.tsx, app/actions/upload_File_actions.ts),
  cover/thumbnail images (components/CourseDashboard.tsx onImageSubmit,
  components/thumb_nail_uploder.tsx, components/muti_image_uploader.tsx), payment
  receipts (app/api/wallet/topup/upload-receipt, lib/R2/presignedUpload.ts), the
  R2 helpers (lib/R2/*), or anything that picks which storage backend/transport
  to use. Also read before changing next.config.ts image settings or middleware
  in relation to a long-running upload. For the Mux/UpChunk video internals use
  the upload-resilience skill instead. Canonical doc: docs/UPLOAD_ARCHITECTURE.md.
---

# Upload Architecture — cross-backend invariants

This repo has **four upload paths over three backends**. Full reference:
**`docs/UPLOAD_ARCHITECTURE.md`**. Video/UpChunk internals: the
`upload-resilience` skill. This skill is the routing + cross-backend layer.

| Path | Backend | Transport | Bytes via our server? |
|---|---|---|---|
| Video | Mux | UpChunk direct-upload URL | No |
| Course files | R2 | **server-action FormData → PutObject** ⚠️ anti-pattern | **YES, up to 200 MB** |
| Cover/thumbnail image | Firebase Storage | `uploadBytesResumable` client SDK | No |
| Top-up receipt | R2 | **presigned PUT, direct** ✅ clean pattern | No |

## The golden rules (all paths)

1. **Big bytes bypass our server.** Presigned PUT (R2) / direct-upload URL (Mux)
   / Firebase client SDK. Never stream a large `File` through a server action or
   route handler. The course-file path violates this today — the documented
   target is **presigned direct-to-R2**, mirroring the receipt route.
2. **Persist the DB record ONLY after the upload provably succeeded**, and on a
   DB-write failure **delete the just-uploaded blob** (no phantom record, no
   orphan). Order: upload → confirm → write → (on fail) delete bytes.
3. **Validate server-side at the trust boundary** — type/extension/size/owner in
   the action or route, before minting a presigned URL. Client picker checks are
   UX only. Canonical validator: `lib/R2/file-security.ts`.
4. **Rate-limit per uid, after auth** (Upstash). Anonymous traffic must not burn
   another user's budget.
5. **Progress must never move backward** — drive it from committed bytes, not
   in-flight optimistic bytes.
6. **Long upload + a metadata/status call to a middleware-matched page route =
   auth-redirect landmine.** Prefer an `/api/*` route (Bearer auth, outside the
   matcher) for status/keep-alive. See `docs/AUDIT_IPAD_UPLOAD.md`.

## Backend choice

- **R2** = private, access-gated artifacts (signed GET via `getFileSignedUrl` /
  `getPresignedDownloadUrl`). **Keep R2 out of `next.config.ts` remotePatterns.**
- **Firebase Storage** = publicly readable course thumbnails rendered through
  `next/image` (`firebasestorage.googleapis.com` is in remotePatterns).
- **Mux** = needs transcoding + signed playback.

## Image-optimization is billed separately from byte transfer

`next/image` bills per transformation regardless of storage. See
`docs/AUDIT_IMAGE_OPTIMIZATION.md`: keep R2 off remotePatterns; don't wrap
private/receipt or token-minted (cache-busting) URLs in `<Image>`; keep AVIF
off; give `<Image>` accurate `sizes`; mark transient `blob:` previews
`unoptimized`.

## Build-pass is NOT enough

`tsc`/`build` prove compilation, nothing about runtime upload behavior. Exercise
a **real upload**: happy path (artifact lands AND record written), degraded line
(bar never decreases), full disconnect+restore (no silent resume; retry mints a
**fresh** upload URL/session), failure leaves no orphan blob or phantom record,
and access gating still blocks non-owners. Checklist:
`docs/UPLOAD_ARCHITECTURE.md` §8. If a change can't be exercised this way, say so.

## If a change seems to require violating a golden rule

Stop and surface it — these are load-bearing across money (receipts), access
(file gating), and UX. A task that genuinely needs an exception needs human
sign-off, not a quiet one.
