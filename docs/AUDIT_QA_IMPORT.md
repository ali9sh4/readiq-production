# Audit — Phase 1 Q&A import (`scripts/pipeline/import.mts`) — read-only findings

**Date:** 2026-07-03. **Status:** Pre-build audit. No code written, no writes
performed anywhere (one read-only Firestore fetch of the two course docs; all
other evidence is disk + repo).
**Spec under audit:** `docs/RUBIK_STUDY_FEATURES.md` §4 (invariants), §5.3
(regeneration firewall), §7 (normative schema), §9 Phase 1.
**Corpus at audit time:** 2 courses / 25 videos / 426 pairs / 24 flagged —
verified on disk; all 426 pairs carry `sourceSegmentIds` + `compressionRatio`.

> **TL;DR:** The §7 schema is buildable as written with **two provenance
> gaps** (`promptVersion` and transcript-side `pipelineRunAt` have no on-disk
> source — bind transcripts by content hash instead), **one doc-internal bug**
> (§5.2 and §7.1 define two different preimages under the name `contentHash`),
> and **one schema refinement** (the single-valued `quarantine` field needs a
> precedence rule: `numeric > sentinel > flagged`). The write path is
> straightforward: one atomic `WriteBatch` per video (≤ 34 ops vs the 500
> limit) with the transcript doc doubling as the import marker. The tripwire
> regex was validated against all 426 real answers: **54 pairs (12.7%)
> quarantine** under the recommended rule set. One **owner decision** is a
> hard gate: the external Firestore rules must be audited before the first
> real import — the admin dashboard proves browser reads of `courses` are
> allowed today, and a recursive rule would expose the new subcollections the
> moment they exist.

---

## 1. §7 schema vs on-disk reality

**Confirmed:**
- `qa.json` is a bare array whose per-pair key union is exactly the 14
  `QaRecord` fields (`run.mts:96-114`); 426/426 pairs carry the evidence
  fields. `transcript.json` is a bare array of
  `{id, start, end, text, avg_logprob, no_speech_prob, compression_ratio}`
  (`transcribe.py:179-187`) — maps 1:1 onto §7.2's segment shape.
- Largest transcript file is 61.2 KiB (`ViNmx…/video_16`) — ~6% of the 1 MiB
  doc limit even after wrapping in a metadata object. No chunking needed.
- Disk `qaId`s are corpus-unique (426/426, zero duplicates; 62^10 space,
  collision ≈ 1e-13).

**Gaps — §7 fields with no on-disk source:**
- **`promptVersion`**: nothing emits it. `CLEANUP_PROMPT` has no version
  constant and the model id appears only as a hardcoded call argument
  (`run.mts:188`). → Import stamps an operator-supplied constant
  (`--prompt-version`, e.g. `v1-484373f`) or `null`; do NOT hash the current
  prompt (it may drift from what generated the data). Pipeline follow-up
  (separate PR): emit `promptVersion` + model id on future `QaRecord`s.
- **Transcript-side `pipelineRunAt`**: `transcript.json` carries zero
  metadata; file mtime lies across backups; and for 21 of 25 videos the
  transcript predates the Q&A (2026-07-03 regeneration reused transcripts),
  so pair `createdAt` ≠ transcription time. → **Bind by content, not clock:**
  store `transcriptHash = sha256(transcript.json bytes)` on the transcript
  doc (and, additively, on each pair); stamp `pipelineRunAt` from the
  qa-side `createdAt` and document that transcription time is unknowable for
  the current corpus.

