# Readiq Mobile Project State
Last updated: 2026-05-01

## Where we are

Step 3B (Mux signed playback-token endpoint) shipped in commit `f8acbb5`. The
endpoint is structurally complete but cannot be end-to-end tested with a real
video until Step 3.5 (the `SignedMuxPlayer` wrapper + the 3-surface web
migration + flipping `createMuxUpload` to `playback_policy: ["signed"]`)
lands. Step 4 (profile + favorites writes) is currently in progress — the
`/api/me/favorites/[courseId]` route directory and the favorites Zod schema
exist locally but are not yet committed.

## Shipped commits (web repo)

- `9a43fc3` — Step 1: API foundation (`verifyBearerToken`, `lib/api/response.ts`, validation skeleton, `lib/R2/presignedUpload.ts`, `lib/mux/playbackToken.ts`, middleware matcher comment, `/api/health/me` smoke route)
- `386d15d` — Step 2: 8 read-only endpoints (`/api/me`, `/api/wallet`, `/api/wallet/transactions`, `/api/wallet/topup/history`, `/api/me/enrollments`, `/api/me/favorites`, `/api/courses`, `/api/courses/[courseId]`)
- `f8acbb5` — Step 3B: `POST /api/mux/playback-token` (signed Mux JWT issuer, RS256, ≤5 min TTL, owner/admin/free-preview/enrollment gate)

## In progress

- **Step 4 — profile + favorites writes.** Adding `PATCH /api/me`, `POST /api/me/favorites`, and `DELETE /api/me/favorites/[courseId]`. Wraps the existing `addToFavorites` / `removeFromFavorites` / profile-update server actions; idempotent semantics on both favorites routes. Curl recipes for all three already drafted in `docs/MOBILE_API_TESTING.md`. Local files in flight: `app/api/me/route.ts`, `app/api/me/favorites/route.ts`, `app/api/me/favorites/[courseId]/`, `lib/validation/api/me.ts`, `lib/validation/api/favorites.ts`, `lib/auth/verifyBearerToken.ts`.

## Up next

In order, per `docs/MOBILE_API_MIGRATION.md` section E:

1. **Finish Step 4** — commit the profile + favorites writes once the testing batch is green.
2. **Step 3.5** — `SignedMuxPlayer` wrapper, `useMuxPlaybackToken` hook, owner branch in `/api/mux/playback-token`, thumbnail-token handling, replace the three direct `<MuxPlayer />` call sites (`components/video_uploader.tsx:857`, `components/CoursePreview.tsx:326`, `components/ui/CoursePlayer.tsx:644`), then flip `createMuxUpload` to `playback_policy: ["signed"]`. Unblocks production Mux signing for both web and mobile.
3. **Step 5 — top-up flow.** `POST /api/wallet/topup/upload-receipt` (presigned R2 PUT) and `POST /api/wallet/topup/request` (writes into `topup_requests` with new `paymentMethod` + `receiptUrl` fields). Reuses the existing rate limit and "one pending request at a time" check.
4. **Step 6 — enrollment purchase.** `POST /api/enrollments`, free + paid paths, idempotent via `generateProtectionKey(uid, courseId)`. Ports the atomic transaction logic from `purchaseCourseWithWallet`.
5. **Post-mobile cleanup PRs** (each separate, after the mobile app is live): delete the web `/Course/[courseId]` viewer, remove all ZainCash code, update `/admin-dashboard/topup-approvals` to display `paymentMethod` + `receiptUrl`, ship iOS screen-capture detection (mobile v1.1), document the Mux signing-key rotation policy, remove `/api/health/me`.

## Key decisions log

