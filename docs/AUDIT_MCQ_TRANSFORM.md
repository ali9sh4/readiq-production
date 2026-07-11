# Audit — E1 MCQ transform (approved pairs → instructor-reviewed MCQs) — read-only findings

**Date:** 2026-07-07. **Status:** Pre-build discovery. No code written.
**Governing decisions:** `docs/BRAINSTORM_EXAM_JOB_MARKET.md` top decision
block (2026-07-07) — timed MCQ-only exam, **generated from the approved
practice pairs themselves** (no viva, no separate bank), deterministic key,
every question instructor-approved before entering the exam, numeric hard
gate continues, leakage accepted for now. Superseded brainstorm sections are
ignored. Spec context: `docs/RUBIK_STUDY_FEATURES.md` §4–§7, §9 Phase 6
(the MCQ-transform design this rung implements), §10 cost model.

> **TL;DR:** Everything E1 needs exists and is proven — the approved-pair
> read predicate, the shared hash/tripwire module, the Sonnet
> structured-output call pattern, the dry-run-default import discipline, and
> a review tab whose machinery (per-video grouping, one player per group,
> attestation set, numeric checkbox, Arabic-Indic display) transfers almost
> whole. Four load-bearing findings: **(1)** the transform must read
> **Firestore, not `output/`** — instructor edits exist only in Firestore,
> so disk `qa.json` text can be stale; **(2)** MCQs must live in a **separate
> subcollection** (`mcqItems`), because every existing consumer of `qa`
> filters only on `status`/`stale`/`videoId` — a `format` field would leak
> approved MCQs into the flashcard deck and sweep them into `bulkApproveVideo`
> silently; **(3)** "verbatim-faithful correct answer" must be
> **code-enforced** (normalized equality via `lib/qa/contentHash.ts`), never
> trusted to the prompt; **(4)** the source pair can change *after* the MCQ
> is approved (edit/revoke/recall/stale) — the cheap, complete enforcement
> point is **exam-form assembly time**, not a write-fanout from the qa
> review actions.

---

## 1. Where approved pairs live + how the transform reads them

- **Location & predicate.** `courses/{courseId}/qa/{qaDocId}`, §7.1 schema.
  The student-servable class — and therefore the transform's input class —
  is the triple predicate `status == "approved" && stale == false`, exactly
  as `lib/qa/approvedCounts.ts` and `listApprovedQaForStudy`
  (`app/actions/qa_study_actions.ts`) query it. Equality-only filters, no
  composite index needed.
- **Fields the transform needs per pair:** `question`, `answer` (the
  *current* text — possibly instructor-edited), `contentHash` (to freeze as
  `sourceContentHash`), `videoId`, `sectionId`, `sourceStartSec/EndSec` +
  `sourceSegmentIds` (inherited evidence chain, so the MCQ reviewer can
  clip-attest the key), `quarantine` (numeric inheritance).
- **FINDING — read Firestore, not disk.** Instructor edits re-hash
  `contentHash` and change `question`/`answer` **in Firestore only**; disk
  `qa.json` keeps the pre-edit text (`importContentHash` is the disk
  identity). A transform that reads `output/` would resurrect pre-edit
  wording into exam keys. `run.mts` stays read-only vs Firestore by design,
  but `import.mts` is the established precedent for an operator script that
  reads *and* writes Firestore — the transform follows that precedent.
- **Proposed shape: two operator scripts, mirroring the proven discipline.**
  1. `scripts/pipeline/mcq.mts` — reads approved pairs from Firestore,
     calls Sonnet, writes `output/{courseId}/{videoId}/mcq.json` to disk
     (write-last = resume marker, mirroring `qa.json` semantics; disk
     artifact keeps the backup/evidence discipline).
  2. `scripts/pipeline/import_mcq.mts` (or a mode of the first) — disk →
     `mcqItems`, **dry-run default, explicit `--write`**, batch-per-video
     with report table, exactly the `import.mts` safety model.
- **API client pattern:** copy `run.mts` verbatim — explicit
  `PIPELINE_ANTHROPIC_API_KEY` + `authToken: null` (ambient-key shadowing
  guard), `claude-sonnet-5`, `messages.parse` with `zodOutputFormat` on the
  `zod/v4` subpath. Sequential calls are fine at this scale (~25
  per-video calls per course, well under $1 — §10 cost model); the Batch
  API is an optimization for a 10k-pair future, not now.
- **Run via Git Bash** (PowerShell eats `--course` — standing working note).

## 2. Proposed MCQ storage

### 2.1 Location: `courses/{courseId}/mcqItems/{docId}` — separate subcollection

