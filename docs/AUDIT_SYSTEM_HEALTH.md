# AUDIT: System Health — Production Readiness Diagnosis

**Date:** 2026-07-15 · **Mode:** read-only diagnosis, no code changed in this run.
**Trigger:** two live symptoms with real paying students: (1) admin sees sectional
"شراء هذا القسم" buy UI on courses they have full access to; (2) sessions/pages left
open a long time develop login and refresh failures.
**Method:** manual trace of both symptoms plus five scoped sweeps (access-control
matrix, token lifecycle, money paths, production hygiene, state freshness). Every
finding cites file:line from the working tree at commit `8817748`. Severity:
**P0** = students blocked or money wrong · **P1** = degraded experience · **P2** = hygiene.

Files flagged **OWNER-ONLY** (`middleware.ts`, `context/authContext.tsx`,
`app/(auth)/**`) are edit-protected; fixes touching them need the owner.

---

## Executive summary — top 5 by severity

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| 1 | **P0** | `purchaseCourseWithWallet` has **no `purchaseMode` gate**. Calling it directly on a sectional course (server actions are HTTP-invokable) creates a completed enrollment with **no `accessScope`** → grandfathered **full access** per invariant 3. With `course.price` unset (typical for sectional — pricing lives in `sections[].price`/`fullCoursePrice`), `coursePrice = courseData?.price \|\| 0` → **full course for 0 IQD**; with `price` set, full access at the wrong (non-bundle) price. | `app/actions/wallet_actions.ts:149` (price fallback), `:155-176` (only isFree/enrollment checks — zero `purchaseMode` occurrences in file), `:282-296` (enrollment written without `accessScope`) |
| 2 | **P0-LATENT** | **Firestore security rules are not in the repo** (no `firestore.rules`, `firebase.json`, `.firebaserc` — glob-verified) while the browser client **writes `users/{uid}` directly** on every sign-in, and the earnings split **trusts `revenueSharePercent` read from that same doc**. If the console-side rules allow whole-doc self-writes (the naive rule that makes the client code work), an instructor can set their own share to 100% before a sale, and `walletBalance`/`earningsTotal` fields on the doc are client-writable. Unverifiable from the repo — that is itself the finding. Must be checked in the Firebase console. | `lib/services/userService.ts:58,73` (client `setDoc`/`updateDoc`), `context/authContext.tsx:166` (fires each sign-in), `lib/earnings/recordEarning.ts:64-67` (split trusts the doc), `components/WalletBalance.tsx:22` (client also needs `wallets/{uid}` read) |
| 3 | **P1** | **Session lifecycle (= Symptom 2, and a mass generator of Symptom-1-family reports).** The auth cookie lives exactly one hour (`maxAge: 60*60`) and its only renewal is a 60-second `setInterval` in the client — no `onIdTokenChanged`, no `visibilitychange`/focus handler (grep-verified: zero matches repo-wide). Background-tab throttling (~1 wake/hour) and laptop sleep miss the 5-minute pre-expiry window, the cookie lapses, and: matched routes bounce to `/login`; **unmatched routes like `/course/[courseId]` render the logged-out `CoursePreview` — an enrolled student sees enroll/buy UI on a course they paid for** while the navbar still shows them signed in. Separately, the main player's 2-hour Mux token is minted once per lesson with no expiry tracking and no error recovery — a lesson idle >2h is a dead player. | `context/actions.ts:35` (cookie=1h), `context/authContext.tsx:138,153` (interval-only renewal), `middleware.ts:56-61,65-75` (login bounce; refresh route reachable only in last 5 min), `app/course/[courseId]/page.tsx:150-161` (no token → preview), `components/player/VideoStage.tsx:149-223` (one-shot mint), `app/api/mux/playback-token/route.ts:11` (TTL 7200) |
| 4 | **P1** | **Concurrent double-debit family.** Sectional section purchase, bundle purchase, and time-limited renewal all validate ownership/`ALREADY_FULL_ACCESS`/price **outside** the transaction and never re-read the enrollment inside it; each click mints a fresh `protectionKey` (`..._${Date.now()}`), so the dedupe query can't catch concurrent submissions. Two tabs / double-fire → wallet debited twice, duplicate earning entry. (Lifetime full-course purchase is safe — it re-reads in-txn, `wallet_actions.ts:216-220`.) | `app/actions/sectional_wallet_actions.ts:204-240` (outer checks) vs `:267-280` (txn reads wallet/instructor/course only), `:318` (auto-ID txn row), `:513-541` vs `:545-558` (bundle), `app/actions/wallet_actions.ts:118-137,213-214,267-279` (renewal), `lib/purchaseProtection/protectionKey.ts:7-8` |
| 5 | **P1** (borderline P0 per incident) | **ZainCash top-up credit depends entirely on the user's browser completing the redirect.** No webhook, no server-side reconciliation: pay on the ZainCash page, close the browser before the callback redirect → doc stays `awaiting_payment`, swept to `expired` after 30 min. **Money taken, wallet never credited**; the "تحديث الحالة" button only re-reads the Firestore doc. Only remedy is manual admin action. | `app/api/payments/zaincash/topup/callback/route.ts` (only credit path), `topup/intent/route.ts:20-38` (reads doc only), `topup/init/route.ts:83-94` (expiry sweep) |

