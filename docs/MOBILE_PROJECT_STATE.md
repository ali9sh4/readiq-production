# Readiq Mobile Project State
Last updated: 2026-05-28

## Where we are

**The web repo's mobile API surface is complete and signed playback is fully
shipped.** Everything below is merged to `main`:

- Steps 1–6 — mobile API foundation + 14 endpoints (read-only, profile/favorites
  writes, top-up flow, enrollment purchase).
- Step 3.5 signed playback — all substeps A–H, merged via `e1db961`. Pre-ship
  audit / threat model / migration gotchas archived to
  `docs/archive/STEP_3_5_AUDIT.md`.
- `POST /api/me` user bootstrap — merged via `4a99c0b`.
- Sectional purchasing — Phases 1–6 on web, Phase 7a (mobile API read parity).
- Course packages (web, 2026-05-22). Admin-created multi-course bundles
  sold wallet-only; sale credits `wallets/platform-wallet`, per-instructor
  settlement is an owed/paid tally. Mobile unaffected (writes standard
  `accessScope: 'full'`). See `docs/COURSE_PACKAGES.md`.
- **Instructor earnings ledger + admin payouts (2026-05-22).** Sales no longer
  credit the instructor's spend wallet — they append an immutable earning
  entry to `users/{uid}/earningsLedger` with a snapshotted 70/30 split and
  bump `earningsTotal`. Admin records out-of-band payouts at
  `/admin-dashboard/instructor-payouts`; instructor self-view at
  `/user_dashboard/earnings`. Wired through standalone wallet, sectional
  per-section, sectional bundle, and ZainCash webhook paths. ZainCash earning
  write **unverified** end-to-end (`05e4df7`) — see
  `docs/INSTRUCTOR_PAYOUTS.md`.
- `sourcePackage: { id, title } | null` on `/api/me/enrollments` items
  (2026-05-22, `556c4f0`).
- **Legal pages + global footer (2026-05-24).** `/privacy-policy`,
  `/cookie-policy`, `/terms` rendered from `content/legal/*.md`; Arabic footer
  extracted from `app/page.tsx` into `components/Footer.tsx` and mounted in
  `app/layout.tsx`. Contact email `privacy@rubiktech.org`.
- Top-up wizard polish (2026-05-24, `1868184`) — trimmed subtitles and
  redundant alerts; fixed stale WhatsApp number (07886552919); replaced
  user-facing "ReadIQ" → "Rubik" in prefilled message, watermark fallback,
  favorites tab title.
- **Account self-deletion (2026-05-25).** Web page `/delete-account` (required
  for Play Console Data Safety) + `DELETE /api/me` (mobile). Shared service
  `lib/services/accountDeletion.ts` — refuses admins, instructors with
  courses, instructors with `earningsTotal > 0`, and instructors with
  unsettled `package_sales` payouts. Retains financial records (enrollments,
  wallet_transactions, topup_requests, payment_transactions, package_sales)
  per the updated privacy policy. Profile page links to it
  (`4e781e4`).
- **Brand logo + icons refresh (2026-05-28).** New toy-block Rubik mark across
  `app/icon.png`, `app/apple-icon.png`, `app/favicon.ico`; added
  `app/opengraph-image.png` (social cards had none before); footer swapped to
  `public/rubik-logo.png` (old `rubik-logo.svg` removed). Course pages now fall
  back to the brand OG image when a course has no thumbnail. Navbar wordmark
  unchanged. Mobile icons (`android-icon-*`, splash) pending in the mobile repo.

**Next milestone: Phase 7b — the React Native reader-app client.** Pure
client-side work in the separate `readiq-production-mobile` repo. See
"Decisions" and "Phase 8 backlog" below.

## Shipped commits (web repo)

