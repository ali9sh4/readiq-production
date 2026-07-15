// MCQ transform + import — E1 of docs/AUDIT_MCQ_TRANSFORM.md (قرارات المالك
// block governs; §2.2 schema, §4 prompt rules, §6 build plan).
//
// Two operator-run modes in one script:
//
//   npm run mcq -- transform --course <courseId> [--prompt-version <v>]
//     Reads APPROVED pairs from Firestore (status=="approved" && stale==false
//     — the same triple predicate as the study deck; disk qa.json can be
//     stale after instructor edits, so Firestore is the only truthful
//     source, finding §1). Calls Sonnet once per video with the course-wide
//     approved corpus as distractor material, writes
//     output/{courseId}/{videoId}/mcq.json (write-last = resume marker;
//     delete the file to re-transform a video). Deliberate runs after full
//     course review (decision 7) — hence --course is required.
//
//   npm run mcq -- import [--course <courseId>] [--write]
//     mcq.json -> courses/{courseId}/mcqItems (separate subcollection,
//     decision 1 — structurally invisible to every qa consumer). DRY-RUN IS
//     THE DEFAULT; nothing is written without an explicit --write. Idempotent
//     keyed on sourceQaDocId + sourceContentHash (decision 7): identical
//     source -> skip (review state preserved); diverged source -> stale-mark
//     the old item, land the new one as pending. Never deletes.
//
// Verbatim-faithful keys are enforced in CODE at BOTH stages (finding §3):
// normalizeQaText(key) must equal normalizeQaText(pair.answer) via
// lib/qa/contentHash.ts — the prompt is only the first line of defense.
// Quarantine is recomputed at import (isNumericSensitive over the key);
// the numeric hard gate continues into MCQ review (decision block item 4 of
// BRAINSTORM_EXAM_JOB_MARKET.md).
//
// Required env (.env.local via tsx --env-file; --env-file does NOT override
// shell-exported vars): FIREBASE_PRIVATE_KEY_ID, FIREBASE_PRIVATE_KEY,
// FIREBASE_CLIENT_EMAIL, FIREBASE_CLIENT_ID; transform mode additionally
// requires PIPELINE_ANTHROPIC_API_KEY (never ANTHROPIC_API_KEY — ambient-key
// shadowing guard, run.mts pattern). Mux vars deliberately not required.
// Run from Git Bash — under PowerShell npm swallows "--course".

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTENT_HASH_VERSION,
  isNumericSensitive,
  mcqContentHash,
  normalizeQaText,
} from "../../lib/qa/contentHash";
import {
  META_OPTION_RE,
  hasDuplicateOptions,
  mcqLintWarnings,
} from "../../lib/qa/mcqLint";
import type { CourseVideo } from "../../types/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_ROOT = join(HERE, "..", "..", "output");

const TRANSFORM_MODEL = "claude-sonnet-5";
// Bump when the MCQ prompt changes; overridable per run (import.mts pattern).
const DEFAULT_MCQ_PROMPT_VERSION = "mcq-v1-2026-07-11";

// Decision 3: strict verbatim keys; answers longer than this (normalized)
// are skipped BEFORE the API call as `answer-too-long` — paragraph keys make
// unreadable options. ~200–250 band decided; upper end for yield.
const ANSWER_MAX_CHARS = 250;

// §4.3 lint lives in lib/qa/mcqLint.ts — shared with the review actions.

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

// Approved pair as read from Firestore (the fields the transform needs).
interface SourcePair {
  qaDocId: string;
  question: string;
  answer: string;
  contentHash: string;
  videoId: string;
  sectionId: string | null;
  sourceStartSec: number;
  sourceEndSec: number;
  sourceSegmentIds: number[];
}

// One MCQ as written to disk — §2.2 schema minus review fields (those are
// born at review time, like qa import).
interface DiskMcq {
  sourceQaDocId: string;
  sourceContentHash: string;
  stem: string;
  correctAnswer: string;
  distractors: string[];
  courseId: string;
  videoId: string;
  sectionId: string | null;
  sourceStartSec: number;
  sourceEndSec: number;
  sourceSegmentIds: number[];
  quarantine: "numeric" | null;
  mcqContentHash: string;
  contentHashVersion: number;
  transformModel: string;
  transformPromptVersion: string;
  transformedAt: string;
  status: "pending";
  lintWarnings: string[];
}

