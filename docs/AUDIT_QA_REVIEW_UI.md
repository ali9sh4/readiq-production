# Audit — Phase 2 instructor Q&A review tab — read-only findings

**Date:** 2026-07-03. **Status:** Pre-build audit. No code written.
**Spec under audit:** `docs/RUBIK_STUDY_FEATURES.md` §4 invariants 2–5, §5
(publishing model C), §7.1, §9 Phase 2; shared module `lib/qa/contentHash.ts`.
**Corpus in Firestore:** 426 `pending` pairs / 25 transcript docs (Phase 1,
2026-07-03); quarantine 54 = 31 numeric / 0 sentinel / 23 flagged; max 32
pairs on one video (`video_9`).

> **TL;DR:** Everything the tab needs exists and is verified — the mount
> point, the owner/admin token bypass, ref + `onTimeUpdate` pass-through on
> `SignedMuxPlayer`, and the shared hash/tripwire module. The build is
> straightforward with **one real design gap the spec missed**: an inline
> edit re-hashes the pair, which breaks the §5.3 import firewall's
> identity matching — a later `--migrate` would resurrect the pre-edit text
> as a new pending doc AND stale-mark the instructor's edit. Fix = an
> immutable `importContentHash` (small `import.mts` change + one-off
> backfill), shipped with the edit action. Three smaller traps: two of the
> "reference patterns" must NOT be copied (`getCourseVideos` is
> unauthenticated; `loadPreviousVideos` swallows errors), Radix unmounts
> inactive tabs (unsaved edits evaporate → save-per-row), and
> `SignedMuxPlayer` renders a broken tokenless player on `RATE_LIMITED`.

---

## 1. Mount point — confirmed, with three UI caveats

- `CourseDashboard.tsx` is `'use client'` with a single `defaultValues:
  Course` prop, mounted at exactly two routes
  (`app/course-upload/edit/[courseId]`, `app/user_dashboard/createdCourses/
  [courseId]`) with identical props, both behind the middleware page-auth
  matcher. Tabs at `CourseDashboard.tsx:637-651`: change `grid-cols-2` →
  `grid-cols-3`, add a third `TabsTrigger` (`value="qa-review"`, same
  className pattern, its own active color) and a `TabsContent` mounting a
  **self-contained client component** — exactly how `VideoUploader` is
  mounted at `:1201-1206`. The `course` prop already carries `videos[]`
  with `sectionId`/`isFreePreview`/`playbackId`/`title`/`order` — the video
  list needs no extra fetch.
- **Caveat A — Radix unmounts inactive `TabsContent`** (no `forceMount`
  anywhere): tab-switch drops component state. Unsaved inline edits would
  evaporate → **save per row immediately** (the `video_uploader`
  `savingVideoId` pattern), and refetch on tab mount (also keeps ordering
  server-authoritative).
- **Caveat B — width:** the `user_dashboard` mount sits inside a 280px
  sidebar layout with `overflow-x-hidden` (silently clips overflow). Design
  the tab stacked/responsive; verify on BOTH mounts.
- **Caveat C — state convention:** local-state mirror after actions, **never
  `router.refresh()`** (the 2026-06-30 Symptom-2 bounce; the
  `SectionListEditor` refresh at `:1125` is a flagged exception, not
  precedent). RTL: wrap card content `dir="rtl"`, shadcn `Textarea` with
  `text-right` (pattern at `:724-729`) — not `video_uploader`'s raw
  `<textarea>`.

## 2. Server-side reads + auth — confirmed, with two do-NOT-copy warnings

- **Auth pattern (the one to use):** token passed as an argument →
  `adminAuth.verifyIdToken(token)` → load course → `isOwner =
  courseData?.createdBy === uid`, `isAdmin = verifiedToken.admin === true` →
  reject unless either (`basic_info_actions.ts:24-39` et al.). Server
  actions never read cookies. Client obtains the token via
  `auth.user.getIdToken()` (`CourseDashboard.tsx:220`).
- **Model the file on `sectional_config_actions.ts`** (typed error-code
  union + `fail()` helper + zod `safeParse` at the boundary + return fresh
  data for local state) — NOT on `basic_info_actions.ts`, which returns
  free-text error strings.
- **Do NOT copy:** (a) `getCourseVideos`
  (`upload_video_actions.ts:172-210`) — **takes no token, checks no
  ownership**; pre-approval Q&A is sensitive, so `listQaForReview` must be
  fully guarded; (b) `loadPreviousVideos` (`video_uploader.tsx:162-169`) —
  swallows failures into an empty list; the review tab needs a visible,
  retriable error state.
