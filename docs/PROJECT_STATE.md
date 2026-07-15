# Web App — Project State / Changelog

Running log of notable web-app (this repo) changes. The mobile board lives in
`docs/MOBILE_PROJECT_STATE.md`; this file is for the Next.js web app.

---

## 2026-07-12 — E1: MCQ transform + exam-item review (final-exam track)

First build rung of the exam → job-market track
(`docs/BRAINSTORM_EXAM_JOB_MARKET.md` decision block governs; build spec +
verification record: `docs/AUDIT_MCQ_TRANSFORM.md` قرارات المالك 1–8 +
addendum).

- **Shared modules:** `mcqContentHash()` added to `lib/qa/contentHash.ts`
  (only hashing site, sorted normalized distractors); new `lib/qa/mcqLint.ts`
  shared by the transform script and the review actions.
- **Operator script** `scripts/pipeline/mcq.mts` (`npm run mcq`):
  `transform` reads approved pairs from Firestore (edits live only there),
  one Sonnet call per video with the course-wide approved corpus as
  distractor material, verbatim-key enforcement in code, writes
  `output/{c}/{v}/mcq.json` (resume-by-file-exists); `import` is dry-run
  default → `courses/{id}/mcqItems` (separate subcollection — structurally
  invisible to every `qa` consumer), idempotent on
  `sourceQaDocId + sourceContentHash`.
- **Review:** `app/actions/mcq_review_actions.ts` (individual-only; key
  never editable; numeric hard gate carried over; source-pair re-check
  inside the approve transaction) + `McqReviewSection` behind a segmented
  toggle inside the existing مراجعة الأسئلة tab (`QaReviewTab.tsx`;
  `CourseDashboard.tsx` untouched). `qa_review_actions.ts` untouched.
- **Third pipeline course recorded:** `JQTvM6EmKkT8MJvaZV2b` "Chairside 3D
  Printing in Dentistry" (9 videos / 129 pairs) — §3 snapshot table in
  `RUBIK_STUDY_FEATURES.md` corrected (totals now 34 videos / 555 pairs
  across 3 courses).
- **Verified (real behavior, prod):** Chairside transform 73 MCQs / 74
  approved pairs (99% yield, Q:num=4), `--write` imported; idempotent
  re-run proven (73/73 identical-source, 0 writes); `mcqItems` deny-all
  proven 10/10 (SDK+REST × unauth+non-admin, control reads succeed); §6.5
  server walkthrough 17/17 with a real owner token (hard-gate refusal,
  audit fields, edit-lock, history preservation, shared lint). tsc/eslint
  at baseline parity.
- **Still owner-side:** visual pass of the new toggle on both dashboard
  mounts; Chairside has 55 pairs pending (decision 8's exam-availability
  switch needs full review).
- **2026-07-14 amendment (owner decision, same commit):** approval is now
  ONE-TAP on both review surfaces — the clip-attestation gate and the
  `numericConfirmed` checkbox/requirement were removed from both UIs and
  both approve actions (`QA_/MCQ_NUMERIC_CONFIRM_REQUIRED` codes deleted).
  Numeric quarantine remains as classification + رقم/قياس badge (and still
  bars pair bulk-approval); معاينة المقطع remains as optional preview; all
  integrity re-checks (hash, source-pair, sentinel) unchanged. Dated
  amendment notes in `RUBIK_STUDY_FEATURES.md` §4 inv. 3–4 + ledger,
  `AUDIT_MCQ_TRANSFORM.md` قرارات d4, `BRAINSTORM_EXAM_JOB_MARKET.md` d4.

---

## 2026-07-12 — Time-limited access complete (Checkpoints 2–3); flashcard AI disclosure

### Time-limited access — Checkpoint 2, web UI (`69540bf`)
Every student-facing surface shows what access a purchase grants
(Arabic-Indic numerals): CoursePreview hero badge + sidebar row, consent
badge in the payment dialog AND under the enroll button (free courses have
no dialog), دوراتي remaining-days/expired chips, expired-player renewal lock
screen (`AccessExpiredScreen` in `app/course/[courseId]/page.tsx`, wired to
the wallet renewal carve-out), instructor مدة الوصول dropdown in the pricing
tab (disabled for sectional), admin review card cell, homepage "وصول دائم"
claim reworded. Formatters live with the stamp helpers in
`lib/courses/accessDuration.ts`. Gotcha recorded in
`validation/courseSchema.ts`: TS 5.5 infers a type predicate from a zod
`.refine()` callback and narrows the form type — the explicit `: boolean`
return annotation is load-bearing.

### Time-limited access — Checkpoint 3, mobile contract (`1da21be`)
`GET /api/me/enrollments` items carry `accessExpiresAt` (always present,
`null` = lifetime); `GET /api/courses/:id` carries `accessDurationDays`.
Lock-recipe step 3 (expired → whole course locked, `ACCESS_EXPIRED`) and the
in-app renewal matrix on `POST /api/enrollments` documented in
`MOBILE_API_MIGRATION.md` (same commit). ZainCash direct-purchase renewal
deliberately unsupported — the init route's pending-overwrite flow would
downgrade a completed enrollment (renewal is wallet/free only).