interface DiskSkip {
  sourceQaDocId: string;
  reason: string;
}

interface McqFile {
  courseId: string;
  videoId: string;
  transformedAt: string;
  transformModel: string;
  transformPromptVersion: string;
  items: DiskMcq[];
  skips: DiskSkip[];
}

function usage(): never {
  console.error(
    "Usage:\n" +
      "  npm run mcq -- transform --course <courseId> [--prompt-version <v>]\n" +
      "  npm run mcq -- import [--course <courseId>] [--write]   # dry-run default"
  );
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const mode = argv[0];
  if (mode !== "transform" && mode !== "import") usage();
  const opts = {
    mode: mode as "transform" | "import",
    courseId: null as string | null,
    write: false,
    dryRunExplicit: false,
    promptVersion: DEFAULT_MCQ_PROMPT_VERSION,
  };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--write") opts.write = true;
    else if (a === "--dry-run") opts.dryRunExplicit = true;
    else if (a === "--course" && argv[i + 1]) opts.courseId = argv[++i];
    else if (a === "--prompt-version" && argv[i + 1]) opts.promptVersion = argv[++i];
    else usage();
  }
  if (opts.dryRunExplicit) opts.write = false; // explicit --dry-run always wins
  if (opts.mode === "transform" && !opts.courseId) usage(); // deliberate runs only
  return opts;
}

// Per-skip-reason tally (decision 3: counts recorded, yield talk is data).
function tally(reasons: Map<string, number>, reason: string, n = 1) {
  reasons.set(reason, (reasons.get(reason) ?? 0) + n);
}

function printReasons(label: string, reasons: Map<string, number>) {
  if (!reasons.size) return;
  const rows = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`${label}: ${rows.map(([r, n]) => `${r}=${n}`).join(", ")}`);
}

// ---------------------------------------------------------------------------
// env gate + main dispatch (dynamic firebase import after the gate — the
// service file crashes cryptically at import time if FIREBASE_* is unset)
// ---------------------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2));

const REQUIRED_ENV = [
  "FIREBASE_PRIVATE_KEY_ID",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_CLIENT_ID",
  ...(opts.mode === "transform" ? ["PIPELINE_ANTHROPIC_API_KEY"] : []),
];
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missingEnv.length) {
  console.error(
    `Missing env vars: ${missingEnv.join(", ")}\nRun via \`npm run mcq -- ...\` so tsx loads .env.local.`
  );
  process.exit(1);
}

const { db } = await import("../../firebase/service");

// ---------------------------------------------------------------------------
// TRANSFORM
// ---------------------------------------------------------------------------

