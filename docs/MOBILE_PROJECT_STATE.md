# Readiq Mobile Project State
Last updated: 2026-04-30

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

---

This file gets updated at the end of every step. Treat it as a living document.
