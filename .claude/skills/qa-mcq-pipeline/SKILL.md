---
name: qa-mcq-pipeline
description: >-
  Use when OPERATING or editing the offline content pipeline under
  scripts/pipeline/* — transcribing a course (run.mts), importing Q&A to
  Firestore (import.mts), or transforming/importing MCQs (mcq.mts). Triggers:
  "run the pipeline", "transcribe course X", "generate Q&A", "import the
  Q&A", "run the MCQ on course X", "push the MCQs", "make them reviewable by
  the instructor". Covers the stage chain, run commands, env-var shadowing,
  the Git Bash requirement, dry-run/--write discipline, resume markers, known
  transient failures, and the courseId-lookup + Firestore-verify recipes.
  Read BEFORE running any of these scripts against prod Firestore.
---

# Q&A + MCQ pipeline — operator guide

Operator-run scripts, all under `scripts/pipeline/`. Each script's header
comment is its normative spec — read it before changing flags or behavior.
Canonical docs: `docs/RUBIK_STUDY_FEATURES.md` (§7 Q&A schema, review
lifecycle), `docs/AUDIT_MCQ_TRANSFORM.md` (E1 decisions), and the
`docs/AUDIT_QA_IMPORT.md` addendum (doc-ID minting decision).

## The chain (each stage gates the next)

```
run.mts        transcribe + generate      → disk only: output/{courseId}/{videoId}/{transcript.json,qa.json}
import.mts     qa.json → Firestore        → courses/{id}/qa (status "pending") + transcripts/{videoId} marker
instructor     reviews in مراجعة الأسئلة   → pairs become status "approved"
mcq.mts        transform --course <id>    → reads APPROVED pairs from FIRESTORE → disk mcq.json
mcq.mts        import [--write]           → courses/{id}/mcqItems (status "pending")
instructor     MCQ review tab             → items visible IMMEDIATELY; approval is the exam gate
```

There is **no separate "publish for review" step**: `mcq.mts import --write`
landing items as `pending` is what makes them live in the instructor review
surface (`app/actions/mcq_review_actions.ts` reads `mcqItems` directly).

## Commands (run from repo root, in Git Bash — NOT PowerShell)

```bash
npm run pipeline -- --course <courseId>              # or --video <courseId> <videoId>
npm run import   -- --course <courseId> [--migrate]  # dry-run; add --write to commit
npm run mcq      -- transform --course <courseId>
npm run mcq      -- import --course <courseId>       # dry-run; add --write to commit
```

**Under PowerShell, npm silently swallows `--course`** — the scripts then run
against ALL courses or print usage. Always use the Bash tool / Git Bash.

## Hard rules

1. **Dry-run is the default for both imports.** Nothing is written without an
   explicit `--write`. Always run the dry-run first, check the report
   (`new / identical / stale / refused / quarantine` columns), and only then
   re-run with `--write`.
2. **Env comes from `.env.local` via `tsx --env-file` — which does NOT
   override shell-exported vars.** The Anthropic key is
   `PIPELINE_ANTHROPIC_API_KEY` (never `ANTHROPIC_API_KEY`) so an ambient key
   from other tooling can't shadow it. import/mcq-import need only the four
   `FIREBASE_*` service-account vars; transform adds the pipeline key;
   run.mts adds `MUX_SIGNING_*`.
3. **The MCQ transform reads approved pairs from Firestore, never disk
   qa.json** (`status=="approved" && stale==false`). Disk is stale the moment
   an instructor edits a pair. It is a deliberate decision (E1 decision 7)
   that the transform runs only AFTER full-course Q&A review.
4. **Resume markers, write-last:** run.mts → `qa.json`; import.mts → the
   `transcripts/{videoId}` doc; mcq transform → `mcq.json` (delete the file
   to re-transform a video). Re-running the same command resumes safely.
5. **Imports are idempotent and never delete.** Q&A dedupe keys on
   `contentHash`; MCQ on `sourceQaDocId + sourceContentHash`. Identical
   source → skip (review state preserved); diverged source → old item
   stale-marked, new lands as `pending`. Doc IDs are minted at import;
   pipeline qaIds are provenance only.
6. **Expected skips are not errors.** `answer-too-long` (normalized answer
   > 250 chars — unreadable as an MCQ option) is by design; report the count,
   don't "fix" it. Numeric-sensitive items land quarantined, not dropped.

## Known transient failure (confirmed 2026-07-17)

The transform's structured-output schema requires exactly 3 distractors per
MCQ. Sonnet occasionally returns one short — the whole video's batch then
fails validation and **nothing is written** (`mcq.json` is write-last).
**Fix: just re-run the same transform command.** Do not loosen the schema or
soften the prompt to make the error go away.

## Operator recipes

- **courseId from a title:** scan `courses` matching case-insensitively with
  *contains*, not equality — titles can carry trailing whitespace (e.g.
  `"Anterior Morphology And Finishing "`).
- **Verify after `--write`:** read back the target subcollection and count by
  `status` (expect all-`pending` on first import, 0 unexplained quarantine).
- Ad-hoc lookup/verify scripts: throwaway `.mts` in the scratchpad, run with
  `npx tsx --env-file=.env.local <script>` from repo root, import the admin
  db via `file:///C:/Users/ali9s/readiq-production/firebase/service.ts`, and
  end with `process.exit(0)` — firebase-admin holds gRPC channels open and
  the process hangs otherwise. Keep these READ-ONLY; real writes go through
  the pipeline scripts so idempotency/hashing rules apply.

## Don'ts

- Don't write to `courses/{id}/qa` or `mcqItems` with ad-hoc scripts —
  import.mts/mcq.mts are the only writers (hashing, quarantine, stale-marking
  live there).
- Don't run the transform on a course still mid-review — approved-only input
  is the yield and safety model.
- Don't edit `CLEANUP_PROMPT` (run.mts) or the MCQ prompt without bumping the
  prompt-version string, and never soften the grounding sentences.
- `output/` is gitignored operator state — never commit it, never treat disk
  qa.json as truth after review has started.