- `9a43fc3` — Step 1: API foundation (`verifyBearerToken`, `lib/api/response.ts`, validation skeleton, `lib/R2/presignedUpload.ts`, `lib/mux/playbackToken.ts`, middleware matcher comment, `/api/health/me` smoke route)
- `386d15d` — Step 2: 8 read-only endpoints (`/api/me`, `/api/wallet`, `/api/wallet/transactions`, `/api/wallet/topup/history`, `/api/me/enrollments`, `/api/me/favorites`, `/api/courses`, `/api/courses/[courseId]`)
- `f8acbb5` — Step 3B: `POST /api/mux/playback-token` (signed Mux JWT issuer, RS256, ≤5 min TTL, owner/admin/free-preview/enrollment gate — dormant until Step 3.5 lands)
- `026ac29` — Step 4: profile + favorites writes (`PATCH /api/me`, `POST /api/me/favorites`, `DELETE /api/me/favorites/[courseId]`) + docs pass
- `ef0e629` — Step 5: wallet top-up flow with manual receipt upload (presigned R2 PUT + `topup_requests` write with `paymentMethod` + `receiptUrl`)
- `6e01b6b` — Step 6: enrollment purchase endpoint (`POST /api/enrollments`, free + paid, idempotent via `generateProtectionKey`) + project state docs
- `529b236` — Step 3.5-prep / Path D: owner + admin branches on `/api/mux/playback-token` (`route.ts`), bypass visibility gate + enrollment check; audit-log `reason=` field. New `MOBILE_API_TESTING.md` recipes c.1 (owner draft), c.2 (admin pending), expanded f) (VIDEO_NOT_READY).
- `ed43dab`–`e1db961` — Step 3.5 signed playback, substeps A–H, merged to `main`. `SignedMuxPlayer` / `SignedMuxThumbnail`, thumbnail token signing, all three web player surfaces migrated, free-preview removed (3.5.E), upload policy flipped to signed-only. `KeyLike` import error fixed in `6c4cb1d`.
- `2c85e6a` / `4a99c0b` — `POST /api/me`: bootstraps `users/{uid}` for mobile first-login. Merged.
- `e526aa6`–`0d4dc9f` — Sectional purchasing: Phases 2–6 on web (access gate, server-side purchase, section editor, section-aware player, buyer CTAs / checkout / bundle upsell) + Phase 7a sectional read parity on the mobile API. Phase 4 (ZainCash) deferred. Hotfix `3d56b24` rejects sectional courses from legacy `POST /api/enrollments`.

## In progress

Nothing in flight in the web repo. The mobile API surface is complete. Active
work moves to Phase 7b in the `readiq-production-mobile` repo (see "Decisions"
below).

## Decisions (newly documented — not previously in any doc or commit)

### Mobile is a reader-app — view-only. DECIDED, final.

The mobile app is **view-only**: Google login, "my courses", watch enrolled
videos, wallet balance display. **No purchase UI, no buy buttons, no in-app
prices.** Purchasing happens on the web only.

Rationale: the Apple App Store and Google Play require their own in-app
billing (15–30% cut) for digital goods sold in-app. Course access is a digital
good — there is no exemption (food-delivery / ride-hailing apps are exempt only
because they sell physical goods/services, not digital content). A single
static "help" link pointing to the web is permitted (the Netflix / Spotify
pattern). **There will be no mobile-side purchase endpoints, ever.**

### Phase 7b = the React Native reader-app client.

Consume the sectional read fields Phase 7a exposed, render the view-only UI,
ship to the App Store and Play Store. Pure client-side work — no backend
dependency. Repo: **`readiq-production-mobile`** (sibling working directory,
confirmed present). The legacy repo **`read-iraq-copy` is dead — do NOT touch
it.**

### Phase 4 (ZainCash sectional) deferred indefinitely.

Wallet-only launch. Documented in `docs/PHASE_4_ZAINCASH_DEFERRED.md`.

## Phase 8 backlog (none urgent — supersedes the old "Up next" item 5)

1. **Web-side Qi Card payment integration.** Qi Card is Iraq's largest card
   issuer — broader reach than ZainCash. Widens the web payment funnel; does
   not touch the App Store billing problem.
2. **ZainCash merchant API for automatic wallet top-up.** Eliminates the manual
   receipt-approval bottleneck. Merchant account already held.
3. **Six generic-toast catches** in `CourseDashboard.tsx` + `EnrollButton` /
   `favoritesButton` / wallet / topup — same Arabic-localization pattern as the
   recent error-message fix. Lower priority.
4. **Shared API serializers** (`lib/api/serializers/`) — extract on the next
   cross-cutting field change, not before.
5. **Server-side auth via the `firebaseAuthToken` cookie** — fixes a latent
   hydration race. Multi-week effort, not urgent.
Already done, removed from the old "Up next" item 5: the ESLint config typo
(`ban-ts-comment`) was fixed in `59bec8e` (2026-05-16); the `jose` `KeyLike`
import error was fixed in `6c4cb1d`; the audit-log wording and Radix dialog
a11y items shipped with the Step 3.5 merge. CLAUDE.md trim completed
2026-05-25.

## Sectional purchasing — invariants

The seven non-negotiable invariants for sectional purchasing — and their
consequences — live in the `sectional-invariants` skill
(`.claude/skills/sectional-invariants/SKILL.md`), the single source of truth.
Read it before any sectional work, web or mobile.

## Key decisions log

