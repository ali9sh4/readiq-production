# Audit — Exam runtime (E3): timed one-attempt MCQ exam — read-only findings

**Date:** 2026-07-16. **Status:** Pre-build discovery. No code written.
**Governing decisions:** `docs/BRAINSTORM_EXAM_JOB_MARKET.md` قرارات نهائية
1–7 with the 2026-07-14 amendment (timed MCQ-only, free, **one attempt
ever**, server clock never pauses, admin-only unadvertised reset, opt-in
job-market listing with no scores and no "certificate" wording, leakage
accepted) + `docs/AUDIT_MCQ_TRANSFORM.md` قرارات المالك 1–8 (esp. decision 8:
per-course manual availability switch, OFF until full course review) and its
2026-07-14 one-tap amendment. Shipped substrate: E1 (`mcqItems` schema,
`app/actions/mcq_review_actions.ts`). Access law: the `sectional-invariants`
skill + `evaluateVideoAccess()`.

> **TL;DR:** Everything E3 needs exists. Five load-bearing findings:
> **(1)** exam **eligibility is already decided and codified** — a comment in
> `lib/courses/videoAccess.ts:192-195` records the 2026-07-10 owner decision:
> eligibility = "a completed enrollment exists — ever", deliberately NOT
> expiry-gated, and exam code **must not reuse** the per-video predicate;
> E3 needs its own course-level `examEligibility` helper (full ownership: for
> sectional courses, all sections owned or full/legacy scope). **(2)** The
> one-attempt lock and the immutable attempt cannot share one doc — an
> admin reset would need to overwrite history. Split them: a tiny
> `examAccess/{uid}` lock doc (transactional gate, reset = allowance++)
> plus auto-sequenced immutable `examAttempts/{uid}_{seq}` docs. **(3)** The
> form must be **snapshotted onto the attempt doc, correct indexes
> included** — the attempt collection is client-unreadable, so this is safe,
> it makes grading self-contained, and it immunizes a live attempt against
> mid-exam MCQ edits/revocations. The client only ever receives one question
> via a server action, with no correctness signal even after answering.
> **(4)** The exam route should live under `/user_dashboard/exam/[courseId]`
> — already inside the middleware matcher, so **zero `middleware.ts` change**
> (that file is sensitive territory). **(5)** No cron exists on this stack —
> abandonment is handled by **lazy finalization** at next touch, the same
> read-time-enforcement pattern as `accessExpiresAt`.

---

## 1. Exam config — recommendation: an `examConfig` map on the course doc

**Options considered:**
- **(a) `course.examConfig` map field (RECOMMENDED).** The course doc is
  already loaded by every surface that needs the entry point (player, course
  page) — config rides along with **zero extra reads**. It is ~6 scalar
  fields written rarely (set once, toggled occasionally), so the hot-doc
  concern (§7.3 of the vision doc — no *counters* on the course doc) does
  not apply: this is static config, not a counter. Additive optional field
  on `types/types.ts` `Course` (same pattern as `accessDurationDays`).
- **(b) `courses/{id}/examConfig/config` subcollection doc.** Isolation, but
  +1 read on every player/course-page load that must decide whether to show
  the entry point. Rejected: cost without benefit.

**Proposed shape** (all optional; absent map ⟺ exam OFF — no backfill):

| Field | Type | Notes |
|---|---|---|
| `enabled` | boolean | **Default absent/false = OFF** (decision 8). |
| `questionCount` | number | Form size. If the eligible bank exceeds it, a random per-student draw of this size; see §2 floor policy when the bank shrinks below it. |
| `perQuestionSec` | number | Per-question window (default proposal: 60 — owner q2). |
| `totalSec` | number? | Optional independent total cap. Unset ⇒ derived `questionCount × perQuestionSec`. See §3 timing model. |
| `passPercent` | number | Pass threshold (default proposal: 60 — owner q2). |
| `enabledAt`, `enabledBy` | strings | Audit stamp on flip. |

Written by a new server action `setExamConfig` (owner **or** admin — decision
8 says "admin/instructor"), zod-validated. **Decision-8 server guard
(recommended, owner q6):** refuse `enabled: true` unless the course's review
is actually complete — cheap count queries: `qa` docs with
`status == "pending"` equals **0**, AND approved non-stale `mcqItems` ≥
`questionCount`. Config-flip is also where "bank too small" surfaces as an
actionable error instead of a broken student experience.