- **Wallet-only payment.** ZainCash is deprecated and frozen for the migration; it gets removed in a post-mobile cleanup PR.
- **Mobile-only video viewing.** The web Mux player is throwaway. The `/Course/[courseId]` web viewer route is scheduled for deletion after mobile launches.
- **Manual top-up via receipt upload.** No automated payment provider. Students upload a receipt image to R2 via a presigned URL; admins approve in the existing dashboard.
- **Search deferred to Algolia post-v1.** Firestore can't do free-text efficiently and prefix-match would mislead users. Mobile v1 ships with category/level filters only.
- **Step 3 split into 3B (endpoint) + 3.5 (web migration).** The original Step 3 bundled the playback-token endpoint with flipping uploads to signed playback. Flipping uploads standalone would silently break the three existing web Mux player surfaces, so the endpoint shipped first (3B) and the surface migration + upload flip is its own scoped step (3.5).
- **Course ownership = `createdBy` field (Firebase uid), no co-instructors.** Confirmed by the web-side audit. `instructorName` is a denormalized display field, not authoritative. Global admin override via `verifiedToken.admin === true`.

## Web instructor flow status

As of the latest commit on main, the entire web-side instructor experience is unchanged from before mobile API work began. All mobile API additions have been purely additive — no existing web code paths have been modified.

### What works today on the web

- Instructor login + course creation + course editing — all untouched.
- Video upload via /course-upload → Mux ingest → asset reaches "ready" state. New uploads are still playback_policy: ["public"] (the Step 3A flip was deferred; see TODO(step-3.5) comment above the playback_policy line in app/actions/upload_video_actions.ts).
- Per-video card after upload: thumbnail renders, click-to-play works, inline <MuxPlayer playbackId={video.playbackId} /> plays the video.
- Public course preview page /Course/[courseId]: free-preview videos play for unenrolled visitors via raw playback ID.
- Enrolled student viewer (still web-based until mobile launches): plays full courses via raw playback ID through components/ui/CoursePlayer.tsx.
- Admin dashboard, topup approvals (existing flow), course management — all untouched.

### Old uploaded videos (existing test content)

- The 17 videos on "From Diagnosis to Extraction" and the videos on "Surgical guide design on Exoplan" remain public-policy Mux assets. They play fine on web today and will continue to play after Step 3.5 lands. They are intentionally NOT being migrated to signed playback — they are dev/test content and will be re-uploaded with real content under signed policy after Step 3.5.

### What changes when Step 3.5 lands

Step 3.5 is a coordinated change that flips upload policy AND migrates the three web player surfaces in the same PR. Specifically:

- Future uploads become playback_policy: ["signed"] only.
- Three web player call sites get migrated to fetch signed tokens via the existing POST /api/mux/playback-token endpoint:
  1. components/video_uploader.tsx (instructor upload UI per-video card)
  2. components/CoursePreview.tsx (public course detail page free-preview videos)
  3. components/ui/CoursePlayer.tsx (enrolled-student viewer)
- The /api/mux/playback-token endpoint gains an owner branch (course.createdBy === auth.userId) and an admin branch (auth.isAdmin === true) alongside the existing enrollment / free-preview gating.
- A SignedMuxPlayer wrapper component centralizes token fetching for all three surfaces.
- Mux thumbnails are also signed (separate JWT, aud: "t").
- Legacy public-policy assets (the existing test videos) keep working — the wrapper omits playbackToken when the API returns null for legacy assets.

After Step 3.5: web instructor preview keeps working. Web public free-preview keeps working. Web enrolled-viewer keeps working. The full DRM gate becomes active for any new signed-policy asset.

### Operational guidance until Step 3.5 lands

DO NOT upload production / real-student-facing course videos via the web instructor flow yet. Reason: any video uploaded today is public-policy, meaning the screen-recording vulnerability the mobile-only viewing decision was meant to close still applies to that asset. After Step 3.5 ships, only NEW uploads automatically get signed policy; videos uploaded today would remain public-policy unless re-uploaded.

Test uploads, content experiments, and instructor self-familiarization are fine to do now — they will be re-uploaded later anyway.

### Risk surface

There is exactly one place in app/actions/upload_video_actions.ts where the upload policy is configured (the TODO(step-3.5) comment above playback_policy). When Step 3.5 lands, that single line flips to ["signed"]. There are no other places in the codebase that hardcode "public" or pass playback_policy to Mux.

---

This file gets updated at the end of every step. Treat it as a living document.