### Flashcard AI-generated disclosure note (`3d80087`)
`components/study/QaStudyDeck.tsx` shows a disclosure that deck content is
AI-generated (owner-authored).

### MCQ transform audit (`38bc04a`, docs-only)
`docs/AUDIT_MCQ_TRANSFORM.md` + owner decisions; E1 spec closed. Pipeline
implementation in progress (uncommitted `scripts/pipeline/mcq.mts` at the
time of this entry).

## 2026-07-11 — Login resilience, app-wide loading feedback; Checkpoint 1 deployed

Pushed to `origin/main` as `0f5711d..930d4fb` (Vercel deploy includes all of
the below).

### Time-limited course access — Checkpoint 1 (`a7cb9b3`, authored 2026-07-10)
Schema, write paths, and gate; the full design is in the commit message.
Helpers: `lib/courses/accessDuration.ts`; enforcement:
`evaluateVideoAccess()` in `lib/courses/videoAccess.ts` (`ACCESS_EXPIRED`).
Sectional × time-limited are mutually exclusive; packages reject time-limited
member courses; final-exam eligibility is deliberately NOT expiry-gated
(owner decision 2026-07-10). Mobile contract rows updated in
`MOBILE_API_MIGRATION.md`; renewal UX lands with Checkpoint 3.

### Login fallback chain (`e908026`)
`signInWithPopup` races a 15s timeout; popup-blocked / network failure /
timeout auto-falls back to `signInWithRedirect` (user-cancel never does);
`getRedirectResult` resolves behind a "completing sign-in" state; terminal
failure shows an Arabic error + "حاول مرة أخرى" retry (see
`handleGoogleSignIn` in `context/authContext.tsx`). Destination preserved end
to end: `ProtectedLink` and `middleware.ts` redirect to
`/login?redirect=<path>` (middleware previously dumped users on `/`), the
signed-in `/login` branch honors it, post-login push happens after the cookie
is set. **Supersedes** the nav-entry detail below (2026-06 era): a logged-out
**إنشاء دورة** click now lands on `/login?redirect=%2Fcourse-upload`, and
during auth hydration ProtectedLink navigates natively (middleware
arbitrates) instead of client-blocking.
Recorded caveat: `signInWithRedirect` on the cross-origin authDomain
(`readiq-1f109.firebaseapp.com`) is unreliable under third-party storage
partitioning (Safari/Firefox/incognito) — acceptable as a fallback; the
bulletproof fix is serving the auth handler from our own domain (backlog).

### Loading feedback everywhere (`930d4fb`)
Primitives: `components/ui/loading-button.tsx` (LoadingButton +
ButtonSpinner), `components/ui/skeleton.tsx`; `nextjs-toploader` (brand
yellow) in the root layout. Route skeletons matching real layouts: `/`,
`/course/[courseId]`, both course editors (shared `CourseEditorSkeleton`),
`/user_dashboard` (+ myFavorites, earnings), `/wallet/transactions`,
`/wallet/topup`, `/delete-account`. Pending states added to: profile
save/logout, navbar dropdown logout, all admin approve/reject/restore/delete
actions, topup-approvals approve. Wallet transactions load-more had a dead
`loading` flag (never set on the load-more path) — fixed, plus skeleton rows
and an error + retry state. Firebase Storage `<img>` sites gained `onError`
placeholder fallbacks (CoursePreview hero, editor cover preview, package
thumbs/checkout — all still plain `<img>` per the cover-rendering rule).
WalletBalance shows a pulse while loading and "—" on listener errors instead
of a fake 0.

### Also shipped
`/support` page for App Store submission (`0f5711d`, 2026-07-08) and the
homepage Google Play badge (`2e06f61`, owner).

Verification: tsc/lint at parity with baseline (same 6 pre-existing
`.next/types` errors); Playwright + system Chrome against the dev server —
popup-blocked auto-navigates to the redirect flow, blackholed Google
endpoints end in the retry UI, `/course-upload` logged out 307s to
`/login?redirect=%2Fcourse-upload`.

---

## 2026-07-07 — Files tab conditional (lesson player)

- CoursePlayer's الملفات tab now renders only when the lesson's panel would
  show something (its own files + course-general files — the same sum the
  tab label displays), mirroring the التدريب conditional pattern. Fail-soft:
  malformed `files` data hides the tab instead of crashing. Same
  default-tab fallback as the practice tab; file loading/serving unchanged.
  Empty lessons keep التدريب as the focus.

---

## 2026-07-06 — Phase 3 slice 6: study event log — Format A complete

- `logStudyEvent` (`app/actions/qa_study_actions.ts`) — append-only writes
  to a NEW top-level `study_events` collection (client rules deny-all; the
  server action is the only write path — students still have zero access
  to `qa` docs). Keyed on `qaDocId` (stable Firestore doc ID) with
  `videoId` as a secondary field only (owner decision — positional ids
  renumber on re-upload). `uid` from the verified token, `at`
  server-stamped, 60/user/min Upstash limit (fail-open), zod at the
  boundary (`grade` only with `selfGrade`), no per-event access reads by
  design (rationale in the action header).
