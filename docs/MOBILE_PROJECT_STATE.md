# Readiq Mobile Project State
Last updated: 2026-05-01

## Where we are

**Web API surface is complete.** All 14 mobile-facing endpoints are shipped on
`main` (Steps 1, 2, 3B, 4, 5, 6), plus Step 3.5-prep (Path D) which added
owner + admin branches to `/api/mux/playback-token`. The web repo is
feature-frozen for the mobile migration except for the remaining Step 3.5
work (wrapper + 3 surface migration + thumbnail signing + upload-policy
flip), which is deferred until just before the mobile player screen is
built.

Next milestone: scaffold the Expo mobile app in a new repo (`readiq-mobile`).
The scaffold prompt is staged in personal notes and will be pasted into a fresh
Claude Code session in that new working directory.

## Shipped commits (web repo)

- `9a43fc3` — Step 1: API foundation (`verifyBearerToken`, `lib/api/response.ts`, validation skeleton, `lib/R2/presignedUpload.ts`, `lib/mux/playbackToken.ts`, middleware matcher comment, `/api/health/me` smoke route)
- `386d15d` — Step 2: 8 read-only endpoints (`/api/me`, `/api/wallet`, `/api/wallet/transactions`, `/api/wallet/topup/history`, `/api/me/enrollments`, `/api/me/favorites`, `/api/courses`, `/api/courses/[courseId]`)
- `f8acbb5` — Step 3B: `POST /api/mux/playback-token` (signed Mux JWT issuer, RS256, ≤5 min TTL, owner/admin/free-preview/enrollment gate — dormant until Step 3.5 lands)
- `026ac29` — Step 4: profile + favorites writes (`PATCH /api/me`, `POST /api/me/favorites`, `DELETE /api/me/favorites/[courseId]`) + docs pass
- `ef0e629` — Step 5: wallet top-up flow with manual receipt upload (presigned R2 PUT + `topup_requests` write with `paymentMethod` + `receiptUrl`)
- `6e01b6b` — Step 6: enrollment purchase endpoint (`POST /api/enrollments`, free + paid, idempotent via `generateProtectionKey`) + project state docs
- _(unstaged)_ — Step 3.5-prep / Path D: owner + admin branches on `/api/mux/playback-token` (`route.ts`), bypass visibility gate + enrollment check; audit-log `reason=` field. New `MOBILE_API_TESTING.md` recipes c.1 (owner draft), c.2 (admin pending), expanded f) (VIDEO_NOT_READY).

## In progress

Path D (Mux playback-token owner/admin branch) is half-done and uncommitted. Code change is in `app/api/mux/playback-token/route.ts` locally. Two blocking issues prevent commit:

- **`.env.local` whitespace bug.** Lines `MUX_SIGNING_KEY_ID` and `MUX_SIGNING_PRIVATE_KEY` have leading characters that look like 4 spaces but resist `sed -i 's/^[[:space:]]*...//'`. Suggests the indent is NBSP, tab, or another whitespace variant. Need to inspect with `xxd` or rewrite the file in a different editor.
- **Mux private key is PKCS#1, not PKCS#8.** Mux dashboard issued `-----BEGIN RSA PRIVATE KEY-----`. The `lib/mux/playbackToken.ts` helper (jose's `importPKCS8`) only accepts PKCS#8. Two ways to fix: convert with `openssl pkcs8 -topk8 -nocrypt`, or change the helper to use Node's `crypto.createPrivateKey` which accepts both formats. Decided against changing the helper to avoid altering a security-critical code path. Will run the openssl conversion next session.

Once both issues are resolved and T3 returns 200 with a real signed JWT, Path D commits and the chapter closes.

## Up next

