# Rubik study features — vision & phase gates

**Status:** Vision / pre-design. **Nothing below is built.** The only shipped
substrate is `scripts/pipeline/` (offline, disk-only output, all pairs
`status: "pending"`).
**Companions:** `docs/AUDIT_RUBIK_AI_CHAT.md` (read first — its §3 content
blocker gates every phase here), `docs/RUBIK_AI_CHAT.md` (runtime chat: model,
caching, cost rails), `docs/PROJECT_STATE.md` (authoritative counts).
**Date:** 2026-07-03. **Vertical:** Dental (Iraqi Arabic with embedded English
technical terms — all UI is RTL with mixed-direction text).

---

## 1. Thesis

The pipeline welds every generated Q&A pair to an exact moment in a course
video (`sourceStartSec` / `sourceEndSec`, derived from per-segment transcript
citations). That timestamp graph — grounded, instructor-approved, in Iraqi
Arabic — is the platform's compounding asset. Every feature in this doc is a
surface over it: study, remediation ("hear the doctor answer it"), review
packs, analytics, and eventually assessment.

Two facts shape everything:

1. **The generated content is open-ended Q&A** (question + free-text answer),
   not multiple-choice. Iraqi dental assessment is oral viva, so this is the
   *native* format, not a gap. The first student surface is a cited study
   companion (flashcard/viva style), not an auto-graded quiz. MCQs are a later
   offline transform (Phase 6).
2. **Nothing reaches a student until it is stored in Firestore and
   instructor-approved.** The pipeline emits `status: "pending"` only;
   `approved`/`rejected` do not exist yet, even as types.

---

## 2. Glossary

- **Pair** — one `QaRecord` as emitted by `scripts/pipeline/run.mts` (see
  Appendix for the exact shape). Open-ended: `question` + `answer` strings,
  Arabic with embedded English terms. Never "quiz item" — no options or
  distractors exist.
- **Approved pair** — a pair whose Firestore doc has `status: "approved"`
  plus reviewer attribution (Phase 2). The only class of pair any
  student-facing surface may read.
- **Remediation clip** — `(courseId, videoId, sourceStartSec, sourceEndSec)`
  rendered via `SignedMuxPlayer` seeked to `sourceStartSec`. Never a raw Mux
  URL. Subject to the sentinel rule (§8.2) and the token budget (§8.3).
- **Quarantined pair** — a pair that can never be bulk-approved: flagged
  `needsReview`, carrying the 0/0 citation sentinel, or matching the numeric
  tripwire (§4, invariants 2–3).
- **Session** — one student study run over a course's approved pairs
  (flashcard flow, later SRS-scheduled).
- **Concept** — *future derived entity.* No topic/tag metadata exists in the
  generated data today; any "concept graph" needs a separate offline tagging
  pass first.

---

## 3. Snapshot (as of 2026-07-03)

The only volatile numbers in this doc. Source of truth: the `output/`
directory on the pipeline machine + `docs/PROJECT_STATE.md`. Refresh this
table whenever the pipeline runs (docs/maintenance/update.md loop).

| Course | Videos processed | Pairs | Flagged `needsReview` | Notes |
|---|---|---|---|---|
| `ViNmx1xEiVma4BlxDNcl` | 10 (2h08m audio) | 216 | 22 | 17 of 22 flags from `video_9` alone — flags cluster by audio quality. |
| `DDL9xpIvN9ejWJKhROIV` | 15 | 210 | 2 (both `video_20`) | 4 videos (`video_25`, `video_14`, `video_28`, `video_29`) were newly pulled + transcribed in the 2026-07-03 regeneration run. |
| **Total** | **25** | **426** | **24** | Imported to Firestore 2026-07-03 (Phase 1); pilot review underway — first 15 pairs approved 2026-07-04. |

> **Evidence chain complete:** the whole corpus was regenerated on 2026-07-03
> *after* the evidence-fields pipeline change — all 426 pairs carry
> `sourceSegmentIds` + `compressionRatio` (verified: 0 pairs missing either
> field). Pair counts differ from the pre-regeneration corpus (366) partly
> because of the 4 newly processed videos and partly because Q&A generation
> is not deterministic across runs — which is exactly why pipeline `qaId`s
> are ephemeral and IDs freeze only at Firestore import (§7.1).
>
> **Operational risk, standing:** the entire corpus (pairs + transcripts)
> exists only on one Windows machine in a gitignored folder. Off-machine
> encrypted backup after every pipeline run is a runbook requirement, not a
> nice-to-have. NB: a drive backup made earlier on 2026-07-03 predates the
> same-day regeneration — re-sync `output/` after every run.

---

## 4. Content safety invariants (non-negotiable)

Mirrors the sectional-invariants pattern: these hold under every phase, every
refactor. Getting one wrong teaches a dentist something false or breaks the
audit trail that proves we didn't.

1. **No pair reaches any student surface without `status: "approved"`** plus
   `reviewerUid`, `reviewedAt`, and a content hash on the approval record.
   `pending`, `rejected`, and quarantined pairs are invisible to students,
   always, on every surface (web, mobile, share pages, packs).
2. **Quarantined pairs cannot be bulk-approved.** Quarantine classes:
   (a) `needsReview === true`; (b) the citation sentinel —
   `sourceStartSec === 0 && sourceEndSec === 0 && avgLogprob === null`;
   (c) numeric-tripwire matches. Quarantined pairs offer only
   *edit-then-approve* (with clip attestation) or *reject*.