- Deck wiring: `revealed` (+`elapsedMs` recall latency), `selfGrade`
  yes/no, `jumpToSource` on every شاهد الشرح tap (demand signal even if
  the player is still loading). Fire-and-forget — telemetry can never
  disturb the study flow.
- Verified with a real owner session: 11 events, all three kinds, correct
  reveal→grade ordering, the لا card's jumpToSource on the same `qaDocId`,
  sane elapsedMs values (read-only admin query, temp script deleted).
- Phase 3 Format A is now fully built (slices 1–6). Remaining before broad
  launch: Phase 2 full-course pilot approval + §13 q5 ship-gate re-scope.

---

## 2026-07-04 — Phase 3 slices 4–5: flashcard recall deck + cited clip jump

The first student-facing study surface (Format A). Web-only server action +
standalone component; zero mobile-contract impact; zero LLM runtime.

- `app/actions/qa_study_actions.ts` — `listApprovedQaForStudy`: student gate
  via `evaluateVideoAccess({ allowFreePreview: false })` (enrolled-only,
  §13 q1), query `status=="approved" AND stale==false`, lecture-ordered.
  Ships ONLY `{qaId, question, answer, sourceStartSec, sourceEndSec,
  videoId, hasValidClip}` — no confidences/reviewer metadata/quarantine.
  `hasValidClip` computed server-side per §8.2 (needsReview / 0-0-null
  sentinel / >5-min span ⇒ false).
- `components/study/QaStudyDeck.tsx` — question → reveal → self-grade
  نعم/لا; "لا" re-queues in-session and offers "شاهد الشرح [time]" (only
  when `hasValidClip`); ONE SignedMuxPlayer per deck session, 15 s pre-roll
  seek, one-shot fake-stop at sourceEndSec; session summary + restart.
  Session-only state (Phase 5 owns persistence/SRS); NO event logging yet.
- CoursePlayer mounts the deck in the التدريب tab; deck survives tab
  switches within a lesson (hidden, clip auto-paused), resets per lesson;
  main-player/clip audio pause each other in both directions.
- Adversarial review (24-agent workflow: 3 lenses × 3 refuters/finding)
  confirmed 3 real defects, all fixed + independently re-verified: hidden
  retry dead-end after failed token mint; stale keep-alive re-mounting a
  hidden deck (extra reads + token mints) on lesson re-selection; two-way
  audio overlap. The gate/DTO lens verified all hard requirements sound.
- Owner-verified on a real enrolled account: deck flow, clip jump,
  dual-direction pause, per-lesson reset.

---

## 2026-07-04 — Phase 3 slices 1–3: practice entry point + shared video-access gate

Pre-build audit + build plan + owner decisions (deck enrolled-only; event
logging ships via append-only server action, keyed on qa doc IDs; web-first
surface): `docs/AUDIT_STUDY_DECK.md`.

- `lib/qa/approvedCounts.ts` — per-video `count()` aggregates
  (`status == "approved" AND stale == false`; deliberately no maintained
  counter, §7.3), fail-soft to "no tab"; wired into
  `app/course/[courseId]/page.tsx`'s three CoursePlayer call sites.
- CoursePlayer: conditional third tab "التدريب (N)" — renders only when the
  lesson has ≥1 approved pair AND the student's enrollment covers the video
  (mirrors the enrollment branch only, NOT the free-preview/free-course
  grants). Slice-2 placeholder panel; the deck mounts there in slice 4.
  Owner-verified live: tab present with correct counts (14/1) on the two
  approved Exocad lessons, absent on pending-only lessons and other courses.
- `lib/courses/videoAccess.ts` — §8.1 shared gate: `evaluateVideoAccess()`
  extracted verbatim from the playback-token route, with per-caller
  `allowFreePreview`; the route now calls it (deny/DIAG/issued log lines
  preserved verbatim for production grep).
- Route-refactor verification: 15-case before/after matrix (throwaway
  `slice3test-` auth users + marker-tagged enrollment docs via custom-token
  exchange — all deleted after, teardown re-verified) — byte-identical
  results (`git diff --no-index` exit 0) incl. real Mux manifest 200s on
  enrolled/sectional-owned/free-preview grants.
- Pilot review progress: owner approved first 15 pairs (14 + 1 across two
  Exocad lessons) — enough to verify the entry point; the Phase 2
  full-course gate remains open.

---

## 2026-07-03 — Phase 2 built: instructor Q&A review tab (gate pending pilot review)

Pre-build audit: `docs/AUDIT_QA_REVIEW_UI.md` (mount point, action/auth
conventions, clip-attestation mechanics, approval-write design; key finding:
edits would have broken the §5.3 import firewall). Build (uncommitted at
entry time; commit follows owner diff review):

- `app/actions/qa_review_actions.ts` — six transactional server actions
  (list/approve/bulkApprove/reject/edit/revokeApproval), modeled on
  `sectional_config_actions.ts` (typed codes + zod + token-as-argument
  ownership gate). Server is the wall: bulk takes NO pair ids (server-side
  selection + per-doc re-checks), `classifyQuarantine` re-run authoritative
  at every write, numeric pairs need explicit confirmation, sentinel pairs
  unapprovable, stale pairs `QA_STALE`, rejection never deletes, approved
  pairs edit-locked behind `revokeApproval` + `reviewHistory` append.