- **Wallet-only payment.** ZainCash is deprecated and frozen for the migration; it gets removed in a post-mobile cleanup PR.
- **Mobile-only video viewing.** The web Mux player is throwaway. The `/Course/[courseId]` web viewer route is scheduled for deletion after mobile launches.
- **Manual top-up via receipt upload.** No automated payment provider. Students upload a receipt image to R2 via a presigned URL; admins approve in the existing dashboard.
- **Search deferred to Algolia post-v1.** Firestore can't do free-text efficiently and prefix-match would mislead users. Mobile v1 ships with category/level filters only.
- **Step 3 split into 3B (endpoint) + 3.5 (web migration).** The original Step 3 bundled the playback-token endpoint with flipping uploads to signed playback. Flipping uploads standalone would silently break the three existing web Mux player surfaces, so the endpoint shipped first (3B) and the surface migration + upload flip is its own scoped step (3.5).
- **Step 3.5 deferred (Path C), then reversed 2026-05-02 — shipped.** Considered shipping immediately (A), skipping forever (B), deferring (C), or doing route-only prep work (D). Picked deferral, then reversed to ship-now ahead of mobile scaffolding. All substeps merged. Full threat model, decision rationale, and migration gotchas in `docs/archive/STEP_3_5_AUDIT.md`.
- **Course ownership = `createdBy` field (Firebase uid), no co-instructors.** Confirmed by the web-side audit. `instructorName` is a denormalized display field, not authoritative. Global admin override via `verifiedToken.admin === true`.
- **Mux signing key incident (2026-05-01, twice same day).** First exposure: during Path D verification testing, the Mux signing key was unintentionally pasted into the conversation history; rotated immediately. Second exposure (same day, post-rotation): `.env.local` was the active IDE selection during a later session, and the IDE auto-share surfaced both `MUX_SIGNING_KEY_ID` and `MUX_SIGNING_PRIVATE_KEY` (PKCS#8 base64) into a system-reminder tool message. Rotated again. Going forward: (a) never paste secrets, real or example, into any chat or commit message; (b) when describing key format, describe the SHAPE only (length, header line, base64 vs PEM) — never the value; (c) **do not keep `.env.local` open as the active editor selection during AI-assisted sessions** — the IDE forwards the selected file to tool context. Both leak windows were minutes, scope was Mux playback signing only (no AWS/Firebase/R2/payments), no exposed playback IDs in the public catalog, post-rotation impact = zero. Lesson logged.

## Step 3.5 audit, DRM threat scope, web instructor flow (pre-3.5)

Pre-shipping audit, threat model, migration gotchas, decision rationale (Paths
A/B/C/D), implementation findings, re-evaluation triggers, and the
pre-Step-3.5 web instructor flow snapshot — all archived as historical record
to `docs/archive/STEP_3_5_AUDIT.md`. Step 3.5 is fully shipped; nothing in
that file is current guidance.

## Free preview: enabled for signed-in users, web + mobile; anonymous preview deferred

**Status (2026-05-21):** free-preview is **enabled for signed-in users across web and mobile**. Anonymous (signed-out) free-preview is deliberately **not** implemented.

Full history, the Option A reversal record, and the Option B (anonymous) playbook live in `docs/FREE_PREVIEW_REMOVAL.md` — the single source of truth for this area.

Short version:

- The backend playback-token route **always** granted free-preview to any authenticated caller — the `isFreePreview` bypass was never removed. (An earlier claim here that 3.5.E made the gate "zero exception cases / enrolled-only" was wrong and has been corrected in `FREE_PREVIEW_REMOVAL.md`.)
- 3.5.E (2026-05-03) removed only the free-preview **player UI in `components/CoursePreview.tsx`**, producing an unintended split: backend grants, mobile shows, web hides.
- Option A (2026-05-21) restored the web player for **signed-in** visitors via `SignedMuxPlayer` + `useMuxPlaybackToken`, keyed off the per-video `isFreePreview` flag. Signed-out visitors get a sign-in prompt and trigger no token request. Free-preview plays regardless of section ownership on sectional courses (it is the highest-priority unlock rule). The route was rate-limited (per-user, fail-open) in the preceding PR.
- The Firestore course-level `freePreviewVideo` field remains retained dead data (not used by the web player) — see `docs/MANUAL_CLEANUP_DO_NOT_AUTOMATE.md`.
- Option B (an anonymous/unauthenticated token branch) stays deferred — only revisit at 500+ users with conversion evidence; see `FREE_PREVIEW_REMOVAL.md`.

---

This file gets updated at the end of every step. Treat it as a living document.

## Auth migration log

2026-05-01 — Email/password sign-in hidden from UI. All 10 production customers were already on Google sign-in. Login and register pages now show only the Google button. Forgot-password link removed (route still reachable by direct URL but unused). Update-password tab in user dashboard sidebar removed. Email/password code paths (loginWithEmail in authContext.tsx, RegisterAction server action, signInWithEmailAndPassword import) intentionally left in place for a one-week rollback window. Cleanup PR scheduled for 2026-05-08+ after confirming no customer-support issues.