3. **Numeric tripwire:** any answer containing a numeral adjacent to a unit
   (`ملم`, `مل`, `مليمتر`, `mm`, `mg`, `ملغ`, `MPa`, `%`, `درجة`, degrees
   Celsius, etc.) is quarantined **even when `needsReview === false`**, and
   approving it requires an explicit reviewer confirmation ("الرقم مطابق لما
   قيل في المحاضرة") in addition to clip attestation. Rationale: Whisper
   mishears numbers at *high* acoustic confidence, and the cleanup model is
   instructed to "correct" using domain priors — a wrong dose/thickness is
   the failure class that reaches a patient, and `needsReview` is
   structurally blind to it (see invariant 7).
4. **Clip-attested approval (scoped 2026-07-03):** the HARD attestation gate
   — Approve disabled until a player `timeupdate` lands inside
   `[sourceStartSec, sourceEndSec]` in that review session — applies to
   **numeric-quarantined pairs** (wrong timestamp + wrong number is the
   clinically dangerous combo; they additionally require the invariant-3
   confirmation). Sentinel pairs remain unapprovable entirely (no valid
   window exists — server-refused on the raw 0/0/null triple). For all
   other pairs attestation is **recommended but skippable**: the reviewer
   may approve without playing the clip, and the UI shows a visible
   "لم تتم معاينة المقطع" note when they do. Consequence, stated honestly:
   approval is no longer a timestamp-accuracy proof by construction for
   non-numeric pairs — see the §13 q5 ship-gate note.
5. **Rejection is never deletion.** Rejected pairs are retained with a reason
   and are admin-visible. (Protects future analytics from silent curation of
   embarrassing/hard questions, and preserves the audit trail.)
6. **Regenerating a published video's Q&A is blocked** without an explicit
   migration step (§5.3). Pipeline `qaId`s are random per run; casual
   regeneration would orphan approvals and student progress.
7. **`needsReview` is an acoustic flag, not an accuracy guarantee.** It fires
   on Whisper's own reject thresholds and citation-resolution failures only.
   It must never be described (in UI, docs, or instructor comms) as a content
   safety net. Content accuracy comes from invariants 1–4.

---

## 5. Publishing model (decided: model C)

Candidate models considered:

- **A** — every pair individually clip-attested. Safest; ~2–3 h review per
  course; instructors won't do it; the supply chain stalls.
- **B** — unrestricted bulk approve. 30-second rubber stamp; invariants 1–4
  become fiction.
- **C (decided)** — **bulk approval is allowed per video, but only over the
  non-quarantined pairs of that video.** Quarantined pairs (invariant 2's
  three classes) always require individual review: attestation per the
  scoped invariant 4 (hard gate for numeric + the tripwire confirmation;
  recommended-but-skippable for audio-flagged), sentinel edit-or-reject
  only. Measured flag rates (19/210 and 0/40) make the realistic review
  effort per course ~20 minutes, not hours.

Supporting rules:

- **5.1 Review order:** the review UI sorts quarantined pairs first, grouped
  by video, worst `avgLogprob` first. A per-video flag rate > 20% surfaces a
  banner suggesting the instructor re-record that lecture (flags cluster by
  audio quality — see Snapshot).
- **5.2 Approval writes an immutable audit record:** `reviewerUid`,
  `reviewedAt`, the pair's `contentHash`, and whether approval was bulk or
  individual. One hash preimage everywhere:
  `sha256(videoId + '\0' + norm(question) + '\0' + norm(answer))` with
  `norm` = NFC + whitespace-collapse + trim, computed by
  `lib/qa/contentHash.ts` — the same module the importer uses, so approval
  re-hashing can never drift from import hashing. Editing a pair re-hashes
  (via the same module), re-runs the numeric tripwire, and re-attributes.
- **5.2a Edits invalidate attestation.** The attested claim ("this answer is
  at this moment") is about the *text*; any question/answer edit voids prior
  attestation. Edited pairs (`editedAt` set) always require fresh individual
  clip-attested approval and are **permanently excluded from bulk approval**
  (enforced server-side in `bulkApproveVideo`).
- **5.2b Approved pairs are edit-locked.** Editing requires an explicit
  `revokeApproval` first, which appends the superseded audit record
  (`reviewerUid`, `reviewedAt`, `approvalMode`, `numericConfirmed`,
  `contentHash`, `supersededAt/By`) to the pair's `reviewHistory` array and
  returns the pair to `pending`. `approved → rejected` safety recall is
  allowed and preserves the record the same way. Rejection remains
  never-deletion (invariant 5).
- **5.3 Regeneration firewall:** once any pair of a video is imported, the
  importer refuses to process a regenerated `qa.json` for that video except
  in explicit migration mode (dedupe by content hash: identical pairs keep
  their Firestore doc ID and status; changed pairs arrive as new `pending`
  docs; disappeared pairs are marked `stale`, never deleted).

---

## 6. Non-goals

Each of these is a mistake a competent contributor would plausibly make:

1. **No mobile purchase/certification transactions, ever** — mobile is
   view-only, DECIDED final (`docs/MOBILE_PROJECT_STATE.md`). Any paid
   artifact is web-only with a "buy on web" prompt on mobile.
2. **No on-demand server-side content generation.** Generation is an offline,
   operator-run, Windows/GPU batch (`scripts/pipeline/`). No tier may assume
   instructor-self-serve or runtime generation.
3. **No answers beyond lecture content.** The grounding rule (answers only
   from the transcript) is both the pedagogical design and the medico-legal
   shield: content is "what the lecturer said in the course you bought," not
   Rubik's clinical advice. Any runtime AI surface refuses out-of-corpus
   clinical questions with a stable error code rather than answering.
4. **No serving `pending`/`needsReview`/quarantined pairs to students**
   (invariant 1).
5. **No raw `playbackId` in any study/Q&A payload** for gated content —
   clients exchange `{courseId, videoId}` at the playback-token route, as
   today.
6. **No server-side clip enforcement in v1.** An issued token plays the whole
   video for 2 hours (empty claims); stop-at-`sourceEndSec` is client-side UX
   only. True clip-scoped tokens = a signer + web/mobile contract change,
   deliberately deferred.
7. **No analytics built on Vercel logs** (Hobby retains 1 hour). Analytics
   read Firestore event/attempt docs written at interaction time.
8. **No embeddings / vector DB** — decided v1 deferral in
   `docs/RUBIK_AI_CHAT.md` §3, inherited here. The interim substitute is an
   offline Sonnet *tagging* pass (string-match territory), if/when needed.
9. **No pre-reveal confidence sliders.** The study flow is retrieval attempt
   → reveal → post-reveal self-grade (the grade feeds scheduling). Bare
   "how confident are you?" prompts before reveal are judgments-of-learning
   with weak validity; cut from the design.
10. **No `/api/:path*` in the middleware matcher; every `/api/*` addition
    updates `docs/MOBILE_API_MIGRATION.md` in the same commit** (CLAUDE.md
    standing rules, restated because every phase here eventually touches
    `/api/*`).

---

## 7. Data model (NORMATIVE)

This section supersedes the `courses/{courseId}/qa/{qaId}` sketch in
`docs/RUBIK_AI_CHAT.md` §3 and closes its open decision §9.2 (storage
location). One schema serves study features *and* chat grounding.

### 7.1 `courses/{courseId}/qa/{qaId}` — the pair

Subcollection (every read is course-scoped; `collectionGroup` remains
available). **The Firestore doc ID is a fresh auto-ID minted at import — the
canonical stable ID; the pipeline `qaId` is never used as a doc ID.**
Pipeline `qaId`s are ephemeral (random per run) and are kept only as
`pipelineQaId` provenance; dedupe across re-imports keys on `contentHash`,
never on IDs. All student progress, SRS state, telemetry, share links, and
approvals key on the Firestore doc ID.

| Field | From | Notes |
|---|---|---|
| `question`, `answer` | pipeline | Arabic + embedded English terms. Editable in review (re-hash on edit). |
| `status` | review | `"pending" \| "approved" \| "rejected"`. Pipeline emits `pending` only. |
| `videoId`, `courseId` | pipeline | Pair is welded to one video. |
| `sectionId` | import (denormalized from the video) | Lets the access gate evaluate without loading `course.videos`. |
| `sourceStartSec`, `sourceEndSec` | pipeline | Min/max over resolved cited segments; **0/0 is a failure sentinel**, not a timestamp (§8.2). |
| `sourceSegmentIds` | pipeline (persisted as of 2026-07-03) | Raw ids as cited by the model — the evidence chain; resolve against the transcript doc. |
| `avgLogprob`, `noSpeechProb`, `compressionRatio` | pipeline | Worst-case over cited segments; `compressionRatio` persisted as of 2026-07-03. |
| `needsReview` | pipeline | Acoustic flag (invariant 7). |
| `quarantine` | import | Single-valued: `"numeric" \| "sentinel" \| "flagged" \| null`, **precedence `numeric > sentinel > flagged`** (numeric is the only class whose trigger isn't otherwise stored on the doc and the only one adding an approval requirement). Computed by `lib/qa/contentHash.ts` `classifyQuarantine()`. |
| `contentHash`, `contentHashVersion` | import / re-hashed on edit | `sha256(videoId + '\0' + norm(q) + '\0' + norm(a))` hex (§5.2 — one preimage everywhere, `lib/qa/contentHash.ts`). Mutable: edits re-hash. |
| `importContentHash` | import (immutable) | The import-time hash — identity with the disk corpus. **Never touched by edits**; `--migrate` matches on it, so instructor edits survive re-imports (backfilled across the corpus 2026-07-03). |
| `transcriptHash` | import | sha256 of the source `transcript.json` bytes — content-addressed pair↔transcript binding (§7.2). |
| `pipelineQaId`, `pipelineRunAt`, `promptVersion`, `importedAt` | import | Provenance. `promptVersion` is operator-supplied (`--prompt-version`, defaulted in `import.mts`) — the pipeline does not emit one yet (flagged follow-up). |
| `isFreePreviewVideo` | import (denormalized) | Cheap catalog query for preview packs (Phase 4). |
| `reviewerUid`, `reviewedAt`, `approvalMode`, `numericConfirmed` | review | The audit record (§5.2). |
| `editedAt`, `editedBy` | review (edit) | Set on inline edit; presence bars the pair from bulk approval forever (§5.2a). |
| `reviewHistory` | review (revoke/recall/edit-of-rejected) | Append-only array of superseded audit records (§5.2b). |
| `rejectReason` | review (reject) | Mandatory; rejected pairs are retained and admin-visible (invariant 5). |
| `stale` | importer | Set (never deleted) when a regeneration no longer produces this pair. Stale pairs are unapprovable (`QA_STALE`) until a migrate resolves them. |

### 7.2 `courses/{courseId}/transcripts/{videoId}` — the segments

Segments array `{id, start, end, text, avg_logprob, no_speech_prob,
compression_ratio}` + metadata (`segmentCount`, `qaCount`, `pipelineRunAt`,
`transcriptHash`, `promptVersion`, `importedAt`). Required for text-level
citation ("show the sentence"), flag re-audits, and future subtitles/search.
A 2h video stays well under the 1 MiB doc limit (largest today: 61 KiB).
**Binding is content-addressed, not clock-based:** a pair's
`sourceSegmentIds` are only rendered against the transcript whose
`transcriptHash` matches the pair's — `transcript.json` carries no timestamp
metadata, and the importer's coherence check (re-deriving each pair's
evidence fields from the transcript before writing) is what makes the
stamped hash truthful. This doc doubles as the §5.3 import marker: it is
written in the same atomic batch as the pairs, so marker-exists ⟺
video-fully-imported.

### 7.3 Per-student state

- `users/{uid}/courses/{courseId}/qaProgress/{qaDocId}` — `{grade history /
  SRS state (dueAt, stability), lastResult, attempts, updatedAt}`. One write
  per answered card.
- Review/telemetry events (append-only): `{uid, qaDocId, courseId, videoId,
  kind: "revealed" | "selfGrade" | "jumpToSource", grade?, elapsedMs,
  at}` — this collection is deliberately the **only analytics substrate**
  (non-goal 7); instructor dashboards aggregate it lazily on load. No
  counters on the course doc (hot-document limit; it already carries
  `videos[]`).

Cost at 1000 students × 200 pairs is single-digit dollars — the binding
constraints are hot docs and doc size, not Firestore pricing.

---

## 8. Access & serving constraints

- **8.1 One gate.** Study surfaces reuse the playback-token route's access
  predicate — owner/admin bypass, free-preview grant, completed enrollment,
  sectional section-ownership with unset/`"full"` scope and untagged-video
  grants (the seven invariants in the `sectional-invariants` skill).
  **Extracted 2026-07-04 (Phase 3):** the single predicate is
  `evaluateVideoAccess()` in `lib/courses/videoAccess.ts`, with a per-caller
  `allowFreePreview` option — the playback route passes `true`, study
  surfaces pass `false` (§13 q1). The route refactor was verified
  behavior-identical: a 15-case before/after matrix (enrolled, sectional
  owned/unowned/bundle/legacy, pending, free-preview, not-found variants)
  returned byte-identical results, with real Mux manifest playback on the
  grants. A pair is servable iff `isCoursePubliclyVisible(course)` AND
  `status === "approved"` AND the caller passes the gate for the pair's
  video — course approval and pair approval are independent gates; don't
  entangle them.
- **8.2 Sentinel rule.** Never render a jump-to-source affordance when
  `needsReview === true` or
  (`sourceStartSec === 0 && sourceEndSec === 0 && avgLogprob === null`) —
  that is failed citation resolution; a naive seek lands at 0:00 and reads as
  a broken product. Also suppress the jump affordance (a UI rule — not a
  fourth quarantine class) when `sourceEndSec - sourceStartSec > 5 min`
  (min/max span inflation across far-apart citations). UI copy hedges: "الشرح يبدأ قرب الدقيقة X" with a
  ~15 s pre-roll — never an exact-second promise.
- **8.3 Token budget.** Tokens are whole-video, 2-hour, empty-claims JWTs;
  minting is rate-limited to 30/user/min and each mint costs a
  `verifyIdToken` + Firestore reads. A study session therefore keeps **one
  mounted `SignedMuxPlayer` per `(courseId, videoId)`**, seeks via ref, and
  fake-stops at `sourceEndSec` with a `timeupdate` listener. Never remount
  per card. Pairs cite their own video, so a per-video deck needs exactly one
  mint; sectional cross-section clips 403 `SECTION_NOT_OWNED` by design —
  render that as a localized upsell (via the `lib/sectional/localizeError.ts`
  pattern), never as an error.
- **8.4 Mobile.** "View-only" bars **purchases**, not study-progress writes —
  but any mobile progress write is a contract expansion: additive
  `/api/study/*` endpoints, Bearer-only, standard envelope, zod under
  `lib/validation/api/`, and `docs/MOBILE_API_MIGRATION.md` updated in the
  same commit. Mobile v1 may instead keep SRS state device-local (no sync) —
  decide in Phase 3 (§13 open question 3). Mobile re-fetches playback tokens
  per play (its contract), so mobile study UX shows one clip at a time.
- **8.5 RTL/bidi.** Answers embed Latin-script terms inside Arabic text
  (`الـ Crown، الـ Bridge`); timestamps render LTR inside RTL sentences. Use
  `dir="auto"` per text node / `<bdi>` isolation, and test with real pairs on
  real devices.

---

## 9. Phases

Naming: *Phases with gates*, not tiers — "tier" is reserved for
`RUBIK_AI_CHAT.md`'s retrieval tiers, and phases carry explicit entry/exit
criteria. Each phase is independently shippable. Verification discipline
throughout: no test suite and the build is lenient — `npm run lint` +
`npx tsc --noEmit` manually, and exercise the real flow (a real playback, a
real review, a real study session) before calling a phase done.

### Phase 0 — Evidence & backup *(pipeline-side; partially DONE)*

- ✅ 2026-07-03: pipeline persists `sourceSegmentIds` + `compressionRatio` on
  every pair (additive; resume semantics untouched). Committed as `484373f`.
- ✅ 2026-07-03: first off-machine drive backup of `output/` done (owner).
  Standing runbook line: re-sync after every pipeline run — the corpus was
  regenerated the same day, so the drive copy needs a refresh.
- ✅ 2026-07-03: full-corpus regeneration — 21 videos re-generated from their
  existing transcripts + 4 DDL videos newly transcribed; all 426 pairs carry
  the evidence fields (verified, 0 missing). Both course batches: 0 failed.
- **Gate to Phase 1:** met (backup exists; evidence-complete corpus on disk).

### Phase 1 — Firestore landing (the critical path)

A standalone operator-run `scripts/pipeline/import.mts` (the pipeline itself
stays read-only against Firestore by design): reads
`output/{courseId}/{videoId}/{qa,transcript}.json`, writes §7's schema in
batches, computes `quarantine` + `contentHash`, denormalizes `sectionId` /
`isFreePreviewVideo`, supports `--dry-run` / `--course`, and enforces the
regeneration firewall (§5.3). This one step simultaneously unblocks review,
study, chat grounding (`RUBIK_AI_CHAT.md`'s content blocker), and gets the
corpus off one laptop.
- **Gate: ✅ MET 2026-07-03.** Both courses imported — 426 qa docs + 25
  transcript docs, 0 refused (`ViNmx…` 216/10, `DDL…` 210/15); quarantine
  54 (31 numeric / 0 sentinel / 23 flagged). Spot-check verified the §7
  field shape and `pair.transcriptHash === transcript.transcriptHash`.
  §6 smoke test confirmed **permission-denied** (SDK) / **HTTP 403
  PERMISSION_DENIED** (REST) on qa and transcript docs for BOTH
  unauthenticated and signed-in non-admin clients, with the control read of
  the published course doc succeeding in all contexts — rules were
  evaluated, not assumed. Console rules pre-checked read-only via the Rules
  API: single-segment courses rule + deny-all catch-all; no fix was needed.
- **Metric:** n/a (infrastructure).
- **Must not:** touch `qa.json` write-last resume semantics; delete anything
  in `output/`.

### Phase 2 — Instructor review

Third tab ("مراجعة الأسئلة") in `components/CourseDashboard.tsx`'s existing
two-tab Tabs layout, behind the existing page-auth matcher. Implements the
publishing model (§5) and invariants 2–5 verbatim: quarantine-first ordering,
clip-attested individual approval (inline `SignedMuxPlayer` — the owner
bypasses the access gate, so preview always plays), numeric confirmation
checkbox, per-video bulk-approve of non-quarantined pairs only, reject-with-
reason, RTL inline editing. Server actions under
`app/actions/qa_review_actions.ts` (web-only server actions — zero mobile
contract impact), guarded by course ownership.
- **Status: built 2026-07-03** — third tab wired, all six server actions
  live (`listQaForReview` fully gated; bulk = server-side selection with
  per-doc transactional re-checks; approve re-hashes + re-classifies;
  reject-with-reason; edit-locked approved pairs via `revokeApproval` +
  `reviewHistory`), firewall `importContentHash` landed and backfilled
  (verified: `--migrate` dry-run reconciles 426 identical / 0 new / 0
  stale). Build docs: `docs/AUDIT_QA_REVIEW_UI.md`.
- **Gate:** ≥1 full course approved by its instructor (the founder's own
  course is the pilot). **Not yet met** — awaiting the owner's real
  walkthrough + pilot review.
- **Metric:** % of imported pairs reviewed within 7 days of import. If this
  stalls, everything downstream is dead — fix review UX before building on.
- **Must not:** offer any bulk action over quarantined pairs; delete rejected
  pairs.

### Phase 3 — The wedge: cited study companion ("اسمع الجواب من الدكتور")

Per-video flashcard deck over approved pairs: question → student attempts
recall → reveal answer → self-grade (Again/Hard/Good/Easy) → optional
jump-to-source clip (§8.2/8.3). Zero LLM runtime cost, zero wrong-grade
liability, viva-native. Log the §7.3 events from day one — jump-taps are the
future analytics substrate. Surface decision: the web course viewer is
officially throwaway (scheduled for deletion post-mobile-launch), so this
ships either as a new web practice route or mobile-first via one additive
read endpoint (`GET /api/courses/{courseId}/qa?videoId=`, approved pairs
only, shared gate) — decide at phase start (§13 q2), don't drift into both.
Also in this phase: extract the shared access helper (§8.1) and settle the
free-preview branch (§13 q1).
- **Status (2026-07-04):** slices 1–5 built. Slices 1–3: per-lesson approved
  counts (`lib/qa/approvedCounts.ts`) + conditional التدريب tab in
  CoursePlayer, and the §8.1 shared gate extracted with the playback route
  refactored onto it (verified behavior-identical). Slices 4–5: the deck —
  `listApprovedQaForStudy` in `app/actions/qa_study_actions.ts`
  (enrolled-only gate, minimal 7-field DTO, server-computed `hasValidClip`)
  + `components/study/QaStudyDeck.tsx` (reveal → نعم/لا → re-queue →
  clip jump per §8.2/8.3). Owner-verified on a real enrolled account:
  reveal/self-grade/clip-jump, dual-direction audio pause, per-lesson deck
  reset. Event logging (slice 6) pending (build plan:
  `docs/AUDIT_STUDY_DECK.md` §7).
- **Gate:** Phase 2 pilot course approved.
- **Metric:** enrollment conversion on courses **with** an approved bank vs
  without (it's positioned as a sales booster — measure the sale), plus
  sessions/enrolled-learner/week.
- **Must not:** call any LLM at runtime; remount players per card; render
  quarantined/pending pairs.

### Phase 4 — Growth surfaces (parallel with Phase 5, cheap)

- **Free-preview question pack:** the playback gate already grants
  `isFreePreview` videos to any authenticated user — surface those videos'
  approved pairs on the course page ("جرّب ١٠ أسئلة من هذا الكورس") with full
  jump-to-moment, plus the count of locked questions behind enrollment. AI as
  merchandising, not a SKU.
- **Sectional upsell copy:** per-section approved-pair counts on sectional
  course pages ("قسم ٣ يحتوي ٤٢ سؤال إضافي"); packages advertise the combined
  bank.
- **WhatsApp question cards:** public share page per approved pair — question
  text + course + instructor + RTL OG image; the *answer* is the doctor's
  voice behind the enrollment gate. Questions travel free; answers can't leak.
- **Metric:** % of new enrollments first-touched by a shared card; preview-
  pack → enrollment conversion.
- **Must not:** expose answers or clips on public pages; leak `playbackId`.

### Phase 5 — Spaced repetition (client-side, zero LLM)

FSRS with default parameters (`requestRetention ≈ 0.9`), grades from the
Phase 3 post-reveal self-rating; pure client-computable function on web and
mobile. Session composer interleaves due cards across videos within a course.
State keys on Firestore doc IDs (never pipeline `qaId`s). Scheduler
sophistication is third-order — retrieval practice + spacing + interleaving
deliver most of the win; don't let scheduler debates delay Phase 3.
- **Gate:** Phase 3 live with ≥2 weeks of self-grade data.
- **Metric:** week-4 returning-learner rate among enrolled students.
- **Must not:** require a server round-trip per review on mobile; reopen the
  embeddings deferral (FSRS needs none).

### Phase 6 — MCQ transform, lesson checkpoints, LLM grading

- Offline Sonnet pass (new prompt + schema via `PIPELINE_ANTHROPIC_API_KEY`;
  the validated `CLEANUP_PROMPT` grounding wording stays untouched) that
  converts **approved** pairs into MCQs whose distractors come from *inside*
  the course corpus (other true statements that are wrong for this stem — the
  only distractor source compatible with the grounding rule). Automated
  item-flaw lint, then instructor review in the Phase 2 tab. Expect ~40–60%
  conversion yield; MCQs feed 5–8-item post-video checkpoints with remediation
  clips — **not** a summative exam.
- Optional keyPoints extraction pass (2–4 transcript-grounded points per
  answer) upgrades self-grading to "which points did you recall?" and doubles
  as the grading rubric below.
- LLM-graded typed answers (Haiku) ship only after the chat feature's rails
  exist (server `ANTHROPIC_API_KEY` provisioned, token instrumentation,
  per-user/day caps, fail-closed limiter — `RUBIK_AI_CHAT.md` §5) and only in
  bounded modes (checkpoint/exam), never per-practice-card.
- **Gate:** chat cost rails shipped; §13 q1 decided.
- **Metric:** checkpoint completion rate per lesson.
- **Must not:** generate distractors at runtime; grade free text by string
  match (Arabic morphology makes it dishonest).

### Phase 7 — Instructor analytics (demand framing)

Lazy aggregation over the §7.3 event log — no counters, no cron, no Vercel
logs. v0 needs no quiz data at all: jump-to-source taps per timestamp = the
rewatch-demand heatmap, usable as an instructor-recruiting demo. Framing
rules are product law: private by default, instructor-only, demand language
("الدقيقة ١٤ هي الأكثر إعادة مشاهدة"، "هذا السؤال الأصعب") — never failure
language ("83% failed your segment") — and every insight pairs with an action
CTA ("سجّل فيديو توضيحي ٣ دقائق"). Per-item pass rates also retire bad items
(> 95% trivial, < 20% broken) — the only validity path for auto-generated
content.
- **Gate:** ≥50 responses/item on the pilot course for item stats; any volume
  for the demand heatmap.
- **Metric:** new courses uploaded per active instructor per quarter (the
  flywheel claim, measured directly).
- **Must not:** show cross-instructor comparisons; read Vercel logs.

### Phase 8 — Exam & certification *(demoted, not deleted)*

Kept as the endgame; honest about prerequisites. A summative "/100" score and
a certificate are **not buildable on the current bank**: items are recall-
level and exposure-contaminated (the practice pool *is* the bank), there is
no blueprint metadata, no item statistics, no standard-setting for a pass
mark, and question banks must be assumed public ~30 days after release
(screenshots → Telegram; the defensible asset is the remediation loop and the
enrollment-gated clips, which cannot leak). Prerequisite ladder, in order:

1. Phase 6 MCQ bank + Phase 7 item statistics (retire bad items with data).
2. A **separate, unexposed** exam pool with blueprint metadata (topic
   coverage), instructor-authored or instructor-curated.
3. A defensible pass bar (instructor-set, standard-setting documented).
4. **Endorsement** — the credible unit of trust in this market is the
   instructor: v1 certificates are "شهادة إتمام بإشراف د. فلان" with the
   instructor's name and a public QR verification page
   (`/verify/{certId}`: course, instructor, score band, date). College
   CE-units and Iraqi Dental Association endorsement are later BD milestones,
   not launch gates.
5. Web-only issuance and payment (wallet-priced) — mobile view-only is final.

Until all five exist, certificates claim **completion**, never proctored
competence, and no "/100" number ships.

### Parking lot (unscheduled, recorded so they aren't reinvented)

Lecture Health Report (offline script over `output/` confidence data — an
instructor re-record prioritizer, buildable pre-Phase-1); "الدقائق المهمة"
merged-interval review reels; auto-subtitles (transcript → WebVTT → Mux text
track, as a separate write step); cross-course terminology index
(regex-extractable Latin-in-Arabic terms → moments; string match, no
embeddings); viva simulator (typed answers, offline-Sonnet rubrics + Haiku
grading); photo-of-case → lesson moment (Haiku vision *selecting* from
approved pairs, never authoring); auto-chaptering + grounded course
descriptions; exam-season review packs; challenge links (frozen doc IDs +
snapshotted question text).

---

## 10. Cost model

- **Offline generation:** one Sonnet call per video (`max_tokens 16000`, whole
  transcript in one message) — a long lecture can blow the ceiling and fail
  that video; chunking is a known TODO before processing seminar-length
  content. GPU transcription ≈ 11× realtime; CPU ≈ 1×.
- **MCQ transform (Phase 6):** offline Sonnet + Batch API ≈ well under $1 for
  the current corpus; ~$30–40 per 10k pairs. Never at runtime.
- **Study/SRS (Phases 3–5):** zero LLM cost by design — immune to the server
  `ANTHROPIC_API_KEY` provisioning blocker.
- **LLM grading (Phase 6):** Haiku ≈ $0.001/grade — trivial per checkpoint
  (~$0.07/student/exam), ruinous per practice card (~$600+/month at 1000 DAU
  × 20 cards/day). Hence: bounded modes only, behind the chat rails.
- **Firestore:** single-digit dollars/month at 1000 students × 200 pairs.
- **Runtime LLM posture** is owned by `RUBIK_AI_CHAT.md` (Haiku-only, prompt
  caching, token meta, caps) — link, don't duplicate.

---

## 11. Relationship to `docs/RUBIK_AI_CHAT.md`

| Concern | Owner |
|---|---|
| Runtime chat route, model choice, prompt caching, cost rails, rate-limit posture | `RUBIK_AI_CHAT.md` |
| Firestore Q&A + transcript schema (§7 here) | **This doc** (supersedes the §3 sketch there; closes its §9.2) |
| Review/approval lifecycle + publishing model | **This doc** (closes its §9.5 review-step half; the storage half is §7) |
| Study surfaces, SRS, MCQ transform, analytics, certification | **This doc** |
| Access gate semantics | The playback-token route + `sectional-invariants` skill (both docs defer to it; shared helper in Phase 3) |

Chat's retrieval reads the same approved pairs (§7.1) — the "80% pre-generated
Q&A" tier of its design becomes real the day Phase 2 approves a course.

---

## 12. Decision ledger

| Decision | Status | Where |
|---|---|---|
| Runtime model Haiku 4.5 only; Opus excluded; Sonnet offline only | DECIDED | `RUBIK_AI_CHAT.md` §2/§8 (runtime posture) + its §3 2026-07-02 update (Sonnet offline in the pipeline) |
| No embeddings / vector DB in v1 (re-entry: transcripts in Firestore + corpus size) | DECIDED | `RUBIK_AI_CHAT.md` §3 |
| No separate paid AI SKU in v1 | DECIDED | `RUBIK_AI_CHAT.md` §8 |
| Mobile is view-only; no purchase endpoints ever | DECIDED, final | `MOBILE_PROJECT_STATE.md` |
| STT = local faster-whisper pipeline, not Mux captions | DECIDED (shipped) | `RUBIK_AI_CHAT.md` §9.5 update |
| Pipeline stays read-only vs Firestore | DECIDED | `scripts/pipeline/run.mts` header |
| Import is a separate operator-run script (not a pipeline flag) | DECIDED | This doc §9 Phase 1 |
| `qa` + `transcripts` are admin-SDK-only — no client Firestore rules, default-deny (console rules verified 2026-07-03: single-segment courses rule + deny-all catch-all; no fix needed) | DECIDED | `docs/AUDIT_QA_IMPORT.md` §6 |
| Pair doc IDs = fresh auto-IDs minted at import; pipeline qaIds are provenance only; dedupe by `contentHash` | DECIDED | `docs/AUDIT_QA_IMPORT.md` decisions |
| One `contentHash` preimage everywhere: `sha256(videoId \0 norm(q) \0 norm(a))`, conservative norm | DECIDED | This doc §5.2/§7.1; `lib/qa/contentHash.ts` |
| Quarantine precedence `numeric > sentinel > flagged` | DECIDED | This doc §7.1 |
| Tripwire = number+unit adjacency **+ decimals-anywhere** (validated 54/426 = 12.7% quarantine) | DECIDED | `docs/AUDIT_QA_IMPORT.md` §5 |
| `promptVersion` = operator flag with default constant (pipeline emits none yet — follow-up) | DECIDED | `docs/AUDIT_QA_IMPORT.md` decisions |
| Immutable `importContentHash` = migrate identity; edits re-hash `contentHash` only (backfilled 426/426, 2026-07-03) | DECIDED | `docs/AUDIT_QA_REVIEW_UI.md` §4.1 |
| Approved pairs edit-locked: `revokeApproval` first, superseded record → `reviewHistory` | DECIDED | This doc §5.2b |
| `approved → rejected` safety recall allowed (record preserved) | DECIDED | This doc §5.2b |
| Edits invalidate attestation; edited pairs barred from bulk forever | DECIDED | This doc §5.2a |
| Stale pairs unapprovable (`QA_STALE`) until migrate resolves | DECIDED | `docs/AUDIT_QA_REVIEW_UI.md` decisions |
| `SignedMuxPlayer` renders a retriable error placeholder for all token failures (was: broken tokenless player) | DECIDED (shipped with Phase 2) | `components/SignedMuxPlayer.tsx` |
| Attestation scope: HARD gate for numeric pairs only; sentinel blocked; recommended-but-skippable (with visible note) for flagged/clean | DECIDED 2026-07-03 | This doc §4 inv. 4; §13 q5 note |
| Review-UI numerals are Arabic-Indic, display-only (`toArabicNumerals` in `QaReviewTab`) — underlying data stays ASCII | DECIDED 2026-07-03 | `components/qa_review/QaReviewTab.tsx` |
| First student surface = open-ended study companion, not MCQ quiz | DECIDED | This doc §1/§9 Phase 3 |
| Publishing model C (bulk unflagged + quarantine classes individually clip-attested) | DECIDED | This doc §5 |
| Numeric tripwire quarantine regardless of `needsReview` | DECIDED | This doc §4 inv. 3 |
| Exam/certification demoted behind prerequisites (§9 Phase 8) | DECIDED | This doc |
| Firestore Q&A schema + location | DECIDED here (§7) — supersedes `RUBIK_AI_CHAT.md` §9.2 | This doc |
| Persist additive `approvalAttested` boolean at approve time (auditable attestation) + re-scope the §13 q5 "≥95% attested" ship gate to match | **OPEN — filed 2026-07-03, before Phase 3 launch** | §13 q5 note; `docs/AUDIT_QA_REVIEW_UI.md` follow-ups |
| Study deck (Format A) is enrolled-only; free-preview grant is per-caller via `allowFreePreview` | DECIDED 2026-07-04 | §13 q1; `lib/courses/videoAccess.ts` |
| Phase 3 surface: web-first — standalone deck component in CoursePlayer's التدريب tab | DECIDED 2026-07-04 | §13 q2; `docs/AUDIT_STUDY_DECK.md` §1 |
| One shared per-video access gate for playback + study (+ future chat): `evaluateVideoAccess()` | DECIDED, shipped 2026-07-04 (route refactor verified behavior-identical) | §8.1 |
| Format A event logging ships day one: append-only server action, separate events collection, keyed on qa doc IDs | DECIDED 2026-07-04 | `docs/AUDIT_STUDY_DECK.md` §5 |
| Mobile SRS state: device-local vs `/api/study/*` writes | **OPEN** (§13 q3) | — |
| Instructor IP/consent instrument before third-party courses are processed | **OPEN** (§13 q4) | — |

---

## 13. Open questions

1. **Free-preview branch — DECIDED 2026-07-04 for Format A:** the study deck
   is enrolled-only. `evaluateVideoAccess({ allowFreePreview })` makes the
   grant explicit per caller: playback passes `true`, study passes `false`
   (free preview keeps playing the video; the deck requires a genuine
   completed enrollment; owner/admin bypass stays). Phase 4 preview packs
   revisit the branch for their own surface — the zero-marginal-cost
   conversion argument stands, deliberately deferred.
2. **Phase 3 surface — DECIDED 2026-07-04: web-first**, as a standalone
   `components/study/QaStudyDeck.tsx` mounted from a conditional "التدريب"
   tab in CoursePlayer — the deck survives the throwaway viewer's deletion
   and can re-host on a future practice route. Mobile later gets the
   additive read endpoint (`docs/MOBILE_API_MIGRATION.md` updated in the
   same commit when it ships).
3. **Mobile study writes.** Device-local SRS state (no sync, zero contract
   change) vs additive `POST /api/study/reviews` (cross-device, contract
   expansion). Needs an explicit product sign-off that "view-only" ≠ "no
   progress writes".
4. **Instructor terms.** Before the pipeline processes any third-party
   instructor's course: a one-page Arabic consent addendum (transcription,
   derivative study content, review-before-publish guarantee,
   deletion-on-course-deletion, and revenue attribution via a new
   `earningsLedger` entry type if any study artifact is ever paid). The
   founder's own courses are exempt, which is why the pilot is safe.
5. **Timestamp ship gate.** Proposed: ≥95% of approved pairs clip-attested
   answer-in-window (the Phase 2 UI *is* the measurement instrument — no
   separate eval project). Confirm the bar before Phase 3 launch.
   *Note (2026-07-03, after the invariant-4 scoping):* attestation is now
   skippable for non-numeric pairs and is session-only client state — the
   platform cannot distinguish attested from skipped approvals afterward.
   The ship gate therefore needs re-scoping before Phase 3: either trust
   the numeric hard gate + jump-affordance hedges (§8.2) + spot checks, or
   persist an `approvalAttested` boolean at approve time (small additive
   schema change, deliberately NOT made now).

---

## Appendix — verified ground truth (as of 2026-07-03)

Each claim carries its source; future sessions verify against these instead
of re-auditing.

- **`QaRecord` shape** (post-2026-07-03 fix): `qaId, courseId, videoId,
  question, answer, status:"pending", sourceStartSec, sourceEndSec,
  sourceSegmentIds, avgLogprob, noSpeechProb, compressionRatio, needsReview,
  createdAt` — `scripts/pipeline/run.mts` (`interface QaRecord`).
- **Open-ended only:** generation schema has `question`, `answer`,
  `sourceSegmentIds` — no options/distractors (`run.mts`, `QaGenSchema`).
- **Grounding prompt is validated verbatim; do not soften**
  (`run.mts`, `CLEANUP_PROMPT` comment).
- **Timestamps:** `sourceStartSec = min(start)`, `sourceEndSec = max(end)`
  over resolved cited segments; **0/0 fallback when nothing resolves**;
  confidences are worst-case (min `avg_logprob`, max `no_speech_prob`, max
  `compression_ratio`) (`run.mts`, `buildQaRecords`).
- **`needsReview` fires on:** any cited segment breaching Whisper thresholds
  (`avg_logprob < -1.0`, `no_speech_prob > 0.6`, `compression_ratio > 2.4`),
  a cited-unknown-segment id, or zero resolved citations (`run.mts`,
  `THRESHOLDS` + `buildQaRecords`).
- **`qaId`s are random per run** (`mintQaId`) — regeneration mints new IDs;
  resume = `qa.json` existence; transcript-level reuse for cheap Q&A
  regeneration (`run.mts`).
- **Playback tokens:** whole-video, empty custom claims, RS256,
  `exp = now + ttlSeconds`; route passes `TTL_SECONDS = 7200` (2 h); helper
  returns the bare JWT (`lib/mux/playbackToken.ts`,
  `app/api/mux/playback-token/route.ts:12`).
- **Token mint rate limit:** 30/user/min sliding window, fail-open on Redis
  errors (`route.ts:21-26`, `route.ts:38-55`).
- **Access gate order:** owner/admin bypass → course visibility for
  non-privileged → video exists → `VIDEO_NOT_READY` without `playbackId` →
  free-preview bypass → completed enrollment (`NOT_ENROLLED`) → sectional
  section ownership with unset/`"full"` scope and untagged-video grants
  (`SECTION_NOT_OWNED`) (`route.ts:64-208`). **No free-course price bypass
  exists** — free courses require a completed (free) enrollment.
- **Doc/code contradictions fixed 2026-07-03** in
  `docs/MOBILE_API_MIGRATION.md`: the "≤ 5 min token TTL" claims (shipped:
  7200 s) and the lock recipe's `price === 0 → unlocked` step (no server
  counterpart).
- **Web viewer `/Course/[courseId]` is throwaway** — scheduled for deletion
  after mobile launches (`docs/MOBILE_PROJECT_STATE.md`).
- **Review-UI host:** `components/CourseDashboard.tsx` renders a two-tab
  shadcn `Tabs` layout (`CourseDashboard.tsx:637-651`) and is mounted at
  **two** routes — `/course-upload/edit/[courseId]` and
  `/user_dashboard/createdCourses/[courseId]` — both behind the page-auth
  middleware matcher. A Phase 2 third tab appears on both surfaces.
- **Vercel Hobby:** runtime logs retained 1 hour (CLAUDE.md) — analytics on
  logs is impossible by design.
- **Server `ANTHROPIC_API_KEY` is still unprovisioned**; the pipeline's
  `PIPELINE_ANTHROPIC_API_KEY` is deliberately isolated and must never be
  reused in the app (`RUBIK_AI_CHAT.md` prerequisites; `run.mts` header).