- `components/qa_review/QaReviewTab.tsx` + third CourseDashboard tab
  ("مراجعة الأسئلة", grid-cols-3): quarantined-first grouping, per-video
  >20% flag-rate re-record banner, ONE player per expanded group,
  clip attestation bound to the single active pair, numeric checkbox,
  save-per-row RTL editing, per-video bulk-approve with skipped reporting.
- `SignedMuxPlayer`: retriable error placeholder for all non-VIDEO_NOT_READY
  token failures (was: broken tokenless player) — benefits all consumers.
- Firewall fix: immutable `importContentHash` on pairs (import.mts writes it;
  migrate matches on it; approved OR edited docs' evidence protected);
  backfilled 426/426 (`scripts/pipeline/backfill_import_hash.mts`). Verified:
  `--migrate` dry-run reconciles 426 identical / 0 new / 0 stale.
- Follow-ups filed, NOT this phase: `getCourseVideos` is unauthenticated;
  `permanentlyDeleteCourse` orphans qa/transcripts subcollections.
- Post-ship polish (same day): review-UI numerals switched to Arabic-Indic
  via a display-only `toArabicNumerals` helper (data stays ASCII); bulk
  button relabeled "اعتماد الأسئلة النظيفة (N)"; attestation gate scoped —
  HARD for numeric pairs (+ sentinel still blocked), recommended-but-
  skippable with a visible note otherwise (invariant 4 + model C + ledger
  updated). Third follow-up filed: additive `approvalAttested` boolean +
  §13 q5 ship-gate re-scope, targeted before Phase 3 launch.
- Phase 2 gate (pilot course fully reviewed by its instructor) NOT met yet.

---

## 2026-07-03 — Q&A evidence fields persisted + study-features canonical doc

- `scripts/pipeline/run.mts`: `QaRecord` now persists `sourceSegmentIds` (the
  raw segment ids as cited by Claude — the evidence chain) and
  `compressionRatio` (worst-case across resolved cited segments). Additive
  only; resume semantics and the validated prompt untouched. Pairs generated
  before this change lack the two fields — regenerate Q&A from the existing
  transcripts (delete `qa.json` per video; `transcript.json` is reused) before
  any Firestore import.
- New canonical doc `docs/RUBIK_STUDY_FEATURES.md` — study-features vision &
  phase gates: the normative Firestore Q&A/transcript schema (supersedes the
  `RUBIK_AI_CHAT.md` §3 sketch; closes its §9.2), publishing model C
  (per-video bulk-approve of non-quarantined pairs; flagged / citation-sentinel
  / numeric-tripwire pairs require individual clip-attested review),
  content-safety invariants, and the phase ladder (wedge = cited open-ended
  study companion, not MCQ; exam/certification demoted behind explicit
  prerequisites). Registered in CLAUDE.md; ownership back-links added in
  `RUBIK_AI_CHAT.md` §3/§9. This resolves the 2026-07-02 entry's "undecided
  next steps" at the spec level — implementation still pending.
- `docs/MOBILE_API_MIGRATION.md` corrected to shipped reality: playback-token
  TTL is 7200 s (doc claimed ≤ 5 min), there is no free-course
  (`price === 0`) bypass in the gate or the mobile lock recipe (completed
  enrollment always required), the untagged-video sectional grant was added to
  the recipe, and the playback-token route row now matches `route.ts`
  step-for-step (incl. `thumbnailToken` in the response).
- Full-corpus regeneration executed the same day, after the evidence-fields
  change: deleted all qa.json (transcripts kept), re-ran `--course` on both
  courses — 21 videos regenerated from existing transcripts, 4 more DDL
  videos newly pulled + GPU-transcribed, 0 failures. Final snapshot
  (maintained in `RUBIK_STUDY_FEATURES.md` §3): 2 courses / 25 videos /
  426 pairs / 24 flagged, **all pairs carrying
  `sourceSegmentIds` + `compressionRatio`** (verified: 0 missing). Owner
  completed the first off-machine drive backup of `output/` the same day
  (pre-regeneration — needs a re-sync; runbook: re-sync after every run).
- Standing operational note: `output/` (all transcripts + pairs) exists only on
  the pipeline machine, gitignored — off-machine backup required after every
  run.
- Verification: `npx tsc --noEmit` (only the known pre-existing `.next/types`
  errors), `npm run lint` (pre-existing warnings + the pre-existing
  `CoursePlayer.tsx` duplicate-import error; nothing new from this change).
- **Phase 1 shipped (same day, later):** `lib/qa/contentHash.ts` (shared
  norm/hash/tripwire/quarantine module — Phase 2 review actions must reuse
  it) + `scripts/pipeline/import.mts` (dry-run by default, `--write` to
  commit, `--migrate` reconcile; per-video atomic WriteBatch with the
  transcript doc as the §5.3 firewall marker; pair↔transcript coherence
  check; fresh doc IDs, dedupe by contentHash). Pre-write: console rules
  fetched read-only via the Rules API — courses rule is single-segment,
  catch-all is deny-all, so qa/transcripts are client-denied by default (no
  fix needed). Import: 426 qa docs + 25 transcript docs across both courses,
  0 refused, quarantine 54 (31 numeric / 0 sentinel / 23 flagged). Smoke
  test (client SDK forced-long-polling + Firestore REST): qa/transcript
  reads return permission-denied / HTTP 403 for unauthenticated AND
  signed-in non-admin, control course read 200 — rules evaluation proven.
  Canonical audit: `docs/AUDIT_QA_IMPORT.md`. Phase 1 gate ticked in
  `docs/RUBIK_STUDY_FEATURES.md`; next: Phase 2 instructor review tab.

---

## 2026-07-02 — Transcription pipeline (`scripts/pipeline/`)

Commits `e47ae96` + `dceea96`. New standalone pipeline that turns course videos
into instructor-reviewable Q&A: Firestore lookup (read-only) → signed-HLS audio
pull (reuses `lib/mux/playbackToken` + local ffmpeg) → faster-whisper large-v3
transcription with per-segment confidence → grounded Arabic Q&A via
`claude-sonnet-5` structured output. Writes files under
`output/{courseId}/{videoId}/` ONLY — zero Firestore/Mux writes, no routes, no
UI. Usage: `npm run pipeline -- --video <courseId> <videoId> | --course <courseId>`;
full env/resume semantics in the `run.mts` header. Per-video error isolation
(`_errors.log`, batch continues), qa.json-based resume, transcript-level reuse
for cheap prompt iteration. GPU CUDA float16 (~11x realtime on the RTX 4070,
quality at parity with CPU int8) with automatic CPU fallback
(`PIPELINE_DEVICE=auto|cuda|cpu`); the `auto` path probes with 1 s of silent
inference because CUDA model construction succeeds even when cuBLAS is missing.
Anthropic key is `PIPELINE_ANTHROPIC_API_KEY` (explicit `apiKey` +
`authToken: null`) so an ambient `ANTHROPIC_API_KEY` from other tooling can
never shadow it. Side effects: `.gitignore` repaired (mixed-encoding tail had
silently broken the `app/*/debug` rules) and narrowed so `scripts/pipeline/` is
tracked while `scripts/spike/` + `output/` stay ignored; tsconfig now
typechecks `**/*.mts`; new deps `@anthropic-ai/sdk` + `tsx` (dev).

First real run: course `ViNmx1xEiVma4BlxDNcl` (10 videos, 2h08m audio) in
~35 min → 210 Q&A pairs, 19 flagged `needsReview` (any source segment breaching
faster-whisper's reject thresholds). Undecided next steps: Firestore storage
shape for transcripts/Q&A and the instructor review UI (all pairs ship as
`status: "pending"`).

---

## 2026-07-02 — Docs maintenance

Ran the `docs/maintenance/update.md` procedure. Committed two canonical docs +
their skills that CLAUDE.md already referenced but that had never been committed
(`docs/UPLOAD_ARCHITECTURE.md`, `docs/COURSE_APPROVAL_PUBLISHING.md`, and the
`upload-architecture` + `course-approval` skills). Archived four completed audits
to `docs/archive/` with SUPERSEDED headers: `NAV_AND_COURSE_EDITOR_AUDIT` and
`COVER_PHOTO_PROPAGATION_AUDIT` (this batch's fixes shipped and merged), plus the
discovery audits `AUDIT_IMAGE_OPTIMIZATION` and `AUDIT_IPAD_UPLOAD` (findings
distilled into `docs/UPLOAD_ARCHITECTURE.md`). Trimmed CLAUDE.md back under its
120-line budget and added a `cover-image-rendering` skill pointer.

---

## 2026-07-01 — Fix React #418 hydration mismatch (pin en-US on number formatting)

Branch: `fix/hydration-locale-digits`. Root cause (diagnosed in the prior
post-batch step): `Number.toLocaleString()` called with **no locale** renders
during SSR of client components on public pages — the Vercel Node server emits
Latin digits (`50,000`) while an Arabic-locale browser emits Arabic-Indic
(`٥٠٬٠٠٠`) → text hydration mismatch → React #418 (production/Arabic-only; invisible
in an en-US dev browser).

### Fix
Pinned `"en-US"` on **every** number `.toLocaleString()` call in the codebase so
digits are always Latin and identical server/client. Purely deterministic — no
value, currency symbol, or suffix (`د.ع` / `IQD`) changed; grouping stays
`50,000`. **72 call sites across 26 files** (`app/`, `components/`, `lib/`);
`grep` confirms 72/72 pinned, 0 unpinned. Primary site: `lib/sectional/displayPrice.ts`
`format()` (the shared price formatter behind every card/detail/catalog price).

Pinned everywhere (not just SSR-reachable sites) for consistency, per the rule
"when unsure whether a call is SSR-reachable, pin it; pinning client-only ones is
harmless." SSR-reachable public sites (the ones that actually caused #418):
`lib/sectional/displayPrice.ts`, `components/CoursePreview.tsx` (course detail),
`components/EnrollButton.tsx`, `components/PackageUpsellBanner.tsx` (home),
`components/sectional/*`, `components/paymentSelector.tsx`. Client-only/auth-gated
sites pinned for consistency: `CourseDashboard`, `WalletBalance` (renders `0` on
SSR anyway), `earnings/*`, `admin-dashboard/*`, `wallet/transactions`,
`DeleteAccountClient`, `quick_course_form`, `SectionListEditor`,
`PackageCheckoutDialog`, plus the `wallet_actions.ts` server-action message string.

Not touched (already deterministic — explicit locale): `toLocaleDateString(...)` /
`Intl.DateTimeFormat(...)` calls, which all pass `"en-US"` / `"ar-SA"` / `"ar-IQ"`.

### Verification
- `npx tsc --noEmit`: no new errors (only the known pre-existing
  `admin/sync-enrollments` + `[courseId]` `params` errors).
- `npm run build`: 54/54 pages.
- Grep proof: 72/72 code `.toLocaleString(` calls pinned to `"en-US"`; 0 unpinned.
  (#418 is Arabic-locale/production-specific, so verification is "every
  SSR-reachable call is pinned," not a local repro.)

---

## 2026-07-01 — Post-batch cleanup (revalidatePath on cover actions + navbar imports)

Branch: `chore/post-batch-cleanup`. Two low-risk fixes from the post-batch
leftovers. (Two accompanying read-only diagnoses — image transformation-leak and
React #418 — were delivered as findings for owner decision, not implemented.)

### 3a — `revalidatePath` on cover save/delete (`app/course-upload/action.ts`)
`SaveThumbnail` and `DeleteThumbnail` persisted `thumbnailUrl` but never
revalidated, so server-rendered cover surfaces (course detail + home/catalog
grid) kept showing the stale cover string until their cache expired. Added
`revalidatePath(\`/course/${courseId}\`)` + `revalidatePath("/")` before each
success return (mirrors `publishCourse`/`unpublishCourse`). These are the two
public server-rendered cover surfaces (`app/course/[courseId]/page.tsx`,
`app/page.tsx`); the instructor/admin list routes are dynamic (`cookies()`), so
they re-fetch per request and need no revalidation. Deliberately **not**
`router.refresh()` (that is the Symptom 2 bounce).

### 3b — remove now-unused navbar imports (`components/navbar.tsx`)
The Symptom 3 fix removed the resize listener, leaving `useEffect` and the
pre-existing `Monitor` (lucide) imports unused. Both removed. (`useEffect` was
only referenced by the S3 fix's commented-out block; that dead comment is left
as-is per scope.)

### Verification
- `npx tsc --noEmit`: no new errors (only the known pre-existing
  `admin/sync-enrollments` + `[courseId]` `params` errors).
- `npm run build`: 54/54 pages.

### Related read-only findings (NOT implemented — owner decides)
- **Image transformation-leak:** next.config has **no** leak mitigation
  (`minimumCacheTTL`/`deviceSizes`/`imageSizes` unset). But the rotating-token
  leak source is **already neutralized in code** — the Mux thumbnail was removed
  from `video_uploader.tsx` and `SignedMuxThumbnail` is imported nowhere (dead);
  covers now use plain `<img>`. Remaining optimizer users (Google avatar, ZainCash
  logo) have stable, cacheable URLs. Proposed (unapplied) defensive config +
  `unoptimized` on the dormant Mux/legacy components.
- **React #418:** root cause is `Number.toLocaleString()` with **no explicit
  locale** (shared `lib/sectional/displayPrice.ts` `format()` + inline calls in
  `CoursePreview.tsx`), SSR'd on public pages → Latin digits on the server vs
  Arabic-Indic on Arabic-locale browsers → text hydration mismatch. The
  `user_dashboard/layout.tsx` `isClient` gate is **not** the cause (it renders an
  identical spinner server/client). Proposed fix: pin the locale/numberingSystem.

---

## 2026-06-30 — Create Course enterable on all screen sizes (Symptom 3)

Branch: `fix/create-course-small-screen-access`. Implements **only** Symptom 3
from `docs/NAV_AND_COURSE_EDITOR_AUDIT.md`. Closes out the nav/course-editor audit
batch (Symptoms 1, 2, 3 now all fixed).

### Root cause
`components/navbar.tsx` `handleCreateCourseClick` was a **small-screen-only**
interstitial: on viewports `< 768px` it ran `e.preventDefault()` + a
`window.confirm()` recommending an iPad/laptop, and **cancelling silently
dead-ended** navigation into the "إنشاء دورة" (Create Course) flow.

### Change (guard-only handler — removed)
Discovery: the handler did nothing but the confirm guard, and the `isMobile`
state + its resize-listener `useEffect` existed solely to feed it. All three
removed (kept commented for reversibility). The "إنشاء دورة" links now navigate
natively via `ProtectedLink`, exactly like every other nav item:
- Desktop link: dropped `onClick={handleCreateCourseClick}` entirely.
- Mobile-menu link: reduced `onClick={(e) => { setOpen(false);
  handleCreateCourseClick(e); }}` to `onClick={() => setOpen(false)}` —
  **preserving** the hamburger-menu close (shared by every other mobile link),
  removing only the guard call.

No screen-size block remains on the Create Course route/form (verified: no
`innerWidth`/`matchMedia` guard in `app/course-upload/*` or the create form;
`/course-upload` was already reachable by direct URL on any viewport). The
unrelated `window.innerWidth < 1024` in `components/ui/CoursePlayer.tsx` is the
video-watching UI, not the create flow.

### Verification
- `npx tsc --noEmit`: no new errors (only the known pre-existing
  `admin/sync-enrollments` + `[courseId]` `params` errors). `noUnusedLocals` off,
  so the now-unused `useEffect`/`Monitor` imports left in `navbar.tsx` don't error.
- `npm run build`: 54/54 pages.
- Manual (owner, narrow viewport): clicking **إنشاء دورة** navigates straight into
  `/course-upload` — **no confirm dialog, no dead-end** — on phone-width screens.

---

## 2026-06-30 — Course covers bypass the Next image optimizer + delete-clear fix

Branch: `fix/course-editor-refresh-bounce` (same branch as Symptom 2; this folds
the cover-editor follow-up). Root cause confirmed in
`docs/COVER_PHOTO_PROPAGATION_AUDIT.md`: on the **Vercel Hobby tier the Next image
optimizer (`/_next/image`) returns HTTP 402** (transformation quota), so every
course cover rendered through `next/image` broke — raw broken icon in the editor
(no `onError`), book placeholder on catalog cards (`onError` fired). The **raw
Firebase Storage download URLs return 200** with real bytes; the bytes and the
persisted URL were never the problem — only the optimizer indirection.

### Step 1 — render course covers with a plain `<img>` (bypass the optimizer)
Course covers/thumbnails ONLY. Each `<Image>` (next/image) replaced with a plain
`<img>` pointing at the raw Firebase URL — zero `/_next/image`, zero
`remotePatterns` dependency, works regardless of deployed config. Visuals
preserved (`fill` → `className="absolute inset-0 h-full w-full object-cover …"`),
`onError` fallbacks kept, `loading="lazy"` added. Old `<Image>` kept commented for
reversibility. Surfaces changed:
- `components/thumb_nail_uploder.tsx` — instructor editor cover preview.
- `components/CoursesCardList.tsx` — **both** card variants (admin + user). This
  one component backs the public catalog (`publicCoursesCardList`), the home grid
  (`HomeCoursesSection`), and the instructor/admin "my courses" lists.
- `components/CoursePreview.tsx` — course detail hero.

Left on `next/image` (out of scope — not course covers): Google avatar
(`user_dashboard/layout.tsx`), ZainCash logo (`paymentSelector.tsx`), Mux video
thumbnails (`SignedMuxThumbnail.tsx`), and the legacy/unused `muti_image_uploader`
(only imported by the unreferenced `ui/property-form.tsx`; the live create flow
uses `quick_course_form`, which renders no remote cover).

### Step 2 — delete cover now clears without a hard refresh
`components/CourseDashboard.tsx` delete handler: the visible editor cover is bound
to the react-hook-form **`image`** field (`ThumbNailUploader image={field.value}`),
not to `course.thumbnailUrl`. 08531b8 cleared `course.thumbnailUrl` (an unrendered
source), so the cover lingered until a hard refresh. Added
`form.setValue("image", undefined)` alongside the existing `setCourse` (kept,
harmless). No `router.refresh()` reintroduced (that is the Symptom 2 bounce).

### Verification
- `npx tsc --noEmit`: no new errors (only the known pre-existing
  `admin/sync-enrollments` + `[courseId]` `params` errors). `noUnusedLocals` is
  off, so the now-unused `Image` imports (left for reversibility) don't error.
- `npm run build`: 54/54 pages.
- **Structural proof** (local `next start`, fresh build): served HTML of `/`
  (catalog cards) and `/course/<id>` (hero) contains raw
  `<img src="https://firebasestorage.googleapis.com/...">` with `0` `data-nimg`
  and no `/_next/image?url=` for covers. (Local optimizer returns 200, so local
  can't reproduce the 402; this check only proves the bypass is in effect.)

### New skill
Extracted `.claude/skills/cover-image-rendering/` capturing the 402 constraint,
the plain-`<img>` rule for covers, the Firebase-Storage cover plumbing, and the
RHF form-field binding gotcha.

---

## 2026-06-30 — Course-editor delete/publish bounce fix (Symptom 2)

Branch: `fix/course-editor-refresh-bounce`. Implements **only** Symptom 2 from
`docs/NAV_AND_COURSE_EDITOR_AUDIT.md` (deleting a cover photo — and publishing /
unpublishing / uploading a cover — bounced the user to `/`). Symptoms 1 and 3
untouched.

### Root cause (not fixed here, by design)
The bounce's true root cause is middleware + `firebaseAuthToken` cookie staleness
mid-session: a client `router.refresh()` re-issues the editor route's RSC request,
which passes through `middleware.ts` and gets redirected to `/` when the cookie
has expired. Per instructions we did **not** touch middleware or the
refresh-token route — instead we removed the client-side `router.refresh()` calls
that re-ran the protected route, so the bounce is impossible regardless of cookie
state.

### Changes — all in `components/CourseDashboard.tsx`
Replaced `router.refresh()` with a local-state update in four handlers. Each old
line is left commented for reversibility.
- **`handleDeleteThumbnail`** (primary reported bug): now
  `setCourse({ ...prev, thumbnailUrl: undefined })`. The server delete already
  persisted `thumbnailUrl=null`; the `ThumbNailUploader` clears the form image
  field itself after `onDelete()` resolves, so the cover disappears immediately.
- **`onImageSubmit`** (cover upload): `setCourse` already set the new URL; added
  `form.setValue("image", { id, url, isExisting: true })` so the form image
  matches a post-refresh state. Dropped the refresh.
- **`handlePublish` / `handleUnPublish`**: local `setCourse({ status })` already
  drove the editor badge; dropped the refresh. The public course page is still
  revalidated server-side via `revalidatePath()` inside `publishCourse` /
  `unpublishCourse`, so no server revalidation is lost.

### Left as `router.refresh()` (flagged, out of scope)
- `SectionListEditor`'s `onSaved={() => router.refresh()}` (~line 1086). It is
  not one of the three audit-named latent spots, and a section save returns
  server-derived data the client does not already hold, so a local-state mirror
  isn't a safe drop-in. Left unchanged; will bounce too on a stale cookie until
  the middleware/cookie root cause is addressed separately.

### Verification
- `npx tsc --noEmit`: no new errors (only the pre-existing `admin/sync-enrollments`
  and `[courseId]` `params` errors). Note `Course.thumbnailUrl` is
  `string | undefined`, so the delete mirror uses `undefined` (the typed
  equivalent of the server's `null`; both falsy to every consumer).
- `npm run build`: compiled successfully, 54/54 pages.
- Behavioral expectation (can't reproduce the original bounce — it only fired on
  a stale cookie; removing the refresh makes it deterministically impossible):
  delete/upload/publish/unpublish update the editor UI immediately and persist on
  a manual reload.

---

## 2026-06-29 — Navigation slowness + jarring skeleton fix (Symptom 1)

Branch: `perf/nav-and-route-loading`. Implements **only** Symptom 1 from
`docs/NAV_AND_COURSE_EDITOR_AUDIT.md`. Symptoms 2 (cover-photo delete bounce)
and 3 (small-screen create-course guard) are intentionally untouched — separate
branches/sessions.

### Step 1 — `NavigationButton` no longer feels laggy
- `components/NavigationButton.tsx`: removed the fixed `setTimeout(..., 1000)`
  fake spinner (it was decoupled from real navigation). The component is now a
  styled, **prefetching** `next/link` instead of `router.push`, and the pending
  spinner is driven by `useLinkStatus` (Next 15.3+) so it reflects the actual
  App Router transition. Old implementation preserved in a trailing comment.
- `app/user_dashboard/createdCourses/page.tsx` and `app/course-upload/page.tsx`:
  dropped the redundant `<Button asChild>` wrapper around `NavigationButton`
  (was nested buttons); the single styled link-button carries the classes.

### Step 2 — route-level loading skeletons (kills the jarring snap)
- Added `app/course-upload/loading.tsx` and `app/admin-dashboard/loading.tsx`
  (segments previously had no `loading.tsx`). Both approximate the destination
  layout (header band + card grid) rather than a bare centered spinner.
- Added `app/user_dashboard/createdCourses/loading.tsx` so that slow grid route
  shows a content-shaped skeleton instead of the global centered spinner in
  `app/user_dashboard/loading.tsx` (left in place for the other sub-routes).

### Step 3 — stop the multi-second blocking stall
- `data/auth-server.ts`: wrapped `getCurrentUser` in React `cache()` to dedupe
  its two Firebase-Auth round-trips across layout + page in one request. Auth
  semantics unchanged (still `verifyIdToken` then `getUser`; the two are a real
  dependency so they remain sequential).
- `components/instructorCourse.tsx`: the independent `searchParams` and
  `cookies()` awaits now resolve concurrently via `Promise.all`. The
  `getCurrentUser → getCourses` dependency chain stays sequential.
- `components/CoursesGridSkeleton.tsx` (new): shared grid skeleton used as a
  `<Suspense>` fallback. Both course-listing pages now wrap `<InstructorCourse>`
  in `<Suspense>`, so the page shell paints immediately and the Firestore-backed
  course list streams in.

### Verification
- `npx tsc --noEmit`: no new errors (only pre-existing `admin/sync-enrollments`
  non-default-export and `[courseId]` non-Promise-`params` errors, unrelated).
- `npm run build`: compiled successfully, 54/54 pages generated.
- Manual route-load check (prod server): `/`, `/login`, `/register` → 200;
  protected routes (`/course-upload`, `/user_dashboard/*`, `/admin-dashboard`)
  → 307 redirect to `/` (expected, no auth cookie); no 500s.

### Flagged / intentionally untouched
- `app/user_dashboard/layout.tsx:147` hydration gate (`if (!auth.isClient)`)
  was **left as-is**. It is a client hydration gate, not the auth gate (auth is
  enforced by middleware), but removing it from a `"use client"` layout risks a
  hydration-mismatch flash and is outside the low-risk envelope of this change.
  Noted for a future pass per audit Symptom 1 root cause #5.
- Admin dashboard's client-side full-collection `onSnapshot` load (audit root
  cause #6) is out of scope here; the new `loading.tsx` only covers the
  navigation/RSC phase, not the post-mount client data load.
- Protected files (`authContext.tsx`, `middleware.ts`, auth form/actions) were
  not modified.