async function runTransform(courseId: string, promptVersion: string): Promise<number> {
  // Anthropic imported lazily: import mode must not require the SDK/key.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
  const { z } = await import("zod/v4");

  // §4 prompt rules 1–5, verbatim discipline. This is a NEW prompt with its
  // own version string — CLEANUP_PROMPT in run.mts is untouched.
  const MCQ_TRANSFORM_PROMPT = `You are converting instructor-approved study Q&A pairs from a dental lecture course (Iraqi Arabic with embedded English technical terms) into multiple-choice questions.

You receive JSON with:
- "targets": the pairs to convert, each {id, question, answer}. The answer is instructor-approved text and MUST NOT be changed.
- "corpus": every approved Q&A pair of the whole course — your ONLY source of distractor material.

For each target, either produce an MCQ or skip it.

MCQ rules:
1. correctAnswer: copy the target's answer EXACTLY, character for character. Never rephrase, shorten, or "improve" it.
2. distractors: exactly 3. Each must be grounded in the corpus — a true statement from ANOTHER pair (or a contrast the course itself states) that is clearly WRONG as an answer to this target's question. Never invent clinical facts, never alter numbers, never introduce anything the course does not say.
3. Each distractor must be genuinely wrong for this question: a student who understood the lecture must be able to rule it out from the lecture content alone. If a candidate distractor could be defended as a correct answer to this question, do not use it.
4. Match the key's register: Iraqi Arabic with English technical terms kept in English, comparable length and specificity to the correct answer. Avoid giveaway asymmetry between the key and the distractors.
5. Never use meta-options ("جميع ما سبق", "لا شيء مما سبق", "all of the above", ...).

Skip rules — skip with a reason instead of forcing a weak MCQ:
- the question is an enumeration/explanation prompt (عدّد، اشرح، وضّح، قارن...) whose answer is not one discrete claim -> reason "open-ended-stem"
- you cannot find 3 clean distractors in the corpus -> reason "no-clean-distractors"
- anything else preventing a fair MCQ -> a short kebab-case reason.

Every target id must appear exactly once across mcqs and skips.`;

  const McqGenSchema = z.object({
    mcqs: z.array(
      z.object({
        sourceQaDocId: z.string(),
        correctAnswer: z
          .string()
          .describe("the target's approved answer, copied EXACTLY unchanged"),
        distractors: z
          .array(z.string())
          .length(3)
          .describe("3 corpus-grounded options that are clearly wrong for this question"),
      })
    ),
    skips: z.array(
      z.object({
        sourceQaDocId: z.string(),
        reason: z.string().describe("short kebab-case skip reason"),
      })
    ),
  });

  const anthropic = new Anthropic({
    apiKey: process.env.PIPELINE_ANTHROPIC_API_KEY,
    authToken: null, // never fall back to ambient ANTHROPIC_* (run.mts pattern)
  });

  const courseSnap = await db.collection("courses").doc(courseId).get();
  if (!courseSnap.exists) {
    console.error(`Course not found: ${courseId}`);
    return 1;
  }
  const courseData = courseSnap.data() ?? {};
  const videos = ((courseData.videos ?? []) as CourseVideo[])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // ONE course-scoped query for the servable class (§1 read predicate); the
  // course-wide result doubles as the distractor corpus (§4.1 — a single
  // video is too thin to source 3 plausible distractors per item).
  const approvedSnap = await db
    .collection("courses")
    .doc(courseId)
    .collection("qa")
    .where("status", "==", "approved")
    .where("stale", "==", false)
    .get();

  const allApproved: SourcePair[] = approvedSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      qaDocId: doc.id,
      question: d.question,
      answer: d.answer,
      contentHash: d.contentHash,
      videoId: d.videoId,
      sectionId: d.sectionId ?? null,
      sourceStartSec: typeof d.sourceStartSec === "number" ? d.sourceStartSec : 0,
      sourceEndSec: typeof d.sourceEndSec === "number" ? d.sourceEndSec : 0,
      sourceSegmentIds: Array.isArray(d.sourceSegmentIds) ? d.sourceSegmentIds : [],
    };
  });
  const byVideo = new Map<string, SourcePair[]>();
  for (const p of allApproved) {
    const list = byVideo.get(p.videoId) ?? [];
    list.push(p);
    byVideo.set(p.videoId, list);
  }
  const corpusForPrompt = allApproved.map((p) => ({ question: p.question, answer: p.answer }));

  console.log(
    `Course ${courseId} ("${courseData.title ?? "?"}") — ${allApproved.length} approved pair(s) across ${byVideo.size} video(s); prompt ${promptVersion}\n`
  );

  let videosDone = 0;
  let videosSkippedResume = 0;
  let videosFailed = 0;
  let totalItems = 0;
  const skipReasons = new Map<string, number>();

  for (const video of videos) {
    const vPairs = byVideo.get(video.videoId);
    if (!vPairs?.length) continue; // nothing approved on this lesson
    const tag = `[${video.videoId}] "${video.title ?? "?"}"`;

    const outDir = join(OUTPUT_ROOT, courseId, video.videoId);
    const mcqPath = join(outDir, "mcq.json");
    if (existsSync(mcqPath)) {
      console.log(`${tag} — SKIP: mcq.json already exists (resume; delete it to re-transform)`);
      videosSkippedResume++;
      continue;
    }

    try {
      // Decision 3 pre-filter: strict verbatim keys make paragraph answers
      // un-optionable; cheap deterministic skip before spending tokens.
      const skips: DiskSkip[] = [];
      const targets: SourcePair[] = [];
      for (const p of vPairs) {
        if (normalizeQaText(p.answer).length > ANSWER_MAX_CHARS) {
          skips.push({ sourceQaDocId: p.qaDocId, reason: "answer-too-long" });
        } else {
          targets.push(p);
        }
      }

      const items: DiskMcq[] = [];
      const transformedAt = new Date().toISOString();

      if (targets.length) {
        console.log(`${tag} — transforming ${targets.length}/${vPairs.length} pair(s) via ${TRANSFORM_MODEL}...`);
        const response = await anthropic.messages.parse({
          model: TRANSFORM_MODEL,
          max_tokens: 16000,
          system: MCQ_TRANSFORM_PROMPT,
          messages: [
            {
              role: "user",
              content: JSON.stringify({
                targets: targets.map((p) => ({ id: p.qaDocId, question: p.question, answer: p.answer })),
                corpus: corpusForPrompt,
              }),
            },
          ],
          output_config: { format: zodOutputFormat(McqGenSchema) },
        });
        if (!response.parsed_output) {
          throw new Error(`no parsable output (stop_reason=${response.stop_reason})`);
        }

        const targetById = new Map(targets.map((p) => [p.qaDocId, p]));
        const handled = new Set<string>();

        for (const m of response.parsed_output.mcqs) {
          const pair = targetById.get(m.sourceQaDocId);
          if (!pair || handled.has(m.sourceQaDocId)) {
            skips.push({ sourceQaDocId: m.sourceQaDocId, reason: "unknown-or-duplicate-id" });
            continue;
          }
          handled.add(m.sourceQaDocId);

          // Verbatim key verification AT GENERATION (finding §3) — the model
          // echo is checked, then the PAIR's text is stored as canonical.
          if (normalizeQaText(m.correctAnswer) !== normalizeQaText(pair.answer)) {
            skips.push({ sourceQaDocId: pair.qaDocId, reason: "key-not-verbatim" });
            continue;
          }

          // §4.3 deterministic lint (shared module — no drift vs the actions).
          if (m.distractors.some((d) => !normalizeQaText(d))) {
            skips.push({ sourceQaDocId: pair.qaDocId, reason: "empty-option" });
            continue;
          }
          if (hasDuplicateOptions(pair.answer, m.distractors)) {
            skips.push({ sourceQaDocId: pair.qaDocId, reason: "duplicate-option" });
            continue;
          }
          if (m.distractors.some((d) => META_OPTION_RE.test(d))) {
            skips.push({ sourceQaDocId: pair.qaDocId, reason: "meta-option" });
            continue;
          }
          const lintWarnings = mcqLintWarnings(pair.answer, m.distractors);

          items.push({
            sourceQaDocId: pair.qaDocId,
            sourceContentHash: pair.contentHash,
            stem: pair.question, // v1: source question verbatim (decision 3 family)
            correctAnswer: pair.answer, // canonical text from the PAIR, not the echo
            distractors: m.distractors,
            courseId,
            videoId: video.videoId,
            sectionId: pair.sectionId,
            sourceStartSec: pair.sourceStartSec,
            sourceEndSec: pair.sourceEndSec,
            sourceSegmentIds: pair.sourceSegmentIds,
            quarantine: isNumericSensitive(pair.answer) ? "numeric" : null,
            mcqContentHash: mcqContentHash(video.videoId, pair.question, pair.answer, m.distractors),
            contentHashVersion: CONTENT_HASH_VERSION,
            transformModel: TRANSFORM_MODEL,
            transformPromptVersion: promptVersion,
            transformedAt,
            status: "pending",
            lintWarnings,
          });
        }

        for (const s of response.parsed_output.skips) {
          if (!targetById.has(s.sourceQaDocId) || handled.has(s.sourceQaDocId)) continue;
          handled.add(s.sourceQaDocId);
          skips.push({ sourceQaDocId: s.sourceQaDocId, reason: s.reason || "unspecified" });
        }
        for (const p of targets) {
          if (!handled.has(p.qaDocId)) skips.push({ sourceQaDocId: p.qaDocId, reason: "model-omitted" });
        }
      }

      // Write-last: mcq.json existing means this video fully succeeded
      // (empty-target videos still get a marker so resume skips them).
      mkdirSync(outDir, { recursive: true });
      const file: McqFile = {
        courseId,
        videoId: video.videoId,
        transformedAt,
        transformModel: TRANSFORM_MODEL,
        transformPromptVersion: promptVersion,
        items,
        skips,
      };
      writeFileSync(mcqPath, JSON.stringify(file, null, 1), "utf8");

      for (const s of skips) tally(skipReasons, s.reason);
      totalItems += items.length;
      videosDone++;
      console.log(
        `${tag} — done: ${items.length} MCQ(s), ${skips.length} skip(s)` +
          (skips.length ? ` [${skips.map((s) => s.reason).join(", ")}]` : "")
      );
    } catch (err) {
      videosFailed++;
      console.error(`${tag} — FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const eligibleTotal = totalItems + [...skipReasons.values()].reduce((a, b) => a + b, 0);
  console.log(
    `\nTransform summary: ${videosDone} video(s) done, ${videosSkippedResume} resumed-skip, ${videosFailed} failed | ` +
      `${totalItems} MCQ(s) from ${eligibleTotal} approved pair(s)` +
      (eligibleTotal ? ` (yield ${Math.round((totalItems / eligibleTotal) * 100)}%)` : "")
  );
  printReasons("Skip reasons", skipReasons);
  return videosFailed ? 1 : 0;
}

// ---------------------------------------------------------------------------
// IMPORT (dry-run default)
// ---------------------------------------------------------------------------

interface ImportReport {
  courseId: string;
  videoId: string;
  status: "imported" | "dry-run" | "REFUSED";
  reason?: string;
  itemsOnDisk: number;
  diskSkips: number;
  newItems: number;
  identicalSource: number;
  staleMarked: number;
  itemRefused: number;
  quarantineNumeric: number;
  writeOps: number;
}

async function runImport(courseFilter: string | null, write: boolean): Promise<number> {
  console.log(
    `${write ? "WRITE MODE" : "DRY-RUN (default — pass --write to commit)"} | target: courses/{id}/mcqItems\n`
  );

  const courseDirs = existsSync(OUTPUT_ROOT)
    ? readdirSync(OUTPUT_ROOT).filter((d) => {
        const p = join(OUTPUT_ROOT, d);
        return statSync(p).isDirectory() && (!courseFilter || d === courseFilter);
      })
    : [];
  if (!courseDirs.length) {
    console.error(courseFilter ? `No output directory for course ${courseFilter}` : `Nothing under ${OUTPUT_ROOT}`);
    return 1;
  }

  const reports: ImportReport[] = [];
  const skipReasons = new Map<string, number>(); // disk skips + import-time refusals, by reason
  const importedAt = new Date().toISOString();

  for (const courseId of courseDirs) {
    const courseDir = join(OUTPUT_ROOT, courseId);
    const videoDirs = readdirSync(courseDir).filter(
      (d) => statSync(join(courseDir, d)).isDirectory() && existsSync(join(courseDir, d, "mcq.json"))
    );
    if (!videoDirs.length) continue;

    const courseSnap = await db.collection("courses").doc(courseId).get();
    if (!courseSnap.exists) {
      reports.push({
        courseId, videoId: "*", status: "REFUSED", reason: "course doc not found",
        itemsOnDisk: 0, diskSkips: 0, newItems: 0, identicalSource: 0, staleMarked: 0,
        itemRefused: 0, quarantineNumeric: 0, writeOps: 0,
      });
      continue;
    }
    const courseVideos = ((courseSnap.data()?.videos ?? []) as CourseVideo[]);
    const videoById = new Map(courseVideos.map((v) => [v.videoId, v]));
    const qaCol = courseSnap.ref.collection("qa");
    const mcqCol = courseSnap.ref.collection("mcqItems");

    for (const videoId of videoDirs) {
      const report: ImportReport = {
        courseId, videoId, status: write ? "imported" : "dry-run",
        itemsOnDisk: 0, diskSkips: 0, newItems: 0, identicalSource: 0, staleMarked: 0,
        itemRefused: 0, quarantineNumeric: 0, writeOps: 0,
      };
      reports.push(report);
      const refuse = (reason: string) => {
        report.status = "REFUSED";
        report.reason = reason;
      };

      try {
        const file = JSON.parse(readFileSync(join(courseDir, videoId, "mcq.json"), "utf8")) as McqFile;
        if (file.courseId !== courseId || file.videoId !== videoId) {
          refuse("mcq.json course/video ids mismatch directory — foreign file");
          continue;
        }
        report.itemsOnDisk = file.items.length;
        report.diskSkips = file.skips.length;
        for (const s of file.skips) tally(skipReasons, `disk:${s.reason}`);
        if (!videoById.has(videoId)) {
          refuse("on disk but not on course doc (deleted video?)");
          continue;
        }

        // Source pairs re-read from Firestore — the import-time half of the
        // verbatim + divergence verification (finding §2.3 / §3).
        const pairRefs = file.items.map((it) => qaCol.doc(it.sourceQaDocId));
        const pairSnaps = pairRefs.length ? await db.getAll(...pairRefs) : [];
        const pairById = new Map(pairSnaps.map((s) => [s.id, s]));

        // Existing mcqItems for this video — idempotence map (decision 7).
        const existingSnap = await mcqCol.where("videoId", "==", videoId).get();
        const existingBySource = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
        for (const doc of existingSnap.docs) {
          const src = doc.data().sourceQaDocId;
          if (typeof src !== "string" || !src) {
            console.warn(`  [${courseId}/${videoId}] existing mcqItem ${doc.id} lacks sourceQaDocId — ignored`);
            continue;
          }
          if (existingBySource.has(src)) {
            console.warn(`  [${courseId}/${videoId}] duplicate mcqItems for source ${src} — keeping first, ignoring ${doc.id}`);
            continue;
          }
          existingBySource.set(src, doc);
        }

        const batchOps: Array<(b: FirebaseFirestore.WriteBatch) => void> = [];

        for (const item of file.items) {
          const refuseItem = (reason: string) => {
            report.itemRefused++;
            tally(skipReasons, `import:${reason}`);
          };

          // Recompute both integrity checks — stored values are caches.
          const recomputedHash = mcqContentHash(item.videoId, item.stem, item.correctAnswer, item.distractors);
          if (recomputedHash !== item.mcqContentHash) {
            refuseItem("hash-mismatch");
            continue;
          }
          const pairSnap = pairById.get(item.sourceQaDocId);
          const pair = pairSnap?.exists ? pairSnap.data()! : null;
          if (
            !pair ||
            pair.status !== "approved" ||
            pair.stale === true ||
            pair.contentHash !== item.sourceContentHash
          ) {
            refuseItem("source-diverged");
            continue;
          }
          // Verbatim key verification AT IMPORT (finding §3), against the
          // live Firestore text — not the disk echo.
          if (normalizeQaText(item.correctAnswer) !== normalizeQaText(pair.answer)) {
            refuseItem("key-not-verbatim");
            continue;
          }
          // Quarantine recompute is authoritative (qa import pattern).
          const quarantine = isNumericSensitive(item.correctAnswer) ? "numeric" : null;
          if (quarantine === "numeric") report.quarantineNumeric++;

          const existing = existingBySource.get(item.sourceQaDocId);
          if (existing) {
            if (existing.data().sourceContentHash === item.sourceContentHash) {
              // Same source text — the reviewed doc stands; incoming
              // (possibly different distractors from a re-run) is dropped.
              report.identicalSource++;
              continue;
            }
            // Source pair changed since that item was made: stale-mark the
            // old item (never delete — invariant-5 grammar) and land fresh.
            report.staleMarked++;
            batchOps.push((b) => b.set(existing.ref, { stale: true }, { merge: true }));
          }

          report.newItems++;
          const sectionId = videoById.get(videoId)?.sectionId ?? null; // join field: refresh from course doc
          batchOps.push((b) =>
            b.set(mcqCol.doc(), {
              sourceQaDocId: item.sourceQaDocId,
              sourceContentHash: item.sourceContentHash,
              stem: item.stem,
              correctAnswer: item.correctAnswer,
              distractors: item.distractors,
              courseId,
              videoId,
              sectionId,
              sourceStartSec: item.sourceStartSec,
              sourceEndSec: item.sourceEndSec,
              sourceSegmentIds: item.sourceSegmentIds,
              quarantine,
              mcqContentHash: recomputedHash,
              contentHashVersion: CONTENT_HASH_VERSION,
              transformModel: item.transformModel,
              transformPromptVersion: item.transformPromptVersion,
              transformedAt: item.transformedAt,
              lintWarnings: item.lintWarnings ?? [],
              status: "pending",
              stale: false,
              importedAt,
            })
          );
        }

        report.writeOps = batchOps.length;
        if (write && batchOps.length) {
          // Same chunking guard as import.mts; counts here are far smaller.
          for (let i = 0; i < batchOps.length; i += 400) {
            const b = db.batch();
            for (const op of batchOps.slice(i, i + 400)) op(b);
            await b.commit();
          }
        }
      } catch (err) {
        refuse(err instanceof Error ? err.message : String(err));
      }
    }
  }

  // --- report table -----------------------------------------------------
  const pad = (v: string | number, w: number) => String(v).padEnd(w);
  console.log(
    `${pad("video", 34)}${pad("items", 7)}${pad("dskip", 7)}${pad("new", 5)}${pad("ident", 7)}${pad("stale", 7)}${pad("refus", 7)}${pad("Q:num", 7)}${pad("ops", 5)}status`
  );
  for (const r of reports) {
    console.log(
      `${pad(`${r.courseId.slice(0, 12)}…/${r.videoId}`, 34)}${pad(r.itemsOnDisk, 7)}${pad(r.diskSkips, 7)}${pad(r.newItems, 5)}${pad(r.identicalSource, 7)}${pad(r.staleMarked, 7)}${pad(r.itemRefused, 7)}${pad(r.quarantineNumeric, 7)}${pad(r.writeOps, 5)}${r.status}${r.reason ? ` — ${r.reason}` : ""}`
    );
  }
  const sum = (f: (r: ImportReport) => number) => reports.reduce((a, r) => a + f(r), 0);
  const refused = reports.filter((r) => r.status === "REFUSED");
  console.log(
    `\nTOTALS: ${reports.length - refused.length} video(s) ${write ? "imported" : "planned"}, ${refused.length} refused | ` +
      `items ${sum((r) => r.itemsOnDisk)} → new ${sum((r) => r.newItems)}, identical-source ${sum((r) => r.identicalSource)}, ` +
      `stale-marked ${sum((r) => r.staleMarked)}, refused-items ${sum((r) => r.itemRefused)} | ` +
      `numeric ${sum((r) => r.quarantineNumeric)} | planned writes ${sum((r) => (r.status === "REFUSED" ? 0 : r.writeOps))}` +
      (write ? "" : "\nDRY-RUN — nothing was written. Re-run with --write after approval.")
  );
  printReasons("Skip/refusal reasons", skipReasons);
  return refused.length ? 1 : 0;
}

// ---------------------------------------------------------------------------

const exitCode =
  opts.mode === "transform"
    ? await runTransform(opts.courseId!, opts.promptVersion)
    : await runImport(opts.courseId, opts.write);
// firebase-admin keeps gRPC channels open; exit explicitly (run.mts pattern).
process.exit(exitCode);