- **Read strategy:** ONE unfiltered `courses/{id}/qa` fetch per course (216
  docs max today), sorted in memory — §5.1's ordering (quarantined-first →
  by video → worst `avgLogprob` first) is multi-key and inexpressible as a
  Firestore query anyway. Writes use equality-only queries
  (auto-indexed; the repo has no `firestore.indexes.json` to record
  composites, so avoid needing any).
- **Locks:** do NOT call `assertCourseMutationAllowed` — review writes
  touch only the qa subcollection, so the helper is a structural no-op and
  calling it implies protection it doesn't provide. Instead explicitly
  refuse review mutations when `course.isDeleted === true` (precedent:
  `package_wallet_actions.ts:142`).
- **Localization:** `lib/sectional/localizeError.ts` is type-bound to
  sectional unions — add a parallel `lib/qa/localizeError.ts` (same
  switch-to-Arabic shape) rather than widening it.

## 3. Clip attestation — confirmed feasible with zero player changes; one gap

- `SignedMuxPlayer` forwards the ref (`MuxPlayerElement` — `currentTime`
  get/set) and ALL extra props (`onTimeUpdate`, `startTime`, …) straight to
  `MuxPlayer` (`SignedMuxPlayer.tsx:14-24, 56-61`); only `tokens` is
  withheld. Owner **and** admin bypass confirmed at the token route
  (`route.ts:65-76` — "Owners must be able to preview their own drafts";
  grant logged `reason=owner|admin`), so the reviewer always mints, even on
  draft/pending courses.
- **Mechanic:** one `SignedMuxPlayer` per expanded video group (never
  per-pair — the hook has zero cross-mount caching, and the 30/min mint
  budget applies to owners too; 15 videos = 15 mints, per-pair = up to 216
  and a self-DoS). `activePair` state + ref-seek to `sourceStartSec` +
  `onTimeUpdate`: if `currentTime` lands inside the **active pair's**
  `[start, end]`, add its id to a session-scoped `attested` Set; pause at
  `sourceEndSec`. Binding the check to the single active pair prevents
  overlapping-window false attestation. `timeupdate` fires ~4×/s, so any
  ≥1 s window is reliably caught. Approve enablement =
  `attested.has(id) && (quarantine !== 'numeric' || numericConfirmed)`.
- **Attestability guard:** sentinel pairs (`classifyQuarantine === 
  'sentinel'`, the FULL 0/0/null triple — the corpus has a legitimate
  0.0s-start pair) get no preview/seek and are edit-or-reject only.
  `flagged` and `numeric` pairs ARE playable — that's their approval path.
- **Gap:** `SignedMuxPlayer` has no error UI beyond `VIDEO_NOT_READY` —
  a `RATE_LIMITED` mint falls through to a tokenless player that 403s
  inside the chrome with no retry. Smallest fix: extend the wrapper's
  placeholder branch to cover all error codes with a retry affordance (the
  hook already exposes `error` + `refetch`, just unforwarded) — benefits
  all four existing consumers.
- Wide spans: show a warning banner on pairs with
  `end - start > 300s` ("نطاق واسع — تحقق بعناية") — one attestation tick in
  a >5-min window is weak verification, and the ≥95% ship gate depends on
  attestation meaning something. (§8.2's 15s pre-roll is a student-side
  hedge — the reviewer seeks to `sourceStartSec` exactly.)

## 4. Approval writes — design confirmed; server is the wall

All actions in one new `app/actions/qa_review_actions.ts` (`'use server'`,
web-only), each running in a **Firestore transaction** (TOCTOU-safe):

- **approvePair(token, courseId, qaDocId, numericConfirmed):** require
  `status === 'pending'` (`QA_NOT_PENDING`) and `stale !== true`
  (`QA_STALE`); **re-verify `contentHash`** via the shared module
  (`QA_HASH_MISMATCH` on drift); **re-run `classifyQuarantine` server-side
  — the recomputed result is always authoritative, the stored field is a
  cache refreshed in the same write**; `numeric` requires
  `numericConfirmed === true` (`QA_NUMERIC_CONFIRM_REQUIRED`). Write
  `status:'approved', reviewerUid, reviewedAt (ISO), approvalMode:
  'individual', numericConfirmed (explicit boolean — the undefined-write
  hazard), quarantine, contentHash, contentHashVersion`.
- **bulkApproveVideo(token, courseId, videoId):** signature takes NO pair
  ids — server-side selection only, so a quarantined id cannot be smuggled
  in. Query `videoId == X && status == 'pending' && quarantine == null`,
  then per doc **re-check everything inside the transaction** (pending,
  not stale, no `editedAt`, hash verified, `classifyQuarantine === null`) —
  failures are skipped and reported, never approved. The re-run inside the
  transaction is THE invariant-2 wall; the query filter is an optimization.
  ≤32 docs today, single transaction.