Note: the course doc is publicly readable when published, so `examConfig`
values (timer, count, threshold) are visible to clients. Nothing here is
sensitive — students see the timer anyway — and the entry point wants the
values client-side for the warning dialog.

`assertCourseMutationAllowed` is NOT invoked by `setExamConfig` — it guards
`sections`/`purchaseMode` immutability, which exam config never touches
(same reasoning as the qa review actions' documented decision).

## 2. Form assembly — server-side, at attempt start, snapshot with keys

At `startExamAttempt`, inside the flow (reads before the lock transaction,
snapshot written with it):

1. **Draw pool:** `mcqItems` where `status == "approved" && stale == false`
   (equality-only, no composite index). ≤ a few hundred docs per course.
2. **Lazy divergence re-check (E1 audit §2.3(b), verbatim):** batch
   `getAll` the distinct source pairs; drop any item whose pair fails
   `status=="approved" && stale==false && contentHash===sourceContentHash`
   (+ the verbatim-answer equality). The predicate already exists as
   `sourceDiverged()` in `mcq_review_actions.ts` but is module-local; since
   the review surfaces are frozen for this build, **duplicate it into a new
   `lib/qa/examIntegrity.ts` with a pointer comment both ways**, and file a
   follow-up to re-point the review action at the shared module in a later
   janitorial commit (constraint: no review-surface changes now).
3. **Floor policy** when divergence shrinks the pool below
   `questionCount`: proposal — proceed with the full remaining pool if it is
   ≥ 80% of `questionCount` (form is smaller, grading is out of the actual
   form length); refuse to start (`EXAM_BANK_DEGRADED`, admin-visible)
   below that. Owner q8.
4. **Section coverage (cheap, in-memory):** group the pool by the
   denormalized `sectionId`; allocate form slots proportionally to each
   section's share of the pool (largest-remainder rounding), draw randomly
   within each section, top up from the global remainder. Untagged items
   (`sectionId: null`) form their own bucket. O(pool) — include in v1.
5. **Randomize:** shuffle question order; per question, shuffle the 4
   options (`crypto.randomInt` Fisher–Yates — items store
   `correctAnswer` + `distractors[3]` unshuffled by design, E1 §2.2).
6. **Snapshot onto the attempt doc**, per form item:
   `{ mcqDocId, stem, options: string[4] (shuffled), correctIndex,
   sectionId }`. **`correctIndex` lives ONLY here and the collection is
   deny-all to clients** — grading becomes self-contained, and an MCQ
   edited/revoked mid-attempt cannot corrupt a live exam. Size check: 60
   items × ≤ ~1.3 KB ≈ 80 KB, comfortably under the 1 MiB doc limit
   (answers add ~100 B/item).

**The client never receives the form.** All serving goes through
`getCurrentExamQuestion` (§3), which returns exactly one question with no
ids and no correctness. There is no client Firestore read anywhere in the
exam flow.

## 3. Attempt lifecycle

### 3.1 Collections (both under `courses/{courseId}/`, both deny-all)

- **`examAccess/{uid}`** — the lock:
  `{ attemptsAllowed: 1, attemptsStarted: n, resets: [{at, by, reason}] }`.
- **`examAttempts/{uid}_{seq}`** — the attempt (seq = attemptsStarted at
  creation): `{ uid, courseId, seq, status: "in_progress" | "submitted" |
  "expired", preview: false, startedAt, totalDeadlineAt, currentIndex,
  currentServedAt, currentDeadlineAt, form: [...§2 snapshot],
  answers: [{ index, chosenIndex | null, answeredAt | null,
  timedOut: boolean }], configSnapshot: {perQuestionSec, totalSec,
  passPercent, questionCount}, finalizedAt?, supersededByResetAt?,
  resetBy?, resetReason? }`.

**Why two docs (finding 2):** "one attempt, doc-id = uid" is the elegant
lock, but decision 3's admin reset + never-delete history are incompatible
with it — a reset would have to overwrite or move the old attempt. With the
split, the lock transaction reads `examAccess`, refuses when
`attemptsStarted >= attemptsAllowed`
(`EXAM_ALREADY_ATTEMPTED`), then increments and creates
`examAttempts/{uid}_{seq}` **in the same transaction** — that is the
one-attempt wall. Attempts are never deleted, never overwritten.
`configSnapshot` freezes the rules mid-flight (a config edit during an open
attempt must not change its clock or threshold).

### 3.2 Timing model — recommendation: total-clock-primary (owner q5)

All timestamps server-derived ISO strings (repo convention). The clock never
pauses (قرار 3): both deadlines are absolute wall-clock stamps on the doc.

- `totalDeadlineAt = startedAt + totalSec` (or derived count×perQ).
- When a question is served: `currentDeadlineAt =
  min(now + perQuestionSec, totalDeadlineAt)`.
- **(a) Total-clock-primary (recommended):** if the student is absent past a
  question's deadline, the next `getCurrentExamQuestion` marks the current
  question `timedOut` (unanswered), advances, and serves the next with a
  fresh per-question window — but `totalDeadlineAt` keeps burning, so
  absence always costs total budget and can never add time. Simple,
  matches "leaving doesn't cancel and the clock doesn't stop", and the
  total cap is the binding rule.
- **(b) Sequential-burn (alternative):** windows cascade retroactively —
  30 minutes away burns `floor(30m / perQ)` questions individually. Stricter
  reading of قرار 3, more bookkeeping, and (a) already guarantees the exam
  ends on time. Presented for the owner to choose; (a) recommended.

### 3.3 Serving + answering (one question at a time, no going back)

- **`getCurrentExamQuestion(token, courseId)`** — verifies the token owns
  the attempt; **lazy enforcement first**: if `now > totalDeadlineAt` →
  finalize as `expired` (§5) and return the finished state; else if
  `now > currentDeadlineAt` → transactionally mark current `timedOut`,
  advance `currentIndex`, stamp fresh `currentServedAt/DeadlineAt`. Returns
  DTO: `{ index, total, stem, options[4], currentDeadlineAt,
  totalDeadlineAt, answeredCount }` — no doc ids, no correctness, no form.
  Idempotent; safe to call on reconnect/refresh (this is also how a student
  who closed the tab resumes: same action, clock burned).
- **`answerExamQuestion(token, courseId, { index, chosenIndex })`** —
  transactional: refuse unless `index === currentIndex`
  (`EXAM_WRONG_QUESTION` — this is the no-going-back wall; the client has
  no navigation, the server has no path), refuse if
  `now > currentDeadlineAt + GRACE` or `now > totalDeadlineAt + GRACE`
  (`EXAM_TIME_UP`; GRACE ≈ 3 s network-jitter constant, server-side only),
  write the answer, advance, stamp the next question's window — or, on the
  last question, finalize as `submitted` (§5). Response:
  `{ accepted: true, finished: boolean }` — **never whether the answer was
  correct**.
- **Abandonment (finding 5):** no cron exists on this stack (Vercel Hobby;
  nothing scheduled anywhere in the repo). The attempt simply expires by
  timestamp; the *next touch* — the student returning, the student checking
  their result, admin/instructor views — finalizes it lazily inside a
  transaction (idempotent: first finalizer wins). Same lazy-read-time
  pattern as `isAccessExpired`. Consequence to accept: an attempt nobody
  ever touches again stays `in_progress` on disk with a passed deadline;
  every reader derives the effective state from the timestamps, so this is
  cosmetic. Unanswered items grade as wrong (قرار 3's "الامتحان يكتمل
  بالأسئلة غير المجابة").
- **Rate limit:** Upstash sliding window on answer/serve (e.g. 60/user/min,
  fail-open — the deadlines are the real gate, the limiter is an abuse
  bound; same posture as `logStudyEvent`).

## 4. Admin reset (قرار 3: admin-only, unadvertised)

`resetExamAttempt(token, courseId, { studentUid, reason })`:
- **Auth: admin claim ONLY** — not the course owner (the قرار is explicit:
  "للأدمن فقط"; the instructor asks the admin). `reason` mandatory
  (zod, same never-delete grammar as `rejectReason`).
- Transaction: `examAccess.attemptsAllowed++`, append
  `{at, by: adminUid, reason}` to `resets[]`; stamp the latest attempt doc
  with `{ supersededByResetAt, resetBy, resetReason }` (update, never
  delete) and its result doc (if finalized) with `superseded: true` so the
  future listing can never reference it.
- Audit trail = the docs themselves: `resets[]` on the lock +
  the superseded markers, mirroring the `reviewHistory` grammar. No
  separate log collection needed at this volume.
- Unadvertised: no student-facing UI; lives on the admin dashboard only.

## 5. Grading + result

- **Finalize** (on submit of last answer, or lazily on expiry) — inside a
  transaction, from the attempt's own snapshot (self-contained, immune to
  later MCQ edits): `score = count(answers[i].chosenIndex ===
  form[i].correctIndex)`, `scorePercent = round(100·score/form.length)`,
  `passed = scorePercent >= configSnapshot.passPercent`. Deterministic key
  check, zero LLM (E-invariant grammar: exam grading is deterministic).
- **Result doc `examResults/{uid}_{seq}`** (separate from the attempt —
  finding 3's flip side: the result is the small, key-free artifact that
  outlives the heavyweight attempt):
  `{ uid, courseId, attemptId, seq, scorePercent, passed, formLength,
  answeredCount, sectionBreakdown: {sectionId → {asked, correct}},
  finalizedAt, superseded: false }`.
  **This is the سوق التوظيف hook**: a future opt-in listing references a
  result doc id + `passed` — and per قرار 5 shows *no scores* publicly, so
  the shape deliberately keeps everything else server-side. Nothing else is
  built now.
- **What the student sees** is served by `getMyExamResult(token, courseId)`
  (never a client Firestore read): pass/fail at minimum; whether the
  percent and the per-section breakdown are shown is **owner q1/q4**.
  `sectionBreakdown` is computed and stored either way (costless now,
  enables restudy hints later without a migration).

## 6. Student UI surface (web-only)

- **Entry point:** a course-level exam card in the enrolled player
  (`components/player/CoursePlayer.tsx`, mounted at
  `app/course/[courseId]/page.tsx`) — the same surface that hosts التدريب.
  Rendered only when `course.examConfig?.enabled === true` AND the
  eligibility predicate passes (server-computed, passed down like the
  approved-counts pattern — never a client-side guess, invariant-7 grammar:
  client lock mirrors the server gate). Card shows: exam name, question
  count + duration (owner q3), the one-attempt warning, and the student's
  state (not-started / in-progress "أكمل الامتحان" / finished → result per
  owner q1).
- **Eligibility — new `lib/courses/examEligibility.ts`** (course-level; do
  NOT bend `evaluateVideoAccess`, per its own §192 comment):
  1. completed enrollment exists (`enrollments/{uid}_{courseId}`,
     `status == "completed"`) — **ever; `accessExpiresAt` is deliberately
     ignored** (owner decision 2026-07-10, codified in videoAccess.ts).
  2. Full ownership: `purchaseMode !== 'sectional'` → enrolled suffices;
     sectional → `accessScope` unset/`'full'` → eligible (grandfathered /
     bundle, invariants 3–4); `accessScope === 'sectional'` → eligible iff
     **every** `course.sections[].id ⊆ ownedSectionIds` (the exam spans the
     whole course; a 2-of-3-sections owner is not eligible — surface the
     upsell, `EXAM_SECTIONS_INCOMPLETE`).
  3. Course publicly visible (`isCoursePubliclyVisible`) — an unpublished /
     soft-deleted course has no exam, mirroring the video gate.
  Owner/admin are NOT eligible for a real attempt — they get preview (§7).
- **Start flow:** big warning + confirm dialog (قرار 3): one attempt ever,
  total duration, clock never stops, leaving ≠ cancelling, no going back.
  Confirm calls `startExamAttempt` → route to the exam screen.
- **Exam route: `app/user_dashboard/exam/[courseId]/page.tsx`
  (finding 4)** — `/user_dashboard/:path*` is already in the middleware
  matcher, so page auth comes free and **`middleware.ts` is untouched**
  (it is listed territory in `MANUAL_CLEANUP_DO_NOT_AUTOMATE.md`; the
  alternative `/course/[courseId]/exam` would need its own auth plumbing on
  the throwaway viewer route — wrong place twice over).
- **In-exam screen:** question `س ٥ من ٦٠` (Arabic-Indic display-only),
  stem + 4 options (`dir="auto"` per option — Latin terms inside Arabic,
  §8.5), a countdown driven by the server-issued `currentDeadlineAt` /
  `totalDeadlineAt` (client clock renders, server clock decides), a single
  تأكيد button per question (owner q7: confirm-tap vs auto-advance), no
  back affordance of any kind, `beforeunload` warning (UX only — the server
  doesn't care). On `EXAM_TIME_UP` / question timeout the client just calls
  `getCurrentExamQuestion` again and renders whatever the server says —
  reconnect-after-crash works through the identical path.
- **Finished screen:** per owner q1; at minimum "تم إنهاء الامتحان" +
  pass/fail.
- **Mobile:** nothing. View-only stays view-only; no `/api/*` surface is
  added (§ constraints below). A later mobile release may show a static
  "أكمل على الموقع" — someone else's commit.

## 7. Admin/instructor preview — in v1 scope

`startExamPreview(token, courseId)` — owner-or-admin guard (the
qa-review `authorize` pattern):
- Runs the **real** §2 assembly (pool, divergence re-check, section
  coverage, shuffles) and the **real** §3 serving actions — the whole point
  is exercising the production path.
- Writes to `examAttempts/preview_{uid}` with `preview: true` —
  **upsertable** (a new preview overwrites the last; previews are the one
  deliberate exception to attempt immutability), **never touches
  `examAccess`**, **never writes a result doc**.
- Serving/answering actions branch on `preview` only twice: skip the lock
  interaction, and (recommended, owner q10) include correctness in the
  answer response — the owner already sees every key in the review tab, so
  nothing leaks, and it turns preview into a bank-QA tool.
- Preview works even when `enabled` is false — that is exactly when the
  owner needs it (pre-flip check).

## 8. Security map

| Path | Kind | Auth | Checks |
|---|---|---|---|
| `setExamConfig` | server action | owner OR admin (token arg + course.createdBy / admin claim) | zod; decision-8 guard (0 pending qa + bank ≥ questionCount) on enable |
| `startExamAttempt` | server action | authenticated student | eligibility (§6) + `enabled` + transactional `examAccess` lock + §2 assembly |
| `getCurrentExamQuestion` | server action | attempt owner (uid from token == doc uid) | lazy expiry/timeout enforcement; one-question DTO |
| `answerExamQuestion` | server action | attempt owner | index==current, deadlines+grace, transaction; returns no correctness |
| `getMyExamResult` | server action | result owner | owner-q1 visibility shape |
| `resetExamAttempt` | server action | **admin claim only** | mandatory reason; supersede markers; never delete |
| `startExamPreview` | server action | owner OR admin | preview doc only; no lock, no result |
| `examAccess`, `examAttempts`, `examResults` | Firestore (client) | **deny-all** | no client SDK read/write anywhere in the flow |

- **Firestore rules:** rules are console-managed (no rules file in the
  repo). The three new subcollections fall under the deployed deny-all
  catch-all — **verified for `mcqItems` in E1 with the four-context smoke
  test; the identical test must be re-run for `examAttempts` (the one
  carrying `correctIndex`) at build time.** NB: the owner's hardened rules
  draft (seen 2026-07-15) also ends in an explicit `match /{document=**}
  { allow read, write: if false; }` — either ruleset covers these, but the
  smoke test is the proof either way.
- **The key never reaches a client, ever (structural):** `correctIndex`
  exists only on the attempt doc (deny-all) and in server memory; the
  serving DTO has no correctness fields; the answer response returns only
  `accepted/finished`; the result exposes counts, not per-question
  correctness; `mcqItems` itself stays deny-all (E1-proven). Even after
  answering, even after finishing, the client cannot learn any key —
  consistent with leakage-acceptance being about *question text* (قرار 6),
  not answer keys.
- **No Mux interaction** — the exam has no video; no token budget concerns.

## Constraints — confirmed

- **No `/api/*` surface**: every path above is a web server action;
  `docs/MOBILE_API_MIGRATION.md` is untouched by E3. Confirmed: zero
  mobile-contract impact.
- **Protected files** (`MANUAL_CLEANUP_DO_NOT_AUTOMATE.md`): auth orphans,
  Mux signing helpers, `freePreviewVideo` — none touched. `middleware.ts`
  untouched by design (finding 4).
- **No changes to the qa/mcq review surfaces**: the one shared-code want
  (the `sourceDiverged` predicate) is handled by duplication into
  `lib/qa/examIntegrity.ts` + a filed follow-up (§2.2).
- The sectional invariants are respected: eligibility reads
  `accessScope`/`ownedSectionIds` per invariants 2–4, activates sectional
  logic only on `purchaseMode === 'sectional'` (invariant 1), and treats
  the client-side entry card as a mirror of the server gate (invariant 7).

## 9. Open questions for the owner (before build)

> **قرارات المالك — 2026-07-16 — all ten DECIDED:**
>
> 1. **Post-finish:** student sees pass/fail + numeric score. Never
>    per-question correctness.
> 2. **Timing:** total-clock-primary; per-question limit secondary ceiling.
> 3. **Defaults (instructor-overridable config):** ~60–75s/question
>    guideline, pass threshold 60%.
> 4. **Failure restudy hints:** section-level only ("راجع: قسم X"). Defer
>    if non-trivial in v1 — pass/fail+score ships first.
> 5. **Entry card** shows question count + duration before start.
> 6. **Availability switch:** server allows enable only when pending-MCQ
>    count is zero, plus explicit confirm showing bank stats.
>    Warning-guard, not review-completeness inference.
> 7. **Answer flow:** confirm-tap (select → highlight → تأكيد → advance).
>    No auto-advance, no going back.
> 8. **Degraded-bank hard floor:** if assembly-time drops shrink the bank
>    below form size, attempt refuses to start (nothing consumed). Never a
>    silently shorter exam.
> 9. **Admin preview:** real assembly path, correct answers visibly
>    marked, watermarked "معاينة", zero writes to real attempt/lock
>    collections.
> 10. **Deadline grace:** 3s, server-side, never surfaced in UI or user
>     docs.

1. **Post-finish visibility:** pass/fail only, or pass/fail + percent?
   (Recommend: both to the student; سوق التوظيف publicly shows neither —
   قرار 5 stands regardless.)
2. **Defaults:** `perQuestionSec` (proposal 60), `questionCount` (proposal
   30 — pilot bank is 73+), `passPercent` (proposal 60). Owner sets per
   course; these are just the form defaults.
3. **Entry point disclosure:** show question count + total duration on the
   pre-start card/dialog? (Recommend yes — informed consent for a
   one-attempt exam.)
4. **The fence:** does a failed student see per-section restudy hints
   ("راجع قسم كذا") or nothing? `sectionBreakdown` is stored either way;
   this is purely a display decision. (Recommend: section-level hints — no
   per-question reveal, keys stay sealed.)
5. **Timing model:** total-clock-primary (recommended, §3.2a) vs
   sequential-burn (§3.2b)?
6. **Decision-8 guard:** enforce review-complete + bank-size server-side at
   enable time (recommended) or trust the human flipping the switch?
7. **Per-question UX:** select → تأكيد button (recommended; an accidental
   tap on a no-going-back exam is unrecoverable) vs tap-to-advance?
8. **Degraded-bank floor** at attempt start (divergence shrank the pool):
   proceed at ≥80% of `questionCount` with a smaller form vs always refuse?
9. **Preview correctness:** show right/wrong per answer in owner/admin
   preview (recommended) or identical-to-student blindness?
10. **Grace constant:** 3 s server-side grace on deadlines acceptable?

## Build plan sketch (after decisions — one slice per checkpoint)

1. `lib/courses/examEligibility.ts` + `lib/qa/examIntegrity.ts` (pure
   helpers, unit-verifiable via a throwaway script against prod reads).
2. `validation/exam.ts` + `app/actions/exam_config_actions.ts`
   (`setExamConfig` + the decision-8 guard) + admin/owner UI toggle
   (location: course dashboard settings area — smallest possible surface).
3. `app/actions/exam_attempt_actions.ts` (start/serve/answer/result/reset/
   preview) — the §3 transactions; smoke test `examAttempts` deny-all
   (four contexts) the moment the first doc exists.
4. Player entry card + warning dialog + `app/user_dashboard/exam/
   [courseId]/page.tsx` (timer, question card, finished state).
5. §6.5-style REAL walkthrough on the pilot course: preview end-to-end;
   real attempt on a throwaway enrolled student (prod-verification harness
   pattern — ask first); timeout burn verified with a short-deadline
   config; late answer refused; one-attempt lock refused on second start;
   admin reset + re-attempt; result doc shape verified raw.
6. Docs same commit: this file's addendum, `RUBIK_STUDY_FEATURES.md`
   ledger + Phase-8-adjacent status note, `PROJECT_STATE.md`. No
   `MOBILE_API_MIGRATION.md` change (nothing `/api/*`).