**Rejected alternative:** same `qa` collection + `format: "mcq"` field.
Every existing consumer filters only on `videoId`/`status`/`stale`:
`getApprovedQaCounts` (count query), `listApprovedQaForStudy` (the deck),
`listQaForReview` (unfiltered course fetch), and `bulkApproveVideo`'s
server-side selection. All four would need a format filter added, and the
failure mode of missing one is **silent** — approved MCQs appearing as
flashcards, or MCQs swept into bulk pair-approval. Structural separation
makes the mistake impossible instead of merely guarded.

Consequences of the separate collection:
- Client Firestore rules: the deny-all catch-all should already cover an
  unknown subcollection, but this must be **proven with the same
  permission-denied smoke test** as Phase 1 (SDK + REST, unauthenticated +
  signed-in non-admin), not assumed.
- The course-deletion follow-up already filed for `qa`/`transcripts`
  (`permanentlyDeleteCourse` doesn't delete subcollections) now has a third
  orphan candidate — add `mcqItems` to that same follow-up, not a new one.

### 2.2 Schema (one doc per MCQ)

| Field | From | Notes |
|---|---|---|
| `stem` | transform | The question as presented. v1: source question verbatim (see §4 skip classes). |
| `correctAnswer` | transform, **code-verified** | Verbatim-faithful: `normalizeQaText(correctAnswer) === normalizeQaText(pair.answer)` enforced at generation AND import AND approval. |
| `distractors` | transform | Exactly 3 strings. **Stored unshuffled** — option order is randomized at serve time per attempt; persisting a shuffled array with a correct index would bake in position bias and make identity hashing order-sensitive. |
| `sourceQaDocId` | transform | The approved pair's Firestore doc ID — the required provenance link. |
| `sourceContentHash` | transform | The pair's `contentHash` at transform time. Any later divergence (edit/revoke) is detectable by comparison — the MCQ analog of the §5.2 re-verified hash. |
| `courseId`, `videoId`, `sectionId` | denormalized from pair | Section = the blueprint axis for form composition later. |
| `sourceStartSec/EndSec`, `sourceSegmentIds` | denormalized from pair | Lets the MCQ reviewer clip-attest the key with the existing player mechanic. |
| `status` | review | `"pending" \| "approved" \| "rejected"` — pipeline emits `pending` only, same lifecycle grammar as pairs. |
| `quarantine` | import | `"numeric" \| null`. `isNumericSensitive(correctAnswer)` via the shared module — with verbatim keys this equals the source pair's numeric class by construction, but recompute anyway (defense in depth; survives a future condensed-key decision). Sentinel/flagged classes don't apply (the source pair already cleared review). |
| `mcqContentHash`, `contentHashVersion` | import / re-hash on edit | New preimage in `lib/qa/contentHash.ts` (same module — the no-drift rule): `sha256(videoId \0 norm(stem) \0 norm(correct) \0 sorted norm(distractors) joined \0)`. Distractors sorted post-normalization so meaningless reordering doesn't change identity. |
| `transformModel`, `transformPromptVersion`, `transformedAt`, `importedAt` | provenance | Own version string (`mcq-v1-<date>-<commit>`), independent of the cleanup prompt's. |
| `reviewerUid`, `reviewedAt`, `approvalMode`, `numericConfirmed`, `rejectReason`, `editedAt/By`, `reviewHistory` | review | Mirror §5.2/§5.2b verbatim — same audit grammar, same revoke-before-edit lock. |
| `stale` | lifecycle | Set when the source pair diverges (see §2.3), never deleted. |

### 2.3 FINDING — source-pair divergence after MCQ approval

A pair can be edited, revoked, recalled to `rejected`, or stale-marked
*after* its MCQ is approved. The MCQ's key would then be attested against
text that no longer stands. Options considered:

- **(a) Write-fanout:** `editPair`/`revokeApproval`/`rejectPair` in
  `qa_review_actions.ts` also stale-mark dependent MCQs. Rejected for v1 —
  it expands a settled, adversarially-reviewed file's scope, and every
  future pair-mutation path must remember the fanout (the same drift class
  the §7.3 no-counters rule exists to avoid).
- **(b) Lazy check at exam-form assembly (recommended):** the exam runtime
  composes a form server-side at attempt start — one batched read of the
  source pairs, drop any MCQ whose source fails
  `status=="approved" && stale==false && contentHash===sourceContentHash`.
  This is the last gate before a student sees the item, it's O(form size)
  reads at an infrequent moment, and it is *complete* (catches every
  divergence class, including ones fanout authors forget).
- Plus **(c) approval-time re-check** in the MCQ approve action (cheap, one
  read in the same transaction) so reviewers don't approve against an
  already-diverged source.

Recommend (b) + (c). Zero changes to `qa_review_actions.ts`.

## 3. Extending the مراجعة الأسئلة review tab

**Reusable nearly whole** (from `components/qa_review/QaReviewTab.tsx` +
the Phase 2 audit):
- The mount pattern (self-contained client component in
  `CourseDashboard.tsx`'s Tabs), per-video grouping with expand, **one
  `SignedMuxPlayer` per expanded group** (mint budget discipline), the
  session `attested` Set bound to a single active item, the
  `numericConfirmed` checkbox flow, save-per-row (Radix unmounts inactive
  tabs), busy-state maps, `toArabicNumerals` display-only digits, RTL
  layout, and the local-state-mirror-never-`router.refresh()` convention.
- The server-action skeleton: `authorize()` (token → course → owner/admin,
  refuse deleted courses), typed error-code union + `fail()`, zod at the
  boundary, transactions with per-doc re-checks, recompute-classification-
  as-authoritative. Model a new `app/actions/mcq_review_actions.ts` on
  `qa_review_actions.ts`; optionally extract the shared `authorize()` into
  `lib/qa/reviewAuth.ts` (small, safe refactor — but optional, not
  load-bearing).

**New:**
- **Surface:** a segmented toggle *inside* the existing third tab
  ("أسئلة التدريب / أسئلة الامتحان") rather than a fourth tab —
  `CourseDashboard` also mounts inside the 280px-sidebar layout where
  `grid-cols-4` triggers the audit's width caveat, and the two reviews
  share the player/attestation machinery.
- **Option rendering:** key visually marked, 3 distractors listed; each of
  the five texts (stem, key, distractors) inline-editable with the same
  edit semantics — edit re-hashes `mcqContentHash`, voids attestation,
  bars from any bulk path, demotes to `pending`. **Except the key:** editing
  `correctAnswer` breaks verbatim-faithfulness, so the key is **not
  editable on the MCQ** — fixing a wrong key means fixing the source pair
  (revoke → edit → re-approve) and re-running the transform for it. UI
  copy should say this.
- **Approval action:** transaction re-checks `mcqContentHash`, recomputes
  the numeric class, verifies the source pair (§2.3c), requires
  `numericConfirmed` for numeric MCQs. Clip attestation reuses the scoped
  invariant-4 rule: **hard gate for numeric MCQs** (seek to the inherited
  `sourceStartSec`, attest the number in the key), recommended-but-skippable
  otherwise (decision block: "بوابة الأرقام الصارمة مستمرة").
- **No bulk approval for MCQs in v1 (recommendation — open question q2).**
  The new failure class — a distractor that is *also arguably correct* —
  is invisible to the tripwire and to acoustic flags; only a human reading
  all four options catches it, and a wrongly-keyed exam item wrongly fails
  a candidate (the harm the whole decision block exists to avoid). At
  pilot scale (≲200 items after yield) individual review is a one-time
  ~1–2 h cost. Revisit bulk once the item-flaw lint (§4.3) has proven
  itself.
- **Source-pair panel:** each MCQ row links its source pair (question +
  answer + status badge) so the reviewer verifies faithfulness in place.

**Zero mobile impact:** web server actions + operator scripts only; no
`/api/*` change, no `MOBILE_API_MIGRATION.md` update in E1.

## 4. Sonnet transform prompt design

### 4.1 Call shape

One call per video (mirrors `run.mts`): input = that video's approved pairs
(the transform targets) **plus the whole course's approved Q&A list as
distractor material** (~200 pairs ≈ well within context; the distractor
pool must be course-wide because a 17-pair video is too thin to source 3
plausible distractors per item). Structured output via `messages.parse` +
`zodOutputFormat`; `max_tokens` sized to the per-video item count.

### 4.2 Prompt rules (new prompt, own version string — `CLEANUP_PROMPT` is untouched)

1. **The correct option is the provided approved answer, unchanged.** The
   model never rewrites it. *And the system doesn't trust this:* the script
   verifies `normalizeQaText` equality and drops/flags any violation —
   verbatim-faithfulness is enforced in code, the prompt is just the first
   line of defense.
2. **Distractors come from inside the provided course corpus** — true
   statements from *other* pairs that are wrong for this stem, or the
   corpus's own contrasts (the Phase 6 rule: the only distractor source
   compatible with no-invention). Never invented clinical facts, never
   altered numbers.
3. **Each distractor must be genuinely wrong for this stem** — not a
   defensible alternative answer. If the model cannot find 3 such
   distractors, it must **skip the pair** with a machine-readable reason
   (`skipped: true, skipReason`), never force weak options. Expected yield
   40–60% (Phase 6 estimate) — likely lower on this corpus (see 4.4).
4. **Register match:** distractors in the same Iraqi-Arabic-with-embedded-
   English register and comparable length/specificity as the key — length
   and register asymmetry are the classic giveaway cues.
5. **Stem = the source question verbatim** in v1. Pairs whose question is
   an enumeration/explanation prompt (عدّد، اشرح، وضّح) don't have a
   single-fact key → skip class `open-ended-stem`.

### 4.3 Code-side lint (deterministic, before review)

Pre-API filter: answers longer than a threshold (~200–250 chars, tunable)
are skipped as `answer-too-long` — paragraph keys make unreadable options
and burn tokens. Post-API lint: normalized-duplicate options (key ==
distractor after `normalizeQaText` = auto-reject), option-length ratio
warning (longest-option-is-correct bias), option count exactly 4,
"all/none of the above" patterns. Lint failures land as `skipped` in the
disk report, visible in the import table.

### 4.4 Honest yield expectation

This corpus is viva-style — many answers are multi-sentence explanations.
Between the length filter, the open-ended-stem class, and the
3-clean-distractors bar, first-run yield may land nearer 30–40% than the
Phase 6 estimate. That is fine: the decision block accepts leakage and the
exam draws from what exists — but set the owner's expectation now, and
record per-skip-reason counts so the yield conversation is data, not vibes.

## 5. Open questions for the owner (before build)

> **قرارات المالك — 2026-07-07 — all seven DECIDED:**
>
> 1. **Storage:** `mcqItems` separate subcollection (as recommended §2.1).
> 2. **Approval mode:** individual-only MCQ review in v1. No bulk path.
> 3. **Long answers:** strict verbatim keys, ~200–250 char skip threshold,
>    accept lower yield. Per-skip-reason counts recorded. Condensed keys
>    deferred — revisit only on yield data.
> 4. **Options:** 4 (3 distractors), fixed.
> 5. **Review surface:** segmented toggle inside the existing
>    مراجعة الأسئلة tab.
> 6. **Dual use:** exam-only in v1. Schema remains compatible with future
>    checkpoint reuse; no checkpoint wiring in E1.
> 7. **Trigger:** script idempotent (keyed `sourceQaDocId` +
>    `sourceContentHash`); operated as deliberate runs after full course
>    review.

1. **Storage:** confirm `mcqItems` separate subcollection (§2.1,
   recommended) over a `format` field on `qa`.
2. **Approval mode:** individual-only MCQ review in v1 (§3, recommended) vs
   a Model-C-style bulk for non-numeric items?
3. **Long answers:** strict verbatim keys + lower yield (recommended v1) vs
   allowing model-condensed keys that then *require* instructor
   edit-approval (a §5.2a-style attestation question — the condensed text
   is no longer the approved pair's text)? If strict: confirm the length
   threshold approach.
4. **Options count:** 4 options (3 distractors) assumed throughout — confirm.
5. **Review surface:** toggle inside the existing tab (recommended) vs a
   fourth CourseDashboard tab.
6. **Dual use:** are approved MCQs exam-only, or do they also feed the
   Phase 6 post-video practice checkpoints later? (Leakage is accepted by
   decision 6, so dual use is coherent — but exam-only is a smaller v1.)
7. **Transform trigger:** run over any approved pair as approvals accrue
   (idempotent re-runs keyed on `sourceQaDocId` + `sourceContentHash`,
   recommended) vs one deliberate run after a course is fully reviewed?

## 6. Build plan sketch (after decisions)

1. `lib/qa/contentHash.ts`: add `mcqContentHash()` (same norm, sorted
   distractors) — shared-module discipline, no second hashing site.
2. `scripts/pipeline/mcq.mts` (Firestore-read → Sonnet → `mcq.json`,
   resume = file-exists) + import step (dry-run default, `--write`,
   report table, source-pair verification, quarantine + hashes).
3. Firestore rules smoke test for `mcqItems` (Phase 1 pattern — prove
   permission-denied, don't assume).
4. `app/actions/mcq_review_actions.ts` + review-tab toggle UI.
5. Verification: lint + `npx tsc --noEmit`, then a REAL walkthrough —
   transform the pilot course, review ~10 items on both dashboard mounts,
   approve one numeric MCQ (hard gate), reject one, edit one distractor,
   verify audit fields + hashes in Firestore, re-run the transform and
   prove idempotence.
6. Docs same commit: `RUBIK_STUDY_FEATURES.md` (Phase 6 status + ledger
   rows), `PROJECT_STATE.md`, addendum here. No mobile-doc change (no
   `/api/*` surface).

---

*Protected files untouched by this audit and by the proposed build:
`qa_review_actions.ts` gains no changes (finding §2.3); `CLEANUP_PROMPT`
and `run.mts` semantics are untouched; the deck/counts/study actions are
untouched because `mcqItems` is structurally separate.*