- **rejectPair(token, courseId, qaDocId, rejectReason):** non-empty reason
  (zod), write `status:'rejected', rejectReason, reviewerUid, reviewedAt`.
  No delete API exists in the file — invariant 5 holds structurally
  (repo-wide grep: nothing else touches the collection).
- **editPair(token, courseId, qaDocId, question, answer):** re-hash +
  re-classify via the shared module; write `contentHash,
  contentHashVersion, quarantine, editedAt, editedBy, numericConfirmed:
  false`; never touch evidence fields, provenance, or `importContentHash`.
  **Attestation-after-edit rule (adopt into §5.2):** any edit invalidates
  prior attestation — the attested claim is about the *text*; edited pairs
  always require fresh individual clip-attested approval and are
  permanently excluded from bulk (server proxy: the `editedAt`-absent
  check).

### 4.1 THE key finding — edits break the §5.3 firewall (fix required)

`import.mts --migrate` matches existing docs by the **mutable**
`contentHash` (`import.mts:327, 353`). After any Phase 2 edit, a later
`--migrate` over the same unchanged `qa.json` would (a) re-create the
pre-edit text as a NEW pending doc and (b) stale-mark the instructor's
edited doc — the edit loses, both ways. Additionally the identical-match
refresh would clobber an edited doc's recomputed quarantine with a
classification of the OLD disk text (the `approved`-only protection at
`import.mts:357` is too narrow).

**Fix (ships in the same commit as the edit action):**
1. `import.mts` new-pair writes add immutable `importContentHash` (= the
   import-time hash — disk-corpus identity).
2. Migrate matching keys on `importContentHash ?? contentHash` (fallback
   keeps un-backfilled docs behaving exactly as today).
3. Widen the evidence-protection condition to approved **or edited** docs
   (`editedAt` set): join-refresh only.
4. One-off backfill `importContentHash = contentHash` across all 426 docs
   (valid because zero edits exist), retiring the fallback immediately.

### 4.2 Immutable-audit tension — decision needed

§5.2 calls the approval record "immutable", yet §7.1 stores it as mutable
doc fields and §5.2 allows edits that "re-attribute". Editing an approved
pair must demote it to `pending` (students key on `status`), which
overwrites the prior record. **Recommended resolution:** edits are allowed
only on `pending`/`rejected` pairs; an approved pair requires an explicit
**revokeApproval** step first, which appends the superseded record
(`{reviewerUid, reviewedAt, approvalMode, numericConfirmed, contentHash,
revokedAt, revokedBy}`) to a `reviewHistory` array on the doc, then sets
`status:'pending'`. Cheap, preserves the audit trail, makes un-approval a
visible deliberate act. (Also allow `approved → rejected` safety-recall,
stamped the same way.)

## 5. Scope confirmations

- **Zero mobile impact:** server actions, not `/api/*` — no
  `MOBILE_API_MIGRATION.md` update. No `/api` route serves qa/transcripts
  (grepped).
- **Nothing serves pairs to students:** no student-facing qa read exists
  anywhere; client Firestore access is deny-all (proven by the Phase 1
  smoke test). Therefore **no `revalidatePath` of any public page** — the
  actions return updated pairs for local state. Do NOT copy the
  admin-dashboard `onSnapshot` pattern (would force opening client rules).
- **Pre-existing gap flagged, out of scope:** `permanentlyDeleteCourse`
  deletes the course doc but not its subcollections
  (`course_deletion_action.ts:191`) — imported qa/transcripts would orphan.
  Now load-bearing; needs a follow-up (extend the deletion service to
  recursively delete `qa` + `transcripts`), tracked separately from Phase 2.

---

## Decisions required before build

1. **Firewall fix scope** — adopt §4.1 (`importContentHash` +
   `import.mts` matching change + one-off backfill of all 426) in the same
   commit as the edit action. *(Recommended: yes — cheapest now, mandatory
   before the first post-edit `--migrate`.)*
2. **Approved-pair edits** — refuse-until-revoked with `reviewHistory`
   append (§4.2, recommended) vs allow-edit-with-silent-demote.
3. **Approved → rejected recall** — allow, stamped (recommended), or
   pending-only rejects.
4. **`SignedMuxPlayer` error/retry extension** — extend the shared wrapper
   (recommended; benefits all consumers) vs a review-tab-local player
   wrapper.
5. **Stale pairs** — excluded from bulk AND individually unapprovable
   (`QA_STALE`) until a migrate resolves them (recommended).

## Build plan (after OK)

1. `validation/qaReview.ts` (zod, Arabic messages) +
   `lib/qa/localizeError.ts` (parallel localizer).