1. **Resolve Path D blockers (~30 min next session).** In order: (a) inspect `.env.local` indent characters with `xxd` and rewrite the two MUX_SIGNING_* lines from scratch in a known editor, (b) base64-decode the existing key to a temp PEM file, (c) `openssl pkcs8 -topk8 -nocrypt -in /tmp/mux-pkcs1.pem -out /tmp/mux-pkcs8.pem`, (d) re-encode with `base64 -w0` and update the env var, (e) restart dev server, (f) confirm T3 returns 200, (g) commit Path D.
2. **Scaffold `readiq-mobile`** — fresh Expo (managed) project in a new repo. Scaffold prompt is staged in personal notes.
3. **Step 3.5 (web repo)** — must land *before* the mobile player screen is built. Scope (reduced — route work is now done in 3.5-prep): `SignedMuxPlayer` wrapper, `useMuxPlaybackToken` hook, thumbnail-token handling (separate JWT, `aud:"t"`), replace the three direct `<MuxPlayer />` call sites (`components/video_uploader.tsx:857`, `components/CoursePreview.tsx:326`, `components/ui/CoursePlayer.tsx:644`), then flip `createMuxUpload` to `playback_policy: ["signed"]`. Unblocks production Mux signing for both web and mobile.
4. **Mobile feature build-out** — courses list, course detail, enrollment purchase, wallet + top-up upload, favorites, profile, signed Mux player screen (after 3.5).
5. **Post-mobile cleanup PRs** (each separate, after the mobile app is live): delete the web `/Course/[courseId]` viewer, remove all ZainCash code, update `/admin-dashboard/topup-approvals` to display `paymentMethod` + `receiptUrl`, ship iOS screen-capture detection (mobile v1.1), document the Mux signing-key rotation policy, remove `/api/health/me`.

## Key decisions log

- **Wallet-only payment.** ZainCash is deprecated and frozen for the migration; it gets removed in a post-mobile cleanup PR.
- **Mobile-only video viewing.** The web Mux player is throwaway. The `/Course/[courseId]` web viewer route is scheduled for deletion after mobile launches.
- **Manual top-up via receipt upload.** No automated payment provider. Students upload a receipt image to R2 via a presigned URL; admins approve in the existing dashboard.
- **Search deferred to Algolia post-v1.** Firestore can't do free-text efficiently and prefix-match would mislead users. Mobile v1 ships with category/level filters only.
- **Step 3 split into 3B (endpoint) + 3.5 (web migration).** The original Step 3 bundled the playback-token endpoint with flipping uploads to signed playback. Flipping uploads standalone would silently break the three existing web Mux player surfaces, so the endpoint shipped first (3B) and the surface migration + upload flip is its own scoped step (3.5).
- **Step 3.5 deferred (Path C), not skipped (Path B).** Considered shipping 3.5 immediately (Path A), skipping it forever (Path B), or doing nothing (no Path D=do route work only). Picked deferral until the week before the mobile player screen is built. Threat model and rationale documented in the "Step 3.5 — audit & decision rationale" section below. Re-evaluate immediately if any of: a leak incident occurs, course price crosses ~$50/course equivalent, an instructor contract requires DRM, or the mobile timeline compresses to <2 weeks.
- **Course ownership = `createdBy` field (Firebase uid), no co-instructors.** Confirmed by the web-side audit. `instructorName` is a denormalized display field, not authoritative. Global admin override via `verifiedToken.admin === true`.
- **Mux signing key incident (2026-05-01).** During Path D verification testing, the Mux signing key was unintentionally pasted into the conversation history. The key was rotated immediately. Going forward: (a) never paste secrets, real or example, into any chat or commit message; (b) when describing key format, describe the SHAPE only (length, header line, base64 vs PEM) — never the value. The leak window was minutes, scope was Mux playback signing only (no AWS/Firebase/R2/payments), no exposed playback IDs in the public catalog, post-rotation impact = zero. Lesson logged.

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

### Re-evaluation triggers

Drop everything and ship Path A immediately if any of these become true:

- A leak incident is observed (Telegram channel reposting your courses, m3u8 URLs shared publicly).
- Single course price crosses ~$50 USD equivalent.
- Any instructor contract requires DRM.
- A B2B / enterprise / multi-seat tier is added to the product.
- Mobile launch timeline compresses to under 2 weeks (the deferral window is no longer worth the context-switch cost).

---

This file gets updated at the end of every step. Treat it as a living document.