**Doc bug found — fix `RUBIK_STUDY_FEATURES.md` when building:**
- §5.2 defines the approval hash as `contentHash(question + answer)`; §7.1
  defines the pair hash as `hash(videoId + question + answer)`. Two preimages,
  one name — Phase 2 audit cross-checks would never match. → One hash
  (§7.1's, delimited) used everywhere, computed by one shared module.

**Sentinel subtlety (verified against real data):**
- The corpus contains a **legitimate** `sourceStartSec === 0` pair
  (`video_7` pair 1 cites the segment spanning 0.0–17 s). The sentinel test
  must be the full triple `start===0 && end===0 && avgLogprob===null` —
  never 0/0 alone. Also note sentinel ⊂ flagged in pipeline output
  (`src.length===0` forces `needsReview:true`), which motivates the
  precedence rule in §5 below.

## 2. Write approach

- **Init:** replicate `run.mts`'s pattern verbatim — validate `REQUIRED_ENV`
  (exactly the four `FIREBASE_*` vars; no Mux, no Anthropic), *then*
  dynamically `import("../../firebase/service")` (`firebase/service.ts:16`
  throws a cryptic TypeError at module load if env is unset). Do not import
  `@anthropic-ai/sdk` or `lib/mux` at all.
- **Batching: `WriteBatch`, one atomic batch per video — not `BulkWriter`**
  (zero BulkWriter precedent in the repo; every existing multi-doc write is
  chunked WriteBatch, e.g. `lib/services/accountDeletion.ts:184-188`). Max
  observed ops/video = 32 pairs + transcript doc ≈ 34 ≪ 500. Atomic batch ⇒
  the transcript doc (written in the same batch) is a truthful
  "video fully imported" marker — the same write-last semantics the operator
  knows from `qa.json`. Defensive guard: if ops > 450, chunk pairs at 400
  with the transcript doc in the LAST chunk.
- **Doc IDs:** use the disk `qaId` as the Firestore doc ID on first import
  (also stored as `pipelineQaId`). Satisfies §7.1 ("minted at import" — the
  importer chooses it; it freezes thereafter), greppable across disk/console/
  logs. Pre-flight assertion: all qaIds in the load set unique. Transcript
  doc ID = `videoId`.
- **`undefined` hazard:** `firebase/service.ts` does not set
  `ignoreUndefinedProperties`, so any `undefined` field throws at write time.
  Coalesce: `sectionId ?? null`, `isFreePreview === true` →
  `isFreePreviewVideo` (note the **field-name mapping**).
- **Iteration order:** from the course doc's `videos[]` sorted by `order`
  (disk glob is lexicographic: `video_10` < `video_7`); glob
  `output/*/*/qa.json` for discovery/cross-check only (skips `_errors.log`).
- **`--dry-run` = the identical code path minus `.commit()`** (WriteBatch
  queues locally) — same discovery, firewall reads, hashing, quarantine,
  batch assembly, op counts. No separate branch.
- **npm script:** `"import": "tsx --env-file=.env.local scripts/pipeline/import.mts"`;
  usage `npm run import -- --course <id> [--dry-run] [--migrate]`.
  ⚠ Run via **Git Bash / cmd** — under PowerShell, npm swallows `--course`
  (verified failure earlier today with `npm run pipeline`).
- `tsconfig` already typechecks `**/*.mts`; no config change needed. The
  pipeline itself is untouched; import never mutates `output/`.

## 3. Regeneration firewall (§5.3)

- **Detection:** per video, read `courses/{courseId}/transcripts/{videoId}`
  (1 read). Exists ⇒ imported. Defense-in-depth: if absent, also
  `qa where videoId == X limit 1`; pairs-without-marker = inconsistent state
  ⇒ **refuse that video**, never auto-repair.
- **Two modes.** Default = insert-only, idempotent: already-imported videos
  are skipped ("use --migrate to reconcile") — a crashed import re-runs
  safely, mirroring pipeline resume. `--migrate` = full reconcile (below).
- **`contentHash` spec:**
  `sha256(utf8(videoId + '\0' + norm(question) + '\0' + norm(answer)))`, hex
  (repo precedent: `lib/R2/file-security.ts:356`), where `norm` =
  `NFC + whitespace-collapse + trim` **only** — no case folding, no
  diacritic stripping, no Arabic-Indic↔ASCII digit unification (٨٠ vs 80 is
  a content change; a false "identical" silently inherits an approval — the
  dangerous direction). The `\0` delimiter kills `video_1`/`video_10` prefix
  ambiguity. Verified: 0/426 current pairs change under this normalization
  (pure forward insurance). Store `contentHashVersion: 1`. Put
  `norm() + contentHash() + the tripwire regex` in **one shared module**
  (`lib/qa/contentHash.ts`) that Phase 2's `qa_review_actions.ts` will
  reuse — the §5.2 edit-re-hash can then never drift.
- **`--migrate` reconcile per video** (all in the one atomic batch):
  - *In-file duplicate hash* (legal — generation is nondeterministic): keep
    first, drop rest, count + log.
  - *Identical hash*: keep doc ID, `status`, all review fields; set
    `stale:false`. Evidence fields refresh **only when `status !== 'approved'`**
    — an approved pair's timestamps are human-verified claims (invariant 4);
    the new citations are unverified model output.
  - *New hash*: new doc, `status:'pending'`, quarantine computed.
  - *In Firestore, not on disk*: merge `stale:true` only. Never delete.
  - "Changed" is not a primitive: a changed pair = +1 new +1 stale. The
    dry-run table reports `new / identical / stale / duplicateInFile` and
    says so.
- **Transcript binding:** before any write, a **coherence check** re-derives
  each pair's start/end/worst-case confidences from the disk transcript via
  `buildQaRecords`' exact rules and requires equality with `qa.json`
  (float-tolerant); mismatch = mixed evidence chain ⇒ refuse the video. This
  check is what makes stamping the pairs and transcript doc with one
  `pipelineRunAt` truthful. Future re-transcription over a course with
  approvals needs a versioning decision — flagged, explicitly out of Phase 1
  scope (nothing is approved yet).
- **First import degrades cleanly:** empty Firestore ⇒ every pair "new";
  default and `--migrate` produce identical writes.

## 4. Denormalization join (verified against live course docs, read-only)

- **`ViNmx1xEiVma4BlxDNcl` is a live sectional course** — `purchaseMode:
  "sectional"`, 4 sections, `sec_AUpzuNa6td` (video_7–12) +
  `sec_t9tjP3ItfX` (video_13–16), `fullCoursePrice` 200000, `video_7` +
  `video_8` free-preview. Sectional gating on study surfaces is exercised
  from day one.
- `DDL9xpIvN9ejWJKhROIV`: `purchaseMode: "full"`, all videos without
  `sectionId`, `video_27` + `video_26` free-preview.
- Every video object carries `sectionId?`/`isFreePreview?`/`isVisible`/
  `duration` (`types/types.ts:26-41`; both join fields optional — coalesce
  per §2). Ignore the legacy `section?: string` field. Join =
  `course.videos.find(v => v.videoId === pair.videoId)`.
- 25/25 on-disk video dirs match a course-doc video today. Edge case: a
  `qa.json` whose videoId is no longer on the course doc ⇒ **refuse/flag**
  that video (likely a deleted video); do not import orphans silently.

## 5. Numeric tripwire — proposed regex, validated on all 426 answers

Two rules, OR'd (full pattern lives in `lib/qa/contentHash.ts` when built):

1. **Number + unit adjacency** (both orders, ASCII + Arabic-Indic digits,
   decimal separators `.` `٫` `،`): units
   `ملم|مليمتر|ميليمتر|مليم|مم|mm|سم|cm|مل|ml|ملغ|مغ|mg|غرام|غم|كغم|كغ|kg|MPa|ميغاباسكال|باسكال|٪|%|بالمية|بالمئة|بالمائة|درجة|درجات|°|مئوية|مايكرون|ميكرون|ميكرومتر|مايكرومتر|micron|micrometer|µm|دقيقة|دقائق|ثانية|ثواني|ساعة|ساعات|نيوتن`
   — the corpus itself forced adding **ميكرومتر** (real miss found in
   `video_15`).
2. **Decimals anywhere** (`-?\d+[.٫]\d+` with digit-boundary guard): catches
   the unit-less Exocad CAD parameters where mm is implied — connector
   0.2/0.5, margin 0.08, −0.2, Ti-base diameters 4.2/5.3. These are exactly
   the clinical values the doc's own vision worries about ("connector
   strength"), and rule 1 alone misses all of them.

**Empirical result (all 426 answers, numeric-first precedence):**

| Quarantine class | Count | Notes |
|---|---|---|
| `numeric` | 31 | 13 unit-match only, 11 decimal-only, 7 both; 1 also `needsReview` |
| `sentinel` | 0 | corpus contains none (all citations resolved) |
| `flagged` (remaining) | 23 | of the 24 `needsReview`, 1 reclassified numeric |
| **Total quarantined** | **54 = 12.7%** | 372 pairs bulk-approvable under model C |

Known false positive: one shade code ("2R 2.5") — costs one review, fine by
design (over-matching is acceptable; under-matching is the failure class).
**Accepted residual risks:** number-*words* (دقيقتين، خمستعش — regex cannot
catch), and unit-less integers ("القيمة على 60" furnace setting). Mitigations:
Phase 2 approve action **re-runs the tripwire at approval time** (also closes
any precedence masking and catches reviewer edits that introduce numbers),
plus reviewer guidance; a future offline Sonnet pass could flag number-words.

**Precedence rule (schema refinement):** `quarantine` is single-valued —
order `numeric > sentinel > flagged`. Justification: numeric is the only
class whose trigger is not otherwise stored on the doc (`needsReview` and
the 0/0/null triple remain independently inspectable), and it is the only
class adding an extra approval requirement (the explicit number
confirmation). Any other order can hide that requirement on a
flagged+numeric pair.

## 6. Firestore rules — OWNER DECISION (hard gate before first real import)

- **Recommendation: `qa` + `transcripts` stay admin-SDK-only; no client
  rules of any kind, relying on default-deny.** Every planned consumer
  through Phase 3 is server-side (import script, `qa_review_actions.ts`
  server actions, web practice route, `GET /api/courses/{courseId}/qa`
  behind `verifyBearerToken`). Admin SDK bypasses rules, so deny-all costs
  nothing functionally.
- **Why this is a gate, not a nicety:** `app/admin-dashboard/page.tsx:55-83`
  runs a client-SDK `onSnapshot` over `courses` — so the external rules
  demonstrably allow browser reads of `courses` today. Rules semantics:
  `match /courses/{courseId}` does **not** cascade to subcollections, but
  `match /courses/{document=**}` (or a root `/{document=**}` test-mode
  remnant) **does** — and overlapping rules OR together, so a broad
  recursive allow cannot be overridden by a narrow deny. No
  `firestore.rules` file exists anywhere in the repo (verified) — the
  console file is the single point of failure. **The import moment is the
  exposure moment**: `transcripts` docs are the full lecture text — leaking
  them leaks the paid course; `qa` includes unreviewed pending pairs.
- **Pre-import checklist (external rules file):** (a) no root
  `/{document=**}` allow; (b) the rule that feeds the admin dashboard must
  be single-segment (`match /courses/{courseId}`), not recursive; (c) no
  collection-group rules matching `qa`/`transcripts`; (d) wallets/users/
  topup_requests rules likewise single-segment.
- **Post-import smoke test (runbook):** signed in as a non-admin in a
  browser, `getDoc` one imported `qa` doc and one `transcripts` doc → both
  must return permission-denied; repeat unauthenticated.
- **Forbid** copying the admin-dashboard `onSnapshot` pattern to the Phase 2
  review tab (would force opening client rules); review freshness comes from
  server actions + revalidation.
- Indexes: the firewall and Phase 3 queries are equality-only → automatic
  single-field indexes suffice; no composite index needed for Phase 1.
  (Future flag: any cross-course `collectionGroup('qaProgress')` needs a
  console-managed collection-group index and must stay server-side.)

---

## Decisions required before build

1. **Rules posture** — adopt admin-SDK-only (recommended) and run the §6
   pre-import checklist on the console rules file. *(Gate.)*
2. **Tripwire scope** — adopt rule 2 (decimals-anywhere) alongside number+unit
   (recommended; 54/426 = 12.7% quarantine), or strict number+unit only
   (38 pairs, misses all unit-less CAD values).
3. **`promptVersion`** — operator constant (e.g. `v1-484373f`) vs `null` for
   this corpus. (Either way: pipeline follow-up PR to emit it going forward.)
4. **`contentHash` unification** — one preimage
   (`videoId \0 norm(q) \0 norm(a)`, sha256 hex, conservative norm) used by
   both import and the Phase 2 approval record; edit §5.2 of
   `RUBIK_STUDY_FEATURES.md` accordingly.
5. **Quarantine precedence** — `numeric > sentinel > flagged` (single-valued
   field); note it in §7.1.
6. **Doc IDs** — disk `qaId` as Firestore doc ID on first import (recommended)
   vs auto-IDs.

## Build plan (after OK)

1. `lib/qa/contentHash.ts` — `norm()`, `contentHash()`, tripwire regex +
   `classifyQuarantine()` (shared with Phase 2 later). Unit-test by running
   it over the corpus and asserting the table in §5.
2. `scripts/pipeline/import.mts` — env gate → dynamic `firebase/service`
   import → discovery (course doc `videos[]` × disk glob cross-check) →
   firewall reads → coherence check → classification → per-video atomic
   batch assembly → `--dry-run` prints the per-video table / real run
   commits. `--course` filter, `--migrate` mode, `--prompt-version` flag.
3. `package.json` — add the `import` script.
4. **First run is `--dry-run`** — expected output on today's corpus:
   25 videos, new=426, identical=0, stale=0, duplicateInFile=0, blocked=0,
   quarantined=54 (numeric 31 / sentinel 0 / flagged 23), planned writes =
   426 pair docs + 25 transcript docs. Any deviation is itself a finding.
5. Owner runs the rules checklist (§6) → real import → post-import
   permission-denied smoke test → update `RUBIK_STUDY_FEATURES.md` (§5.2
   hash fix, §7.1 precedence note, Phase 1 gate ✅, snapshot) + board in the
   same commit.

**Doc edits that ride along with the build commit (not before):**
`RUBIK_STUDY_FEATURES.md` §5.2 hash preimage fix, §7.1 quarantine-precedence
note + `transcriptHash`/`contentHashVersion` fields, §7.2 content-addressed
binding note, decision-ledger rows for decisions 1–6.

---

## Addendum — decisions taken & pre-write verification (2026-07-03)

Owner decisions: (1) rules admin-SDK-only; (2) tripwire expanded regex
accepted; (3) `promptVersion` operator flag with default constant; (4) hash
preimage unified per §3 above; (5) precedence accepted; (6) **doc IDs: fresh
auto-ID minted at import — NOT the disk qaId** (overrides this audit's §2
recommendation; conflict flagged and resolved — the firewall is unaffected
because dedupe keys on `contentHash`, never on doc IDs).

**Rules check (read-only, Firebase Rules API, ruleset released 2025-11-20):**
PASS — `match /courses/{courseId}` is single-segment (no cascade); the only
wildcard is an explicit deny-all `match /{document=**}`; no collection-group
rules. `qa`/`transcripts` are client-inaccessible by default; **no console
fix needed before import.** Side observations (not blockers): the courses
read rule keys on `resource.data.instructorId` while the codebase uses
`createdBy`, and it allows any `status == 'published'` course client-side
(server predicate also checks `isApproved`/`isDeleted`) — worth aligning
separately.

**Built:** `lib/qa/contentHash.ts` (norm + hash + tripwire +
`classifyQuarantine`, shared with Phase 2) and `scripts/pipeline/import.mts`
(**dry-run is the default; writes require explicit `--write`**; insert-only
default mode, `--migrate` reconcile; per-video atomic batch with the
transcript doc as marker; coherence check; orphan/stray refusal).

**Dry-run result (2026-07-03) — matches §5's prediction exactly:**
25 videos planned, 0 skipped, 0 refused; 426 pairs → new 426, identical 0,
stale 0, duplicateInFile 0; quarantined 54 (numeric 31 / sentinel 0 /
flagged 23); planned writes 451 (426 pair ops + 25 transcript docs). All 25
coherence checks passed.

**`--write` executed 2026-07-03 (owner-approved):** identical numbers, 0
refused. Spot-check: 216+210 qa docs, 10+15 transcript docs, hash binding
verified. **§6 smoke test result: qa and transcript docs return
`permission-denied` (web SDK, forced long-polling) and `HTTP 403
PERMISSION_DENIED` (Firestore REST with the public API key) for both an
unauthenticated client and a signed-in non-admin (throwaway custom-token
user, deleted after) — while the control read of the published course doc
returned 200/exists in all four contexts, proving rules evaluation.**
Phase 1 gate ticked in `RUBIK_STUDY_FEATURES.md`. Note for posterity: the
web SDK's default WebChannel transport fails in Node with
`invalid-argument` before rules run — force long-polling or use REST when
re-running this test outside a browser.