2. `app/actions/qa_review_actions.ts` — `listQaForReview`, `approvePair`,
   `bulkApproveVideo`, `rejectPair`, `editPair`, `revokeApproval` (if
   decision 2 = recommended). All per §4; stable codes `AUTH_FAILED /
   FORBIDDEN / COURSE_NOT_FOUND / COURSE_DELETED / INVALID_INPUT /
   QA_NOT_PENDING / QA_STALE / QA_HASH_MISMATCH /
   QA_NUMERIC_CONFIRM_REQUIRED / QA_QUARANTINED / INTERNAL_ERROR`.
3. `import.mts` firewall fix (§4.1) + one-off backfill (dry-run first,
   verified counts).
4. `components/qa_review/QaReviewTab.tsx` (self-contained client
   component: quarantined-first grouped list, per-video flag-rate banner
   >20%, one player per expanded group, attestation state, numeric
   checkbox, save-per-row RTL editing, bulk-approve button per video with
   skipped[] reporting) + the third tab wiring in `CourseDashboard.tsx`.
5. `SignedMuxPlayer` retry placeholder for non-`VIDEO_NOT_READY` errors.
6. Verification (lenient build — manual): `npm run lint`,
   `npx tsc --noEmit` (expect only pre-existing errors), then a REAL
   walkthrough on BOTH mount routes with the pilot course: approve one
   clean pair (bulk + individual), one numeric pair (checkbox + clip), one
   reject-with-reason, one edit-then-approve; verify the audit fields in
   Firestore; re-confirm the student deny-all smoke result is unchanged.
7. Docs in the same commit: `RUBIK_STUDY_FEATURES.md` (§5.2
   attestation-after-edit + revoke rule, §7.1 `importContentHash` +
   `reviewHistory` fields, Phase 2 gate when the pilot course is reviewed,
   ledger rows for decisions 1–5), `PROJECT_STATE.md`, addendum here.

---

## Addendum — decisions & build (2026-07-03)

Owner decisions: all five as recommended — (1) `importContentHash` fix +
backfill with this phase; (2) approved-pair edits refuse-until-revoked with
`reviewHistory` append; (3) `approved → rejected` recall allowed; (4)
`SignedMuxPlayer` extended with the retry placeholder; (5) stale pairs
`QA_STALE`-unapprovable. Hard requirements honored: single-active-pair
attestation binding; fully-gated `listQaForReview` (sectional-actions
pattern, NOT the unauthenticated `getCourseVideos`); bulk = server-side
selection + per-doc transactional re-checks; edits invalidate attestation
and bar bulk; all hashing via `lib/qa/contentHash.ts`.

**Built:** `app/actions/qa_review_actions.ts` (list / approve / bulkApprove /
reject / edit / revokeApproval — all transactional), `validation/qaReview.ts`,
`lib/qa/localizeError.ts`, `components/qa_review/QaReviewTab.tsx`, third tab
in `CourseDashboard.tsx` (grid-cols-3, purple trigger),
`SignedMuxPlayer` error/retry placeholder, `import.mts` firewall changes,
`scripts/pipeline/backfill_import_hash.mts`.

**Verified:** backfill dry-run predicted 426 → write backfilled 426/426;
insert-only import still skips all 25 videos; **`--migrate` dry-run
reconciles 426 identical / 0 new / 0 stale under `importContentHash`
matching** — instructor edits will now survive re-imports. `tsc` clean
(pre-existing `.next/types` only); eslint clean (operator-script
`no-console` warnings only).

**Follow-ups filed (NOT this phase):** (a) `getCourseVideos`
(`upload_video_actions.ts:172-210`) is unauthenticated — add token +
ownership gate; (b) `permanentlyDeleteCourse`
(`course_deletion_action.ts:191`) deletes the course doc but not the
`qa`/`transcripts` subcollections — extend the deletion service.

**Adversarial review (2026-07-03, post-build):** PASS on all eight checks
(server invariants, auth narrowing, transactions, serialization, import.mts
diff, backfill). Findings fixed before presenting: numeric-masked sentinel
was server-approvable (raw-triple check added to `approvePair`; bulk was
already safe via the `classify !== null` recheck); edit-invalidated
attestation could be instantly re-granted by a still-playing in-window
player (`startEdit`/save now pause + clear the active pair); post-preview
pause-trap (one-shot clear); rejected-edit now clears superseded reviewer
attribution like revoke; zod max-lengths added; preview-while-loading now
toasts instead of silently no-oping; orphan pairs surfaced in the summary.

**Documented consequence (by design, §5.3 + decision 5):** if a future
regeneration DROPS a pair the instructor had edited, migrate stale-marks the
edited doc (its `importContentHash` no longer appears on disk) and it
becomes `QA_STALE`-unapprovable; likewise editing an already-stale pair
cannot make it approvable. The way out is a migrate whose corpus re-produces
the original text. Acceptable while regenerations are rare and deliberate.

**Gate:** Phase 2's gate (pilot course fully reviewed) is NOT met yet —
awaiting the owner's real walkthrough on both dashboard routes.
