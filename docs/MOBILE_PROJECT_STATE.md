# Readiq Mobile Project State
Last updated: 2026-05-21

## Where we are

**The web repo's mobile API surface is complete and signed playback is fully
shipped.** Everything below is merged to `main`:

- Steps 1–6 — mobile API foundation + 14 endpoints (read-only, profile/favorites
  writes, top-up flow, enrollment purchase).
- Step 3.5 signed playback — all substeps A–H, merged via `e1db961`.
- `POST /api/me` user bootstrap — merged via `4a99c0b`.
- Sectional purchasing — Phases 1–6 on web, Phase 7a (mobile API read parity).
- Polish since: wallet top-up wizard, sectional price unification, error
  localization, `user_dashboard` nav perf.

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
below). The Step 3.5 substep-by-substep history is retained in the
"Step 3.5 — audit & decision rationale" section further down.

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
a11y items shipped with the Step 3.5 merge.

## Sectional purchasing — invariants

Any future sectional work (web or mobile) must respect these seven invariants:

1. Only `course.purchaseMode === 'sectional'` activates sectional logic — the
   presence of `sections[]` is **not** a signal.
2. `enrollment.accessScope` is the single source of truth for access.
3. An unset `accessScope` means grandfathered full access — **never overwrite it.**
4. A bundle buyer writes `accessScope: 'full'`.
5. A per-section buyer writes `accessScope: 'sectional'` and merges into
   `ownedSectionIds[]`.
6. The server rejects a per-section buy when `accessScope !== 'sectional'`.
7. Once a `sectionId` is sold it is immutable; `purchaseMode` locks at the
   first sale or first enrollment.

## Key decisions log