Also load-bearing but below the fold: **zero error boundaries in the whole app**
(any player/checkout render throw = white screen — Area 4), the **admin/instructor
buy-chip bug itself** (Symptom 1 — Area 1), a **client lock that strands sectional
buyers on untagged videos** the server would play (Area 1), and a **broken package
payout form** that blocks admins from recording settlements (Area 3).

---

## Symptom diagnoses

### Symptom 1 — admin sees "شراء هذا القسم" (root cause, exact chain)

1. `app/course/[courseId]/page.tsx:187-201` (admin branch) and `:225-234`
   (instructor branch) render `<CoursePlayer course isEnrolled={true} …>` **without
   the `enrollment`, `accessScope`, or `ownedSectionIds` props** — the admin branch
   returns before the enrollment doc is even fetched (`:212`).
2. `components/player/CoursePlayer.tsx:38` defaults `enrollment = null` and passes it
   into the sidebar/lessons-tab list (`:361`).
3. `components/player/LessonSidebar.tsx:116-142` mounts `SectionalBuyButtons` under
   **every** real section of a sectional course, relying on the buttons to hide
   themselves ("The buy components hide themselves for owned sections / non-sectional
   access", `:111-115`).
4. `components/sectional/SectionalBuyButtons.tsx:41` — `isOwned()` returns **`false`
   when `enrollment` is `null`**, and the completed-bundle guard at `:68-73` also
   needs a non-null enrollment. Both guards fall through → the price chip +
   "شراء هذا القسم" (+ "شراء حتى هنا") render for every section.

**Reproduction:** sign in as admin (or the course's instructor) → open any
`purchaseMode === 'sectional'` course player → every section shows buy CTAs.
Videos themselves play fine (the video-lock predicate treats
`accessScope === undefined` as unlocked, `lib/sectional/access.ts:37`), which is why
this shows up as buy chips only, not locks.

**If clicked:** an instructor's purchase is rejected server-side
(`OWN_COURSE`, `app/actions/sectional_wallet_actions.ts:197-198`), but an **admin's
purchase goes through** — there is no admin/privileged guard in
`purchaseSectionsWithWallet` — debiting the admin's real wallet and creating a
sectional enrollment for content they already access via the server gate's
`isPrivileged` bypass (`lib/courses/videoAccess.ts:138-141`).

**Severity: P1** (trust-eroding UI shown to privileged roles; real money movable by
an admin misclick). **Fix scope:** `app/course/[courseId]/page.tsx` (pass a
privileged-viewer signal), `components/player/CoursePlayer.tsx` →
`LessonSidebar.tsx`/`SectionalLock.tsx` → `SectionalBuyButtons.tsx` (accept
`viewerIsPrivileged` and render nothing). No OWNER-ONLY files.

### Symptom 2 — long-open pages develop login/refresh failures (layer map)

**Layer A — the auth cookie (the main event).**
- `context/actions.ts:31-37`: `firebaseAuthToken` cookie `maxAge: 60*60` — the same
  lifetime as the Firebase ID token it carries. The refresh route re-stamps the same
  1h (`app/api/refresh-token/route.ts:46-52`).
- The **only** renewal mechanism is client-side: `context/authContext.tsx:129-155`, a
  `setInterval(…, 60*1000)` that force-refreshes and re-`setToken`s when <5 min from
  expiry. `onAuthStateChanged` (`:161`) fires on sign-in/out only — Firebase's hourly
  token rotation never re-stamps the cookie by itself, and there is **no
  `onIdTokenChanged` and no `visibilitychange`/`focus` handler anywhere**
  (grep-verified, zero matches).
- Chrome's intensive throttling wakes background-tab timers about once per **hour**;
  laptop sleep suspends them entirely. The 5-minute renewal window is easily missed →
  the cookie expires client-silently.

**What the user then experiences, by route class:**
- **Middleware-matched pages** (`/user_dashboard/*`, `/admin-dashboard/*`, …,
  `middleware.ts:113-123`): no cookie → hard redirect to
  `/login?redirect=…` (`middleware.ts:56-61`). On `/login`, hydration runs
  `onAuthStateChanged` → user still signed in client-side → `setToken` restores the
  cookie → `router.push` back (`context/authContext.tsx:187-198`). Net effect: a
  jarring login-page flash and, if `setToken`/network hiccups, a stranded login page —
  **this is the reported "login failures" experience.** The graceful path
  (`/api/refresh-token` via the 30-day `firebaseAuthRefreshToken` cookie) is only
  reachable while the token cookie still exists **and** is within 5 min of expiry
  (`middleware.ts:65-75`) — after a sleep, it's already gone, so the repair path is
  structurally unreachable in exactly the case it was built for.
- **Unmatched pages** (`/`, `/courses`, **`/course/[courseId]`**): the server
  component reads the cookie directly. `app/course/[courseId]/page.tsx:150-161` — no
  token → renders **`CoursePreview` with EnrollButton/sectional buy UI** to an
  enrolled (or admin) viewer whose navbar still shows them logged in. "I'm enrolled
  but it wants me to buy" support tickets; self-heals ≤60 s after the tab foregrounds
  (interval fires) + a reload, which makes it maddening to reproduce on demand.
- **Server actions & `/api/*` calls are immune**: every money/progress call passes a
  fresh `user.getIdToken()` from the SDK (which self-refreshes), e.g.
  `components/sectional/SectionalBuyDialog.tsx:301`,
  `components/player/CoursePlayer.tsx:283`, `hooks/useMuxPlaybackToken.ts:95`,
  `components/player/VideoStage.tsx:176`. Client Firestore reads (wallet
  `onSnapshot`) likewise self-refresh. The cookie is the single stale link.

**Layer B — Mux playback tokens.**
- TTL is 2h (`app/api/mux/playback-token/route.ts:11`). The **study deck's** hook
  proactively re-mints 5 min before expiry (`hooks/useMuxPlaybackToken.ts:9,160-170`).
- The **main player does not**: `components/player/VideoStage.tsx:149-223` mints once
  per lesson change, discards `expiresAt`, sets no timer, and the `<MuxPlayer>` at
  `:299-323` has **no `onError` handler**. Sequence: student opens lesson → pauses /
  tab sleeps → returns after >2h → every segment request 403s → the player shows its
  own raw error; the app's retry UI never appears because `videoError` is **never set
  anywhere** (`setVideoError` is only ever called with `null` —
  `CoursePlayer.tsx:311,318,340`; the error branch at `VideoStage.tsx:241-257` is dead
  code). Recovery requires switching lessons (remount mints a new token) or reload —
  **this is the reported "refresh failures" experience for video.**
- Lessons longer than 2h hit the same wall mid-play even without idling.

**Layer C — misc lifecycle defects found on the same trace.**
- **Open redirect**: `app/api/refresh-token/route.ts:5,61` — `redirect` param is
  unvalidated and fed to `NextResponse.redirect(new URL(path, request.url))`; an
  absolute URL wins over the base. `/api/refresh-token?redirect=https://evil.example`
  302s a signed-in user off-site (phishing primitive). Middleware itself passes only
  pathnames, but the route is publicly callable. Note `middleware.ts:14-19` and
  `authContext.tsx:39-46` both already have the correct sanitizer to copy.
- Refresh failure loses the destination: `refresh-token/route.ts:62-65` dumps the
  user at `/` on any error.
- bfcache is handled for the sign-in flow only (`authContext.tsx:90-99`); nothing
  refreshes server-rendered props on `pageshow(persisted)` — acceptable, since the
  cookie fix (below) removes the main staleness source.

**Minimal fix per layer:** see FIX-2.

---

## Area 1 — Access-control matrix

### Truth table (web player page, `/course/[courseId]`)

Server truth = `evaluateVideoAccess()` (`lib/courses/videoAccess.ts:95-250`).
Client mirror = `getLockReason()` (`lib/sectional/access.ts:28-48`).

| Viewer | Page branch (page.tsx) | Video lock (client) | Video lock (server) | Sidebar buy chip | Verdict |
|---|---|---|---|---|---|
| Admin | `:187-201`, `isEnrolled=true`, `enrollment=null` | unlocked (`accessScope` undefined → `access.ts:37`) | grant `admin` (`videoAccess.ts:138-141`) | **SHOWN — BUG A1** | P1 |
| Course instructor | `:225-234`, same props | unlocked | grant `owner` | **SHOWN — BUG A1** | P1 |
| Full enrollment (`accessScope:'full'`) | `:245-256`, enrollment passed | unlocked | grant `sectional_bundle` | hidden (`SectionalBuyButtons.tsx:42-47`) | ✓ |
| Grandfathered (unset scope) | same | unlocked | grant `sectional_legacy_full` | hidden | ✓ |
| Sectional, owned section | same | unlocked (`access.ts:40-45`) | grant `sectional_owned_section` | hidden for owned, shown for unowned | ✓ |
| Sectional, **untagged video** | same | **LOCKED — BUG A2** (`access.ts:39-47` has no untagged grant) | grant `sectional_untagged_video` (`videoAccess.ts:229-232`) | n/a (no real section) | **P1** |
| Sectional, unowned section | same | locked + buy CTA | deny `SECTION_NOT_OWNED` | shown | ✓ |
| Expired time-limited | `:241-243` → `AccessExpiredScreen` (renewal CTA) | n/a (player not rendered) | deny `ACCESS_EXPIRED` (`videoAccess.ts:196-203`) | n/a | ✓ (page-load only; see A4) |
| Not enrolled | `:265-274` → `CoursePreview` | n/a | deny `NOT_ENROLLED` | preview chips (intended; `enrollment` passed, `CoursePreview.tsx:650-654`) | ✓ |
| **Any enrolled/admin, lapsed cookie** | `:150-161` → `CoursePreview` | n/a | (server would grant) | **enroll/buy UI shown — Symptom 2 Layer A** | P1 |

**Free-preview flags:** client `access.ts:33` matches server `videoAccess.ts:143-145`
(playback grants preview; study deck passes `allowFreePreview:false` and additionally
requires enrollment — `CoursePlayer.tsx:164-177` mirrors it correctly). ✓

### Findings

- **A1 — P1 — Admin/instructor see per-section buy CTAs (Symptom 1).** Chain and fix
  scope above. Files: `app/course/[courseId]/page.tsx`,
  `components/player/CoursePlayer.tsx`, `components/player/LessonSidebar.tsx`,
  `components/player/SectionalLock.tsx`, `components/sectional/SectionalBuyButtons.tsx`.
- **A2 — P1 — Client locks untagged videos on sectional courses that the server
  grants.** `lib/sectional/access.ts:39-47`: with `accessScope === 'sectional'`, a
  video whose `sectionId` is unset skips the owned-branch and returns
  `sectional-not-owned` → `LOCKED`; the server explicitly grants
  (`videoAccess.ts:229-232`, invariant: "do not lock an untagged video the server
  would allow"). Worse, the locked-placeholder CTA needs `currentVideo.sectionId`
  (`SectionalLock.tsx:91`), so the student gets lock copy with **no button at all** —
  a paying sectional buyer stranded on content they own. Repro: sectional course,
  one video with no `sectionId`, viewer with `accessScope:'sectional'`. Fix: one
  branch in `lib/sectional/access.ts` (`if (video.sectionId == null) return "unlocked"`).
- **A3 — P2 — Client grants a "free-course" unlock the server does not have.**
  `access.ts:34` (`course.price === 0` → unlocked) has no server counterpart —
  `evaluateVideoAccess` requires a completed enrollment regardless of price. Currently
  unreachable (non-enrolled users never get `CoursePlayer` — `page.tsx:265`), but it's
  drift waiting for a new consumer. Fix: delete the branch or gate it on enrollment.
- **A4 — P2 — Client lock has no `accessExpiresAt` check.** Expiry is enforced at
  page load (`page.tsx:241-243`) and by the server gate, but a player left open past
  expiry keeps unlocked UI and fails only at token mint. Fix: pass/check
  `enrollment.accessExpiresAt` in `access.ts` (mirrors `isAccessExpired`).
- **A5 — Inverse bug check: CLEAN (server side).** Verified: a sectional-only student
  cannot mint a token for an unowned section (`videoAccess.ts:238-244`), an expired
  enrollment cannot mint (`:196-203`), study deck re-gates server-side with
  `allowFreePreview:false` (`app/actions/qa_study_actions.ts:117-123`), and **no
  `/api/*` serializer recomputes lock flags at all** — mobile receives raw
  ingredients per `docs/MOBILE_API_MIGRATION.md:63-91`, all seven recipe steps match
  the gate (verified field-by-field). The one real access-shaped exception is finding
  **M1** (F1 in Area 3): the *money* path mints full access.
- **A6 — P1 (documented but ticket-generating) — Enrolled students on unpublished
  courses are blocked with no client-visible reason.** The visibility gate runs
  *before* the enrollment grant for non-privileged users (`videoAccess.ts:114-116`),
  so unpublishing a course 404s every token mint for its paying students, while
  `/api/me/enrollments` still lists the course (filters only `isDeleted`,
  `app/api/me/enrollments/route.ts:74`) and the mobile lock recipe has no visibility
  step. Documented as intended (`docs/COURSE_APPROVAL_PUBLISHING.md:213-216`) — but
  with real students this needs either the gate reordered (enrollment outlives
  unpublish) or a `courseAvailable` flag in the serializer + recipe step 0.
- **A7 — P2 — `isVisible` is honored by serializers/UI but not by the gate.**
  `app/api/courses/[courseId]/route.ts:28` and `CoursePlayer.tsx:118-126` filter
  hidden videos; `evaluateVideoAccess` never reads `isVisible` — an enrolled student
  with a remembered `videoId` can still mint a token for a hidden video. Low impact
  (content they paid for). Fix: `isVisible === false` → `VIDEO_NOT_FOUND` in the gate.
- **A8 — P2 — Raw `sections[]` passthrough on the public course-detail API.**
  `app/api/courses/[courseId]/route.ts:75` ships section objects unprojected,
  including `isLocked` — which is the *instructor edit lock* ("section sold",
  `lib/courses/assertCourseMutationAllowed.ts`), trivially misread as student lock
  state by a mobile dev; any future section field leaks publicly by default. Fix:
  project `{sectionId, title, order, price, salePrice}`.

---

## Area 2 — Session & token lifecycle

Fully diagnosed under **Symptom 2** above. Findings list:

- **S1 — P1 — Cookie lifetime = token lifetime, renewal by throttleable timer only.**
  `context/actions.ts:31-44`, `context/authContext.tsx:129-155`. Failure sequences
  and route-class consequences above. Minimal fix, layered:
  1. Give the **refresh-token cookie a real recovery role**: in `middleware.ts`, when
     the token cookie is *missing or expired* but `firebaseAuthRefreshToken` exists,
     redirect to `/api/refresh-token?redirect=…` instead of `/login`
     (**OWNER-ONLY**, `middleware.ts:56-61,94-101`).
  2. In server components on unmatched routes, the same fallback is not available —
     but once (1) covers matched routes, fix unmatched ones client-side: replace the
     bare interval with `onIdTokenChanged` + a `visibilitychange`/`focus`-triggered
     immediate check in `context/authContext.tsx` (**OWNER-ONLY**), so the cookie is
     re-stamped the moment a slept tab wakes, before the user can navigate.
  3. Optionally lengthen the *cookie* maxAge beyond the token's (e.g. 7d) so the
     middleware's existing expiring-token branch (`:65-75`) — which already repairs
     via the refresh token — becomes reachable after sleep (`context/actions.ts`,
     `app/api/refresh-token/route.ts`).
- **S2 — P1 — Main player cannot survive Mux token expiry.**
  `components/player/VideoStage.tsx:149-223,299-323`. Fix: reuse
  `hooks/useMuxPlaybackToken.ts` (proactive re-mint already built and in production
  for the study deck) in `VideoStage`, add `onError` → re-mint once; delete the
  bespoke one-shot effect. Files: `components/player/VideoStage.tsx` only.
- **S3 — P1 — Open redirect in `/api/refresh-token`.**
  `app/api/refresh-token/route.ts:5,61`. Fix: apply the existing sanitizer pattern
  (`middleware.ts:14-19`) to the `redirect` param. File: the route only.
- **S4 — P2 — Dead `videoError` UI.** `VideoStage.tsx:241-257` unreachable (nothing
  sets a non-null value — `CoursePlayer.tsx:311,318,340`). Subsumed by S2.
- **S5 — P2 — Refresh failure drops the user at `/`** losing destination
  (`refresh-token/route.ts:6-8,62-65`); hardcoded web API key at `:16` should come
  from config (public by Firebase's model, hygiene only).
- **S6 — CLEAN — verified immune:** all purchase/progress/token fetches send fresh
  SDK tokens (citations under Symptom 2 Layer A); wallet balance is a live
  `onSnapshot`; middleware's admin claim check (`middleware.ts:82-86`) matches the
  server gate's `isAdmin` source (bearer claims) — no server/client disagreement
  beyond the cookie itself.

---

## Area 3 — Money paths

Verified correct (keep it that way):

- **ZainCash top-up callback**: HMAC-verified (`lib/payments/zaincash.ts:71-108`,
  `timingSafeEqual` + `exp`), server-side re-confirmation, amount from the stored doc
  (never the token), credit inside a transaction gated on `status === "approved"` —
  replay-safe, exactly-once (`app/api/payments/zaincash/topup/callback/route.ts:49-119`;
  doc ID = ZainCash txn ID, `topup/init/route.ts:132-135`).
- **Manual-receipt approval**: status re-read inside the txn, double-approve
  impossible (`app/actions/wallet_actions.ts:362-412`).
- **Package purchase**: reference implementation — re-reads package/courses/**every
  enrollment** in-txn; debit, platform credit, N enrollments, ledgers, lock, and the
  `package_sales` owed-tally snapshot are one atomic transaction
  (`app/actions/package_wallet_actions.ts:283-320,466-480`).
- **Earnings ledger is append-only in server code**: only writers are fresh-auto-ID
  `transaction.set`s (`lib/earnings/recordEarning.ts:70,90`,
  `app/actions/instructor_payout_actions.ts:355-364`); no update/delete anywhere;
  totals via `FieldValue.increment`; splits snapshotted at sale. All earning writes
  share the sale's transaction (`wallet_actions.ts:252-261`,
  `sectional_wallet_actions.ts:344-354,595-604`).
- **Post-payment bridge is refresh-safe**: protectionKey derived from the ZainCash
  txn ID (`app/wallet/topup/complete/CompleteContent.tsx:36-52`).

Findings:

- **M1 — P0 — `purchaseCourseWithWallet` sells sectional courses it must not, at a
  price it must not.** Executive summary #1. Repro: authenticated user invokes the
  action with a sectional course's ID (server actions are plain HTTP endpoints; the
  UI's routing to `SectionalBuyDialog` is not a gate). With unset `price` → 0-IQD
  full-access enrollment (no `accessScope` → invariant-3 grandfathered). Fix (file:
  `app/actions/wallet_actions.ts`): reject `purchaseMode === 'sectional'`
  (`COURSE_NOT_SECTIONAL`-style stable code), and independently reject
  `coursePrice <= 0 && !courseData?.isFree`.
- **M2 — P1 — Sectional section purchase double-debits under concurrency.**
  Ownership (`ownedBefore`/`toBuy`/`totalPrice`) and invariants
  (`ALREADY_FULL_ACCESS` `:208-223`, `ALL_SECTIONS_ALREADY_OWNED` `:231-240`) are
  computed **outside** the txn; the txn re-reads only wallet/instructor/course
  (`sectional_wallet_actions.ts:267-280`) and spends the stale closure. Each click
  mints a new key (`SectionalBuyDialog.tsx:302` + `protectionKey.ts:7-8` `Date.now()`
  suffix) so the pre-check query (`:140-155`) never matches concurrent clicks.
  Two tabs → double debit + duplicate earning entry (`arrayUnion` masks it in
  `ownedSectionIds`). Fix (file: `app/actions/sectional_wallet_actions.ts`):
  `transaction.get(enrollmentRef)` in-txn, recompute `toBuy`/`totalPrice`, throw the
  invariant errors in-txn; write the buyer `wallet_transactions` row with
  `transaction.create()` at a deterministic ID (`${userId}_${protectionKey}`).
- **M3 — P1 — Bundle purchase: same defect** (`:513-541` outer vs `:545-558` txn) —
  plus a concurrent section purchase between the outer `priorSpent` read and the
  bundle txn makes the buyer pay for a section *and* a `charge` computed as if they
  hadn't. Same fix, same file.
- **M4 — P1 — Time-limited renewal double-debit.** The in-txn re-read that saves
  lifetime purchases (`wallet_actions.ts:216-220`) doesn't save renewals: `isRenewal`
  stays true on the second run (`:213-214`) → 2× debit, 2× extension (`:267-279`).
  Same deterministic-`transaction.create()` fix; file: `app/actions/wallet_actions.ts`.
- **M5 — P1 — Orphaned ZainCash payments (executive summary #5).** Fix: extract the
  status-gated credit txn from the callback into `lib/payments/`, and have
  `topup/intent/route.ts` reconcile against ZainCash (`getTransactionStatus`) when
  the doc is `awaiting_payment`/`expired` — the bridge page's refresh button then
  self-heals. (A late real callback still credits an `expired` doc today — the gate
  only short-circuits on `approved` — but the user no longer has that URL.)
- **M6 — P1 — Package payout recording is broken.**
  `app/admin-dashboard/packages/_components/PayoutLedger.tsx:64-68` omits `method`;
  `lib/earnings/validation.ts:12-17` requires it → every submit returns
  `INVALID_INPUT` ("بيانات الدفعة غير صحيحة"). Admins cannot settle package
  instructors from that surface (the instructor-payouts dialog works —
  `InstructorDetailDialog.tsx:122-127` passes `method`). Fix: add a method selector
  or default; file: `PayoutLedger.tsx`.
- **M7 — P2 — Admin cash actions have no idempotency key** (`recordInstructorPayout`
  `instructor_payout_actions.ts:345-384`, `adminManualTopup`
  `wallet_actions.ts:482-529`): a retried lost response double-credits/double-records,
  and a duplicate payout entry is **uncorrectable in-product** (append-only +
  `positive()` amounts, `lib/earnings/validation.ts:14`). Fix: client `protectionKey`
  + deterministic `transaction.create()`.
- **M8 — P2 — Query-then-write races on top-up guards** (daily limit / single
  pending): `wallet_actions.ts:67-78`, `app/api/wallet/topup/request/route.ts:108-141`,
  `topup/init/route.ts:62-105`. Two pending duplicates from one real transfer invite
  a double admin approval (each individually valid). Low volume; harden later.
- **M9 — P2 — Misc:** out-of-order callback can show `topup_failed` to a credited
  user (`callback/route.ts:63-75`); prices read outside txns charge stale figures on
  mid-purchase edits (`wallet_actions.ts:141-153`,
  `sectional_wallet_actions.ts:243-263`); free-enroll `enrollmentCount + 1` undercount
  race (`enrollment_action.ts:156-159`, non-money).
- **M10 — Note:** all atomicity guarantees hold **in server code only**; see
  executive summary #2 (rules unverifiable from repo).

---

## Area 4 — Production hygiene

- **H1 — P1 — Zero error boundaries.** No `app/**/error.tsx`, no `global-error.tsx`,
  no `ErrorBoundary`/`componentDidCatch` anywhere (glob+grep verified). Any render
  throw in `components/player/**` or a checkout dialog replaces the page with Next's
  blank "Application error" screen mid-lesson/mid-checkout, with a 1-hour Vercel
  Hobby log window to catch it. Fix: `app/global-error.tsx` + `app/error.tsx`
  (Arabic copy + `reset()`), plus `app/course/[courseId]/error.tsx` so a player crash
  keeps the chrome.
- **H2 — P1 — `/api/refresh-token` can log a live credential.**
  `app/api/refresh-token/route.ts:39-41` dumps the whole Firebase response JSON when
  one expected field is missing — the *other* field can be a valid `id_token` or
  long-lived `refresh_token`, written to server logs. Fix: log `Object.keys(json)`.
- **H3 — P0-LATENT — Firestore rules unversioned + client-writable money-adjacent
  doc.** Executive summary #2. The repo's client code *requires* rules that permit
  authenticated create/update on `users/{uid}` (`userService.ts:58,73`,
  `updateUserProfile` from `app/user_dashboard/profile/page.tsx:98`) — a doc that
  carries `walletBalance`, `revenueSharePercent` (trusted by
  `recordEarning.ts:64-67`), `earningsTotal`, `payoutsTotal`, `enrolledCourses`.
  Mitigations verified in code: the purchase-authoritative balance is
  `wallets/{uid}` (admin-SDK-only writes); access truth is `enrollments` via the
  server gate; no client writes to `courses`/`enrollments`/`earningsLedger` exist in
  the codebase. **Action (owner, console):** export the live rules into the repo
  (`firebase firestore:rules:get` + `firebase.json`), then field-restrict `users`
  self-writes to exclude every money/counter field, confirm `wallets` is
  read-own/write-never, `enrollments`/`earningsLedger`/course approval fields
  admin-SDK-only. Until the rules are in-repo and reviewed, finding #2 stays open.
- **H4 — Console-log sweep.** The known "User updated"/"New user created" UID logs
  are **already dev-gated** (`lib/services/userService.ts:68-70,79-81` — verified
  directly; an earlier sweep misread this). Remaining production-reachable items, all
  P2: `userService.ts:120` ("User profile updated", no PII);
  `components/CoursesCardList.tsx:208-210` (course-ID nav debug on click);
  `components/player/CoursePlayer.tsx:293` + `hooks/useVideoProtection.ts:18,31`
  (noise); auth-flow `console.error`s that can embed the attempted email in Firebase
  error messages (`context/authContext.tsx:119,149,168,228,303,322` — **OWNER-ONLY**;
  sanitize to `error.code`); `app/api/enrollments/route.ts:141,273` log
  `newBalance` next to the UID server-side (drop the field);
  `lib/payments/zaincash.ts:195` dumps the full gateway error body. Deliberate audit
  log lines (mux-playback, sectional/package actions, webhook) verified to never log
  tokens — keep them; production debugging depends on the grep patterns.
- **H5 — P2 — Unhandled-rejection sweep: purchase/enroll/complete/wallet handlers
  are all try/catch-wrapped** (`EnrollButton.tsx:68-89,106-216`,
  `SectionalBuyDialog`, `PackageCheckoutDialog`, `CompleteContent`,
  `CoursePlayer.tsx:281-299` — verified). One marginal case:
  `components/Authbutton.tsx:83-92` logout has `try/finally` with no `catch` — safe
  only because `logOut` swallows internally (`authContext.tsx:293-310`); add a catch.
  Related UX oddity: `logOut` uses an English `window.confirm` (`authContext.tsx:294`,
  **OWNER-ONLY**).
- **H6 — P2 — Phase 2D leftovers in `components/player/**`:**
  Arabic-Indic digits: `shared.tsx:31-46` (`toArabicIndic` table `"٠١٢٣٤٥٦٧٨٩"`,
  `"٠ دقيقة"`, `"٫٥"`), consumed at `LessonSidebar.tsx:94,104-106,124,198` — mixing
  digit systems with `PlayerHeader.tsx:58`'s Western digits on adjacent surfaces;
  dead import of `toArabicIndic` in `PlayerTabs.tsx:9`.
  **Progress ring missing `%`**: `PlayerHeader.tsx:71-75` renders bare `{progress}`
  (the `aria-label` at `:63` has the `%`; the visible text doesn't) — P1 per the
  design brief, one-line fix. Listed only — not fixed in this run.

---

## Area 5 — State freshness

Model: **zero `revalidatePath` in any purchase/wallet action** (grep-verified;
only course-editor actions use it). Freshness is client-driven and currently works:
wallet balance is a live `onSnapshot` (`components/WalletBalance.tsx:21-39`,
`SectionalBuyDialog.tsx:206-225`), and every purchase success path calls
`router.refresh()` on a fully-dynamic, uncached page.

**The headline scenario is CLEAN:** buy a section while on the player page →
`SectionalBuyDialog.tsx:318-327` (`onOpenChange(false); router.refresh()`) →
`page.tsx` re-reads enrollment (`:212`) → fresh `ownedSectionIds` props → lock memo
recomputes (`CoursePlayer.tsx:145-152`) → `VideoStage`'s token effect keyed on
`canAccessVideo` mints immediately. Locked lessons unlock without manual reload,
after one RSC roundtrip.

- **N1 — P1 — Package upsell banner survives the purchase.**
  `components/PackageUpsellBanner.tsx:41-62` loads packages in a mount effect;
  `router.refresh()` re-renders RSC but never re-runs it → seconds after paying, the
  banner still advertises the package and re-opening shows «لا يمكنك شراء هذه
  الحزمة…». Money safe (`ALREADY_OWNS_COURSE` blocks); reads as a bug. Fix: add
  `onPurchased(packageId)` to `PackageCheckoutDialog` (`:157`) and drop the id from
  the banner's state.
- **N2 — P2 — Feedback-free window after sectional purchase.** The dialog closes
  *before* the refresh roundtrip resolves — on slow connections the lock visibly
  persists with zero pending indication: the exact "paid but still locked" ticket,
  even though it self-heals. `onPurchased` is dead wiring (no caller passes it —
  `SectionalLock.tsx:118-126`, `SectionalBuyButtons.tsx:124-133`) and the action's
  returned `ownedSectionIds` (`sectional_wallet_actions.ts:37`) is discarded. Fix:
  `useTransition` around the refresh + success overlay until `isPending` clears,
  and/or merge the returned `ownedSectionIds` into a local override feeding
  `isVideoLockedForUser` (instant optimistic unlock).
- **N3 — P2 — 1.5 s dead delay on full-course purchase** —
  `EnrollButton.tsx:137-140,179-182` `setTimeout(…, 1500)` before push+refresh; the
  buy CTA lingers. Fix: drop the timeout, `startTransition(() => router.refresh())`.
- **N4 — P2 — Silent completion-save failure keeps a lie on screen.**
  `CoursePlayer.tsx:294-297` deliberately keeps the optimistic checkmark with no
  toast; it reverts on next visit. Fix: error toast in the catch.
- **N5 — P2 — `/wallet/transactions` is mount-time-only**
  (`app/wallet/transactions/page.tsx:34-73`): an approval mid-visit updates the
  navbar balance live while this page still shows "pending". Fix: `onSnapshot` or a
  refresh affordance.
- **N6 — P2 — Props frozen into state** in
  `app/user_dashboard/main/DashboardHome.tsx:52-54` (`useState(initialProps)`
  ignores refreshed props). Currently harmless; landmine. Fix: render props directly.
- Handled correctly elsewhere (keep as patterns): `favoritesButton.tsx:57-84`
  (optimistic + rollback + prop re-sync), `QaReviewTab.tsx:279-281` (documented
  local-state mirror), `CoursePlayer.tsx:71-78` (re-sync from refreshed props).
- Defense-in-depth: add `revalidatePath('/course/[courseId]', 'page')`-style calls
  inside the three purchase actions so freshness stops depending on every future
  caller remembering `router.refresh()`.

---

## Proposed fix plan

No fixes in this run. Grouped for execution as separate, individually-verifiable
slices (per the checkpoint style: real-behavior proof per slice, not types-clean).

### FIX-1 — Access-control corrections

| Change | Files | Risk | OWNER-ONLY? |
|---|---|---|---|
| M1: reject sectional + zero-price in `purchaseCourseWithWallet` | `app/actions/wallet_actions.ts` | Low — additive guard; verify full-course buys still work | No |
| A1: thread `viewerIsPrivileged` from the page → hide all purchase UI (buy chips, locked-CTA dialog) for admin/instructor | `app/course/[courseId]/page.tsx`, `components/player/CoursePlayer.tsx`, `components/player/LessonSidebar.tsx`, `components/player/SectionalLock.tsx`, `components/sectional/SectionalBuyButtons.tsx` | Low — display-only; server gate unchanged | No |
| A2: untagged-video grant in the client predicate | `lib/sectional/access.ts` | Low — makes client *match* the server; check `CoursePreview` consumers too | No |
| A3/A4: remove free-course drift; add expiry check | `lib/sectional/access.ts` | Low | No |
| A6: decide unpublish-vs-enrolled policy (gate reorder **or** `courseAvailable` flag + doc) | `lib/courses/videoAccess.ts` or `app/api/me/enrollments/route.ts` + `docs/MOBILE_API_MIGRATION.md` | Medium — owner product decision; mobile contract change | No (needs owner decision, not owner files) |
| A7/A8: `isVisible` in gate; project `sections[]` in detail API | `lib/courses/videoAccess.ts`, `app/api/courses/[courseId]/route.ts`, `docs/MOBILE_API_MIGRATION.md` | Low/Medium — API contract; update doc in same commit | No |

### FIX-2 — Token/session lifecycle

| Change | Files | Risk | OWNER-ONLY? |
|---|---|---|---|
| S1a: middleware falls back to `/api/refresh-token` when the token cookie is missing/invalid but the refresh cookie exists | `middleware.ts` | Medium — auth-critical path; must not loop (refresh failure → login, not refresh) | **YES** |
| S1b: `onIdTokenChanged` + `visibilitychange`/`focus` immediate re-stamp replacing the bare interval | `context/authContext.tsx` | Medium — auth-critical | **YES** |
| S1c: decouple cookie maxAge from token lifetime (e.g. 7d) so the existing repair branch is reachable | `context/actions.ts`, `app/api/refresh-token/route.ts` | Low-Medium | No (adjacent to owner files — review together) |
| S2: main player adopts `useMuxPlaybackToken` (+ `onError` re-mint once) | `components/player/VideoStage.tsx` | Medium — exercise a real >2h/expiry scenario, not just build | No |
| S3: sanitize `redirect` param (copy `middleware.ts:14-19` pattern) | `app/api/refresh-token/route.ts` | Low | No |
| S5: preserve destination on refresh failure; move API key to config | `app/api/refresh-token/route.ts` | Low | No |

### FIX-3 — Money hardening

| Change | Files | Risk | OWNER-ONLY? |
|---|---|---|---|
| M2/M3: in-txn enrollment re-read + recompute + in-txn invariant throws; deterministic `transaction.create()` idempotency row | `app/actions/sectional_wallet_actions.ts` | Medium — core money path; needs concurrent-purchase test (two parallel invocations) | No |
| M4: deterministic `transaction.create()` for renewal dedupe | `app/actions/wallet_actions.ts` | Medium | No |
| M5: extract credit txn to `lib/payments/`, reconcile in `intent` | `app/api/payments/zaincash/topup/{callback,intent}/route.ts`, `lib/payments/` | Medium — touches the strongest flow; keep callback behavior byte-compatible | No |
| M6: add `method` to package payout form | `app/admin-dashboard/packages/_components/PayoutLedger.tsx` | Low | No |
| M7: idempotency keys for admin payout/top-up | `app/actions/instructor_payout_actions.ts`, `app/actions/wallet_actions.ts`, their dialogs | Low | No |
| H3: **pull Firestore rules into the repo, review field guards** (prereq for closing exec #2) | new `firestore.rules`, `firebase.json`; possibly move `createOrUpdateUser` server-side | Medium — console + deploy pipeline change | Owner action (console access), not owner files |

### FIX-4 — Hygiene

| Change | Files | Risk | OWNER-ONLY? |
|---|---|---|---|
| H1: `global-error.tsx`, `error.tsx`, `app/course/[courseId]/error.tsx` | `app/…` (new files) | Low | No |
| H2: stop logging raw token JSON | `app/api/refresh-token/route.ts` | Low | No |
| H4: strip/sanitize the listed logs (incl. `newBalance` in enrollment logs) | `components/CoursesCardList.tsx`, `components/player/CoursePlayer.tsx`, `hooks/useVideoProtection.ts`, `lib/services/userService.ts`, `app/api/enrollments/route.ts`, `lib/payments/zaincash.ts`; `context/authContext.tsx` part is **OWNER-ONLY** | Low | Partial |
| H5: catch on logout handler | `components/Authbutton.tsx` | Low | No |
| H6: ring `%`, digit-system unification, dead import | `components/player/PlayerHeader.tsx`, `shared.tsx`, `LessonSidebar.tsx`, `PlayerTabs.tsx` | Low | No |
| N1-N6: freshness fixes as listed in Area 5 | per finding | Low | No |

**Suggested order:** M1 (one guard, closes the only live P0) → H3 rules export
(unblocks exec #2 verdict) → S1 (both symptoms' parent, owner pairing required) →
A1+A2 (the reported symptom + the stranded-student inverse) → M2/M3/M4 → S2 → H1 →
M5/M6 → the P2 tail.