- **Wallet-only payment.** ZainCash is deprecated and frozen for the migration; it gets removed in a post-mobile cleanup PR.
- **Mobile-only video viewing.** The web Mux player is throwaway. The `/Course/[courseId]` web viewer route is scheduled for deletion after mobile launches.
- **Manual top-up via receipt upload.** No automated payment provider. Students upload a receipt image to R2 via a presigned URL; admins approve in the existing dashboard.
- **Search deferred to Algolia post-v1.** Firestore can't do free-text efficiently and prefix-match would mislead users. Mobile v1 ships with category/level filters only.
- **Step 3 split into 3B (endpoint) + 3.5 (web migration).** The original Step 3 bundled the playback-token endpoint with flipping uploads to signed playback. Flipping uploads standalone would silently break the three existing web Mux player surfaces, so the endpoint shipped first (3B) and the surface migration + upload flip is its own scoped step (3.5).
- **Step 3.5 deferred (Path C), not skipped (Path B).** **Superseded 2026-05-02.** Decision reversed — Step 3.5 is now the next milestone, ahead of mobile scaffolding. See 'DRM strategy and threat scope' below for current rationale. This entry retained as historical record. Considered shipping 3.5 immediately (Path A), skipping it forever (Path B), or doing nothing (no Path D=do route work only). Picked deferral until the week before the mobile player screen is built. Threat model and rationale documented in the "Step 3.5 — audit & decision rationale" section below. Re-evaluate immediately if any of: a leak incident occurs, course price crosses ~$50/course equivalent, an instructor contract requires DRM, or the mobile timeline compresses to <2 weeks.
- **Course ownership = `createdBy` field (Firebase uid), no co-instructors.** Confirmed by the web-side audit. `instructorName` is a denormalized display field, not authoritative. Global admin override via `verifiedToken.admin === true`.
- **Mux signing key incident (2026-05-01, twice same day).** First exposure: during Path D verification testing, the Mux signing key was unintentionally pasted into the conversation history; rotated immediately. Second exposure (same day, post-rotation): `.env.local` was the active IDE selection during a later session, and the IDE auto-share surfaced both `MUX_SIGNING_KEY_ID` and `MUX_SIGNING_PRIVATE_KEY` (PKCS#8 base64) into a system-reminder tool message. Rotated again. Going forward: (a) never paste secrets, real or example, into any chat or commit message; (b) when describing key format, describe the SHAPE only (length, header line, base64 vs PEM) — never the value; (c) **do not keep `.env.local` open as the active editor selection during AI-assisted sessions** — the IDE forwards the selected file to tool context. Both leak windows were minutes, scope was Mux playback signing only (no AWS/Firebase/R2/payments), no exposed playback IDs in the public catalog, post-rotation impact = zero. Lesson logged.

## Web instructor flow status

> **Historical (pre-2026-05).** This section described the web instructor flow
> *before* Step 3.5 and sectional purchasing shipped. Both have since landed on
> `main`: the three web player surfaces were migrated to signed playback and the
> instructor/course UI gained sectional editing. The "Operational guidance until
> Step 3.5 lands" sub-section below ("DO NOT upload production videos yet") is
> **obsolete** — Step 3.5 shipped and new uploads are signed-only. Retained for history.

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

## Step 3.5 — audit & decision rationale

Background: read-only audit done 2026-05-01 to decide whether to ship 3.5 immediately, defer to week-before-mobile-launch, or skip forever. Decision was deferral (Path C) plus an optional pre-3.5 quickwin (Path D, the route-only work). This section captures the threat model and migration gotchas so the eventual 3.5 PR doesn't have to re-derive them under deadline pressure.

### Threat model — what signed playback actually defends against

| Threat | Defended by signed playback? |
|---|---|
| Casual student shares m3u8 link with 3 friends (Discord/WhatsApp) | **YES** — JWT is bound to a single playbackId via `aud:"v"` and a 2-hour TTL; friends without their own enrollment cannot get one |
| Enrolled student uses yt-dlp / ffmpeg to download the course | **NO** — they hold a valid token by definition. Watermark in `components/VideoWatermark.tsx` is DOM overlay, not burned into the asset, so it does NOT survive extraction |
| Competitor scrapes the catalog for paid video URLs | **NO existing leak** — `/api/courses` and `/api/courses/[id]` only return `playbackId` when `isFreePreview === true` |
| Organized re-upload to YouTube/Telegram piracy channels | Slows by minutes per video, does not stop |

The link-sharing case is the only one signed playback genuinely closes. Everything else is defended by other things (catalog filtering, watermarks, legal language, FLAG_SECURE on Android) or not defended at all.

FLAG_SECURE on Android prevents OS-level screen capture and the task switcher snapshot. It does NOT prevent: pointing a second phone at the screen, screencap on rooted/Magisk devices, MITM the HLS traffic with a custom CA on a rooted device.

### Concrete attack scenarios to work on

These are the three realistic attack patterns the post-3.5 hardening plan needs to address. Signed playback alone (the Step 3.5 deliverable) is a necessary precondition for all three but not a sufficient defense for any of them. Each scenario is documented with what's exposed today, what 3.5 closes, and what additional work remains open.

**Scenario 1 — Mass playback-ID dump after a refund dispute.**
A student is denied a refund, opens DevTools (or proxies the mobile app's traffic), enumerates every `playbackId` they can see, and posts the full list to a public Telegram/Discord/Reddit thread. With current public-policy assets, every reader of that post has a permanent direct stream URL — no enrollment, no auth, no expiry. After 3.5: the bare playback IDs are useless to non-enrollees because the JWT issuer requires an enrolled session, but the *enrolled* attacker can still dump the IDs alongside their own valid token (token TTL ≤ 5 min limits the blast radius per leak, but they can re-mint indefinitely). Work to do: (a) rate-limit `/api/mux/playback-token` per user per course (e.g. ≥ N tokens/hour triggers an audit-log alert + soft-throttle), (b) burn-on-leak workflow — the audit log already has `reason=enrolled` per Path D; add a per-`(userId, courseId)` token-mint counter so abnormal mint rates surface without manual log-grepping, (c) document the takedown playbook (which Mux dashboard pages, which DMCA template, which support contact).

**Scenario 2 — Course-sharing ring among enrolled students.**
Two or more students each enroll in different courses, then trade login credentials or playback URLs amongst themselves. Each paid for one course, each watches all of them. This scales linearly with friend-group size and is the highest-volume realistic threat — it's not piracy, it's "I'm helping my friend study." Signed playback does NOT close this: each shared session presents a valid enrolled token. Work to do: (a) bind sessions to device — refresh-token rotation on the mobile client tied to a stable device fingerprint (Firebase installation ID is the natural primary key), so a single account streaming from N devices simultaneously is detectable, (b) concurrent-session cap per `userId` (1 active player session, kick the older one), (c) per-course completion telemetry — if a `userId` watches 10× more video minutes than they have enrollments for, it's a sharing ring. Open question: how strict is acceptable UX-wise? Some students legitimately switch between phone and tablet. Probably 2 concurrent devices with logout-on-third is the right starting point.

**Scenario 3 — Competitor scraper rebrands and resells.**
A rival platform pays for one enrollment, uses yt-dlp + ffmpeg to pull every video in the course catalog they can reach, slaps their own watermark on, and lists the same content cheaper. Signed playback does NOT close this — they're a paying enrollee with a valid token, and `components/VideoWatermark.tsx` is a DOM overlay that strips on extraction. Work to do: (a) burn watermark into the video itself at Mux ingest time (per-user watermarking is expensive — a per-*course* watermark with the platform brand is the cheap baseline; per-user is the upgrade if a leak is traced), (b) shrink the per-account exposure surface — one enrollment ≠ access to other courses' playback IDs (already true today via `/api/courses` filter, keep it true), (c) legal: terms-of-service clause prohibiting redistribution, plus a DMCA-able copyright registration on the course content, (d) detection — periodic reverse-image search on course thumbnails and brand mentions across known competitor sites. Honest acknowledgment: this scenario is partially undefendable at the technical layer. Watermarking + legal recourse is the realistic ceiling; the goal is to make it expensive and traceable, not impossible.

### Why Path C (defer to week before mobile launch)

**Superseded 2026-05-02.** Decision reversed — Step 3.5 is now the next milestone, ahead of mobile scaffolding. See 'DRM strategy and threat scope' below for current rationale. This entry retained as historical record.

- Zero coupling between current mobile work and 3.5. The mobile API surface already shipped does not touch any signed-playback code path. Mobile screens (auth → catalog → enrollment → wallet → my-courses) come before the player screen, which is the LAST thing built and the only consumer of `/api/mux/playback-token`.
- Mux upload policy can't be undone per-asset, so the "do it now to keep the asset population pure" argument is fictional unless course publishing is paused for 4–6 weeks. The wrapper has to handle a two-tier (legacy public + new signed) state regardless.
- Doing 3.5 today means shipping the wrapper 4–6 weeks before its consumer (mobile player) exists. Edge cases get learned twice — once in cold review now, once when integrating with a real mobile player later. Path C lets that learning happen once, in context.

### Why NOT Path B (skip forever)

Path B would be defensible if ALL of: courses stay sub-$25, customer base stays narrow, no enterprise/B2B tier ever, no instructor contract requires DRM, no leak incident. Locking in that architectural state without those constraints being permanent business decisions is a bet that's expensive to reverse — every subscriber-facing screen would need retrofitting under launch pressure.

### Migration gotchas (read this before opening the 3.5 PR)

1. **The route's visibility filter blocks the instructor preview flow.** `app/api/mux/playback-token/route.ts:22` short-circuits `404 COURSE_NOT_FOUND` for any course where `isCoursePubliclyVisible === false`. But `components/video_uploader.tsx:857` plays videos for an instructor on a course that is being created/edited and is typically `status === "draft"`. Flipping upload policy to signed without first adding owner + admin branches in this route silently breaks instructor preview the moment they upload to a draft course. Smoke testing on a published course will not catch this. (This is the work Path D would do early.)

2. **`CoursePlayer.tsx` does nontrivial DOM manipulation around the player.** Lines 222–281 hand-walk the DOM to relocate `.watermark-container` between the video container and `document.fullscreenElement`. Lines 877–884 use `:fullscreen` CSS selectors against `.video-container`. The wrapper must:
   - Render `<MuxPlayer>` as the actual element (do not wrap it in an extra div that breaks the `.video-container` selector chain).
   - Pass `className`, `metadata`, `onEnded`, `streamType` through cleanly.
   - Forward refs if any future code needs programmatic playback control.
   - Critically: `onEnded={() => { handleVideoComplete(); goToNextVideo(); }}` at line 652 chains progress save (Firestore) + autoplay-next. If the wrapper swallows this prop, completion silently fails and the bug presents as "Firestore is broken."

3. **Mux thumbnails are also gated by signed policy.** `components/video_uploader.tsx:741` uses `https://image.mux.com/${video.playbackId}/thumbnail.jpg?time=0` directly. If upload policy flips and thumbnails are not signed (separate JWT, `aud:"t"`), every uploaded-videos list breaks with broken-image icons. Before flipping, grep for `image.mux.com` across `components/`, `app/`, and any course-card / catalog surfaces — assume there are more call sites than just `video_uploader.tsx`.

4. **`useVideoUpload` polls Mux for `playbackId` after upload.** The instructor preview can request a signed token in the window between upload completion and asset-ready. The route already returns `409 VIDEO_NOT_READY` for this — the wrapper must handle that gracefully (retry / show "processing" state) without poisoning player state.

5. **Existing test videos stay public-policy and keep working.** The 17 videos on "From Diagnosis to Extraction" and the Exoplan course are dev/test content and will be re-uploaded under signed policy after 3.5 lands. The wrapper falls back to unsigned playback when the token endpoint returns null/legacy marker for these. Do not retroactively migrate them — Mux does not let you flip an asset's policy.

### Path D — the pre-3.5 quickwin (DONE)

Shipped. Owner + admin branches added to `/api/mux/playback-token`. Both bypass the visibility gate AND the enrollment check, so owners can preview drafts and admins can review pending courses. Audit log gains a `reason=owner|admin|free-preview|enrolled` field for greppability.

The remaining gotchas (#2 CoursePlayer DOM, #3 thumbnail call sites, #4 VIDEO_NOT_READY race in the wrapper, #5 legacy public assets) are still TODO for the eventual Step 3.5 PR. Gotcha #1 (route visibility filter blocking instructor preview on drafts) is now resolved by the owner branch.

### Implementation findings during 3.5.A–D (read before picking up 3.5.E)

These are non-obvious things discovered during the 3.5.A–D implementation that the audit didn't predict. Future-Claude (or future-Ali) picking up 3.5.E should know them before touching the wrapper or the hook.

1. **The `@mux/mux-player-react` 3.x API is `tokens={{ playback, thumbnail, storyboard, drm }}`, NOT separate `playbackToken` / `thumbnailToken` props.** The original 3.5 plan in `MOBILE_API_MIGRATION.md` had the wrong shape; it was fixed in `1e63f36`. Don't regress this if you re-read the older plan and copy-paste from it.

2. **The wrapper's "no token + no error → render unsigned" branch (case 4 in the original 3.5.B spec) is unreachable on initial load** because `useState(false)` for `isLoading` meant the first render painted before the effect ran, which flashed a 403 on signed assets. Fixed in `784d360` by (a) starting `isLoading` true via a lazy initializer when the hook will fetch, and (b) gating the wrapper on `isLoading && !token && !error` → placeholder. The trade-off: until the API gains an explicit "this asset is legacy public, no token needed" signal (Step 3.5 scope section 5 in the migration plan), the legacy-public fallback in the original spec is technically only reachable mid-stream after a successful first fetch. Today the API always returns either a token or an error, so the deferred work is just a future-proofing concern, not a current bug.

3. **Mid-video-swap flash is still possible** when a consumer changes `videoId` on a mounted `SignedMuxPlayer` or `SignedMuxThumbnail`. The hook does not clear `token`/`thumbnailToken`/`expiresAt` when `(courseId, videoId)` change, so for ~200ms the wrapper renders the new `playbackId` against the previous video's tokens. Doesn't matter for `video_uploader` (3.5.D — each card is keyed by `videoId`, so swap → unmount/remount) or `CoursePreview` (3.5.E — single video at a time). **Does matter for `CoursePlayer.tsx` (3.5.F — auto-advances between videos).** Fix when picking up 3.5.F: in `useMuxPlaybackToken`, distinguish "input change" from "refetch trigger" via a ref-tracked input signature, and reset transient token state on input change but not on refetch.

4. **Each `SignedMuxPlayer` and `SignedMuxThumbnail` mount triggers an independent fetch to `/api/mux/playback-token` for the same `(courseId, videoId)`.** When both render together (instructor preview card with player expanded), the route receives two requests, signs two pairs of JWTs, and writes two audit-log lines. Wasteful but not broken. If 3.5.G's catalog/dashboard sweeps surface enough thumbnail-only call sites to amplify this — e.g. a catalog page rendering 30 thumbnails — add a module-level promise cache keyed by `(courseId, videoId)` to the hook to deduplicate. Don't pre-build it; assess after 3.5.G.

5. **`jose` no longer exports `KeyLike`** in the version installed (whichever 6.x). `lib/mux/playbackToken.ts(1,37)` carries a pre-existing TS error from this. The new `lib/mux/thumbnailToken.ts` sidesteps it by typing the cache as `ReturnType<typeof importPKCS8>`. Real fix is one line in `playbackToken.ts` — remove the `KeyLike` import and apply the same pattern. Listed in "Up next" item 5 above; not blocking.

6. **The route's audit-log line still reads `mux-playback issued`** despite the route now minting two JWTs per request (after 3.5.C). Functional but slightly misleading. Listed in "Up next" item 5.

7. **`SignedMuxThumbnail` is the established pattern for any `image.mux.com` call site.** It's a drop-in replacement for `next/image` with `{ courseId, videoId, playbackId, time? }` added and `src` removed; it handles fill-mode and static-mode placeholders (`bg-neutral-800 animate-pulse`). 3.5.G's grep-and-replace work uses this component — don't re-build inline signed-thumbnail logic at each call site.

8. **Mux signing helpers (`lib/mux/playbackToken.ts`, `lib/mux/thumbnailToken.ts`) are now formally protected** in `MANUAL_CLEANUP_DO_NOT_AUTOMATE.md` under a scope block with no rollback timer. The protection rationale is "casual modifications to signing code can silently break video access for every customer," not "pending deletion." Don't refactor or extract a shared loader without an explicit instruction.

### Re-evaluation triggers

Drop everything and ship Path A immediately if any of these become true:

- A leak incident is observed (Telegram channel reposting your courses, m3u8 URLs shared publicly).
- Single course price crosses ~$50 USD equivalent.
- Any instructor contract requires DRM.
- A B2B / enterprise / multi-seat tier is added to the product.
- Mobile launch timeline compresses to under 2 weeks (the deferral window is no longer worth the context-switch cost).
- Scenario 3 mitigations (per-user watermarking, device-binding, concurrent-session caps) are reactive defenses. Scope them ONLY when: (a) the platform has 10+ paying customers AND (b) there is documented evidence of catalog scraping or sharing-ring abuse. Do not pre-build at current scale.

## DRM strategy and threat scope

After 3.5 + mobile launch, the DRM posture is: A+ for stopping URL link-sharing (the loud, scalable, embarrassing attack), B+ for stopping casual credential-sharing among friends, C for stopping a determined enrolled paying user with technical knowledge (impossible to fully solve, true for every platform on Earth including Netflix/HBO), F for stopping content repackaging via AI summarization (also impossible, also true everywhere). The goal is not zero piracy. The goal is "leaking is annoying enough that paying is easier." That is a realistic and successful DRM outcome for an Iraqi-market dental/medical e-learning platform.

### What 3.5 actually changes for users

- Existing 10 paying customers: zero perceptible change. Old videos uploaded before 3.5 stay public-policy in Mux and continue playing through the new wrapper component. Maybe a 200-300ms delay on first play of new signed videos. Nothing else.
- Instructors: same upload UI, same flow. Owner branch in `/api/mux/playback-token` (shipped in Path D) lets them preview their own draft/unpublished course videos.
- Old uploaded videos (the 17 in "From Diagnosis to Extraction", the Exoplan course): stay public-policy permanently. Mux does not allow flipping an existing asset's policy. They are dev/test content per existing project notes; real production content will be uploaded after 3.5 lands.
- New uploads (after 3.5): signed-policy only. No public m3u8 URL exists for them.

### What 3.5 does NOT change

- Old public-policy assets remain leakable via direct Mux URL until they are deleted and re-uploaded.
- A determined enrolled student can still extract video via screen-record or yt-dlp-with-token.
- Friend-credential-sharing (Scenario 2) is reduced by Google-only auth + mobile-only viewing, not eliminated.

Scenario 3 mitigations (catalog scraping by a competitor) are deferred until the platform reaches 10+ paying customers AND there is evidence of actual abuse. Pre-building reactive defenses (per-user watermarking, device-binding, concurrent-session caps) at current scale is over-engineering. They will be scoped when there is a real attack to defend against, not before.

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
