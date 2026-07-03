// Q&A Firestore import — Phase 1 of docs/RUBIK_STUDY_FEATURES.md.
// Reads output/{courseId}/{videoId}/{qa.json,transcript.json} (produced by
// run.mts) and lands them in Firestore per the §7 normative schema:
//   courses/{courseId}/qa/{qaDocId}            one doc per pair
//   courses/{courseId}/transcripts/{videoId}   segments + metadata; ALSO the
//                                              import marker (§5.3 firewall)
//
// SAFETY MODEL
//   - DRY-RUN IS THE DEFAULT. Nothing is written without an explicit --write.
//     Dry-run executes the identical code path (discovery, firewall reads,
//     coherence check, hashing, quarantine, batch assembly) and skips only
//     the commits.
//   - One atomic WriteBatch per video (max ~34 ops observed vs the 500-op
//     limit; defensive chunking at >450 with the transcript doc committed
//     LAST — marker-exists implies video-fully-imported, mirroring run.mts's
//     qa.json write-last resume semantics).
//   - Default mode is insert-only and idempotent: videos whose transcript
//     marker exists are SKIPPED. --migrate reconciles instead (§5.3):
//     identical contentHash keeps doc ID/status/review fields; new hash lands
//     as fresh pending; hashes missing from disk are marked stale:true (never
//     deleted). Approved pairs' evidence fields are NEVER overwritten — they
//     are clip-attested human claims (invariant 4).
//   - Doc IDs are minted fresh at import — an OWNER decision recorded in the
//     docs/AUDIT_QA_IMPORT.md Addendum, deliberately overriding that audit
//     body's disk-qaId recommendation. Pipeline qaIds are regeneration-
//     unstable and stored only as pipelineQaId provenance; dedupe keys on
//     contentHash, never on IDs.
//
// Usage (run from Git Bash / cmd — under PowerShell npm swallows "--course"):
//   npm run import -- [--course <courseId>] [--migrate] [--prompt-version <v>]
//   npm run import -- --write [...]           # real writes, after dry-run OK
//
// Required env (.env.local via tsx --env-file; NB --env-file does NOT
// override vars already exported in the shell): FIREBASE_PRIVATE_KEY_ID,
// FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_CLIENT_ID.
// Deliberately NOT required and NOT imported: PIPELINE_ANTHROPIC_API_KEY,
// MUX_* — this script needs neither Anthropic nor Mux.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTENT_HASH_VERSION,
  classifyQuarantine,
  contentHash,
  type Quarantine,
} from "../../lib/qa/contentHash";
import type { CourseVideo } from "../../types/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_ROOT = join(HERE, "..", "..", "output");

// Bump when the generation prompt/model changes; overridable per run.
const DEFAULT_PROMPT_VERSION = "cleanup-v1-2026-07-03-484373f";

// faster-whisper reject thresholds — must stay identical to run.mts so the
// coherence check can re-derive needsReview.
const THRESHOLDS = { avgLogprob: -1.0, noSpeechProb: 0.6, compressionRatio: 2.4 };
const EPS = 1e-9;

interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  avg_logprob: number;
  no_speech_prob: number;
  compression_ratio: number;
}

// Disk shape written by run.mts (QaRecord).
interface DiskPair {
  qaId: string;
  courseId: string;
  videoId: string;
  question: string;
  answer: string;
  status: "pending";
  sourceStartSec: number;
  sourceEndSec: number;
  sourceSegmentIds: number[];
  avgLogprob: number | null;
  noSpeechProb: number | null;
  compressionRatio: number | null;
  needsReview: boolean;
  createdAt: string;
}

interface VideoReport {
  courseId: string;
  videoId: string;
  status: "imported" | "dry-run" | "skipped-already-imported" | "REFUSED";
  reason?: string;
  pairsOnDisk: number;
  duplicateInFile: number;
  newPairs: number;
  identical: number;
  staleMarked: number;
  quarantineNumeric: number;
  quarantineSentinel: number;
  quarantineFlagged: number;
  writeOps: number;
}

function usage(): never {
  console.error(
    "Usage:\n" +
      "  npm run import -- [--course <courseId>] [--migrate] [--prompt-version <v>]\n" +
      "  npm run import -- --write [...]   # real writes (default is dry-run)"
  );
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const opts = { courseId: null as string | null, write: false, dryRunExplicit: false, migrate: false, promptVersion: DEFAULT_PROMPT_VERSION };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--write") opts.write = true;
    else if (a === "--migrate") opts.migrate = true;
    else if (a === "--dry-run") opts.dryRunExplicit = true;
    else if (a === "--course" && argv[i + 1]) opts.courseId = argv[++i];
    else if (a === "--prompt-version" && argv[i + 1]) opts.promptVersion = argv[++i];
    else usage();
  }
  // Fail-safe regardless of flag order: an explicit --dry-run always wins
  // over --write.
  if (opts.dryRunExplicit) opts.write = false;
  return opts;
}

function approxEqual(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < EPS;
}

// Re-derive the evidence fields from the transcript exactly as
// run.mts buildQaRecords does; any mismatch means a mixed evidence chain
// (transcript regenerated after qa.json) and the video is refused.
function coherenceError(pair: DiskPair, byId: Map<number, TranscriptSegment>): string | null {
  const src = pair.sourceSegmentIds
    .map((id) => byId.get(id))
    .filter((s): s is TranscriptSegment => s !== undefined);
  const citedUnknown = src.length !== pair.sourceSegmentIds.length;
  const expected = {
    sourceStartSec: src.length ? Math.min(...src.map((s) => s.start)) : 0,
    sourceEndSec: src.length ? Math.max(...src.map((s) => s.end)) : 0,
    avgLogprob: src.length ? Math.min(...src.map((s) => s.avg_logprob)) : null,
    noSpeechProb: src.length ? Math.max(...src.map((s) => s.no_speech_prob)) : null,
    compressionRatio: src.length ? Math.max(...src.map((s) => s.compression_ratio)) : null,
    needsReview:
      src.some(
        (s) =>
          s.avg_logprob < THRESHOLDS.avgLogprob ||
          s.no_speech_prob > THRESHOLDS.noSpeechProb ||
          s.compression_ratio > THRESHOLDS.compressionRatio
      ) ||
      citedUnknown ||
      src.length === 0,
  };
  if (!approxEqual(expected.sourceStartSec, pair.sourceStartSec)) return `sourceStartSec ${pair.sourceStartSec} != derived ${expected.sourceStartSec}`;
  if (!approxEqual(expected.sourceEndSec, pair.sourceEndSec)) return `sourceEndSec ${pair.sourceEndSec} != derived ${expected.sourceEndSec}`;
  if (!approxEqual(expected.avgLogprob, pair.avgLogprob)) return `avgLogprob ${pair.avgLogprob} != derived ${expected.avgLogprob}`;
  if (!approxEqual(expected.noSpeechProb, pair.noSpeechProb)) return `noSpeechProb ${pair.noSpeechProb} != derived ${expected.noSpeechProb}`;
  if (!approxEqual(expected.compressionRatio, pair.compressionRatio)) return `compressionRatio ${pair.compressionRatio} != derived ${expected.compressionRatio}`;
  if (expected.needsReview !== pair.needsReview) return `needsReview ${pair.needsReview} != derived ${expected.needsReview}`;
  return null;
}

// --- main --------------------------------------------------------------------

const REQUIRED_ENV = [
  "FIREBASE_PRIVATE_KEY_ID",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_CLIENT_ID",
];
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missingEnv.length) {
  console.error(
    `Missing env vars: ${missingEnv.join(", ")}\n` +
      "Run via `npm run import -- ...` so tsx loads .env.local."
  );
  process.exit(1);
}

const opts = parseArgs(process.argv.slice(2));
const importedAt = new Date().toISOString();

// firebase/service.ts crashes with a cryptic TypeError at import time if the
// FIREBASE_* vars are unset — import only after the env gate (run.mts pattern).
const { db } = await import("../../firebase/service");

const courseDirs = readdirSync(OUTPUT_ROOT).filter((d) => {
  const p = join(OUTPUT_ROOT, d);
  return statSync(p).isDirectory() && (!opts.courseId || d === opts.courseId);
});
if (!courseDirs.length) {
  console.error(opts.courseId ? `No output directory for course ${opts.courseId}` : `Nothing under ${OUTPUT_ROOT}`);
  process.exit(1);
}

console.log(
  `${opts.write ? "WRITE MODE" : "DRY-RUN (default — pass --write to commit)"}` +
    ` | mode: ${opts.migrate ? "migrate (reconcile)" : "insert-only"}` +
    ` | promptVersion: ${opts.promptVersion}\n`
);

const reports: VideoReport[] = [];

for (const courseId of courseDirs) {
  const courseDir = join(OUTPUT_ROOT, courseId);
  const refuseCourse = (reason: string) =>
    reports.push({
      courseId, videoId: "*", status: "REFUSED", reason,
      pairsOnDisk: 0, duplicateInFile: 0, newPairs: 0, identical: 0, staleMarked: 0,
      quarantineNumeric: 0, quarantineSentinel: 0, quarantineFlagged: 0, writeOps: 0,
    });

  // Course-level discovery is isolated too: a transient network/FS error
  // refuses this course and moves on instead of aborting the whole run.
  let videos: CourseVideo[];
  let diskVideoIds: string[];
  try {
    const courseSnap = await db.collection("courses").doc(courseId).get();
    if (!courseSnap.exists) {
      refuseCourse("course doc not found in Firestore");
      continue;
    }
    const courseData = courseSnap.data() ?? {};
    videos = ((courseData.videos ?? []) as CourseVideo[])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    diskVideoIds = readdirSync(courseDir).filter(
      (d) => statSync(join(courseDir, d)).isDirectory() && existsSync(join(courseDir, d, "qa.json"))
    );
  } catch (err) {
    refuseCourse(`course-level failure: ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }
  const videoById = new Map(videos.map((v) => [v.videoId, v]));

  // Orphan check: qa.json on disk for a video the course doc no longer has.
  for (const vid of diskVideoIds) {
    if (!videoById.has(vid)) {
      reports.push({
        courseId, videoId: vid, status: "REFUSED", reason: "on disk but not on course doc (deleted video?)",
        pairsOnDisk: 0, duplicateInFile: 0, newPairs: 0, identical: 0, staleMarked: 0,
        quarantineNumeric: 0, quarantineSentinel: 0, quarantineFlagged: 0, writeOps: 0,
      });
    }
  }

  const qaCol = db.collection("courses").doc(courseId).collection("qa");
  const trCol = db.collection("courses").doc(courseId).collection("transcripts");

  // Iterate in course order (disk glob order is lexicographic and wrong).
  for (const video of videos) {
    if (!diskVideoIds.includes(video.videoId)) continue; // not processed by the pipeline yet
    const videoDir = join(courseDir, video.videoId);
    const report: VideoReport = {
      courseId, videoId: video.videoId, status: opts.write ? "imported" : "dry-run",
      pairsOnDisk: 0, duplicateInFile: 0, newPairs: 0, identical: 0, staleMarked: 0,
      quarantineNumeric: 0, quarantineSentinel: 0, quarantineFlagged: 0, writeOps: 0,
    };
    reports.push(report);
    const refuse = (reason: string) => {
      report.status = "REFUSED";
      report.reason = reason;
    };

    try {
      // --- load + validate disk data -------------------------------------
      const transcriptPath = join(videoDir, "transcript.json");
      if (!existsSync(transcriptPath)) { refuse("qa.json without transcript.json"); continue; }
      const transcriptRaw = readFileSync(transcriptPath);
      const segments = JSON.parse(transcriptRaw.toString("utf8")) as TranscriptSegment[];
      if (!Array.isArray(segments) || !segments.length) { refuse("transcript.json empty/not an array"); continue; }
      const transcriptHash = createHash("sha256").update(transcriptRaw).digest("hex");
      const byId = new Map(segments.map((s) => [s.id, s]));

      const pairs = JSON.parse(readFileSync(join(videoDir, "qa.json"), "utf8")) as DiskPair[];
      report.pairsOnDisk = pairs.length;
      if (!pairs.length) {
        // Importing an empty file writes a qaCount:0 marker — the video then
        // counts as imported, and a later run that yields pairs needs --migrate.
        console.log(`  [${courseId}/${video.videoId}] qa.json is EMPTY — marker-only import`);
      }
      for (const p of pairs) {
        if (typeof p.qaId !== "string" || !p.qaId) { refuse("pair with missing qaId — foreign/corrupt qa.json"); break; }
        if (p.courseId !== courseId || p.videoId !== video.videoId) { refuse(`pair ${p.qaId} has mismatched course/video ids`); break; }
        // Evidence fields are mandatory (corpus verified 426/426); absence
        // means a stale/foreign qa.json — hard error, not a soft default.
        if (!Array.isArray(p.sourceSegmentIds) || !("compressionRatio" in p)) { refuse(`pair ${p.qaId} lacks evidence fields — regenerate before import`); break; }
        const mismatch = coherenceError(p, byId);
        if (mismatch) { refuse(`coherence check failed on ${p.qaId}: ${mismatch} (mixed evidence chain?)`); break; }
      }
      if (report.status === "REFUSED") continue;

      // --- firewall (§5.3) -------------------------------------------------
      const markerSnap = await trCol.doc(video.videoId).get();
      if (markerSnap.exists && !opts.migrate) {
        report.status = "skipped-already-imported";
        continue;
      }
      if (!markerSnap.exists) {
        const strays = await qaCol.where("videoId", "==", video.videoId).limit(1).get();
        if (!strays.empty) { refuse("qa docs exist WITHOUT an import marker — inconsistent state, refusing to auto-repair"); continue; }
      }

      // --- classify ---------------------------------------------------------
      // In-file dedupe: generation is nondeterministic; keep first occurrence.
      const byHash = new Map<string, DiskPair>();
      for (const p of pairs) {
        const h = contentHash(p.videoId, p.question, p.answer);
        if (byHash.has(h)) {
          report.duplicateInFile++;
          console.log(`  [${courseId}/${video.videoId}] in-file duplicate dropped: ${p.qaId}`);
        } else byHash.set(h, p);
      }

      // Existing docs (migrate mode only — insert-only mode got here iff no marker and no strays).
      const existingByHash = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      if (markerSnap.exists && opts.migrate) {
        const existing = await qaCol.where("videoId", "==", video.videoId).get();
        for (const doc of existing.docs) {
          const h = doc.data().contentHash;
          // Docs without a string contentHash (pre-schema / hand-edited) or
          // colliding with an already-seen hash are skipped LOUDLY — mapping
          // them under undefined/last-wins would create duplicate imports and
          // wrong stale-marks.
          if (typeof h !== "string" || !h) {
            console.warn(`  [${courseId}/${video.videoId}] existing doc ${doc.id} lacks contentHash — skipped (not matched, not stale-marked); repair manually`);
            continue;
          }
          if (existingByHash.has(h)) {
            console.warn(`  [${courseId}/${video.videoId}] duplicate contentHash in Firestore (${doc.id} vs ${existingByHash.get(h)!.id}) — keeping first, skipping ${doc.id}`);
            continue;
          }
          existingByHash.set(h, doc);
        }
      }

      const pipelineRunAt = pairs[0]?.createdAt ?? importedAt;
      const batchOps: Array<(b: FirebaseFirestore.WriteBatch) => void> = [];

      for (const [h, p] of byHash) {
        const quarantine: Quarantine = classifyQuarantine(p);
        if (quarantine === "numeric") report.quarantineNumeric++;
        else if (quarantine === "sentinel") report.quarantineSentinel++;
        else if (quarantine === "flagged") report.quarantineFlagged++;

        const existing = existingByHash.get(h);
        if (existing) {
          report.identical++;
          existingByHash.delete(h);
          const approved = existing.data().status === "approved";
          // Denormalized JOIN fields always refresh — they mirror the course
          // doc (a video can move sections / flip free-preview) and are not
          // clip-attested evidence, so invariant 4 does not freeze them.
          const joinRefresh = {
            stale: false,
            sectionId: video.sectionId ?? null,
            isFreePreviewVideo: video.isFreePreview === true,
          };
          // Approved pairs' EVIDENCE is clip-attested human verification —
          // never overwritten by fresh (unverified) model citations.
          const refresh = approved
            ? joinRefresh
            : {
                ...joinRefresh,
                sourceStartSec: p.sourceStartSec, sourceEndSec: p.sourceEndSec,
                sourceSegmentIds: p.sourceSegmentIds,
                avgLogprob: p.avgLogprob, noSpeechProb: p.noSpeechProb,
                compressionRatio: p.compressionRatio, needsReview: p.needsReview,
                quarantine, pipelineQaId: p.qaId, pipelineRunAt,
                promptVersion: opts.promptVersion, transcriptHash,
              };
          batchOps.push((b) => b.set(existing.ref, refresh, { merge: true }));
        } else {
          report.newPairs++;
          batchOps.push((b) =>
            // Fresh doc ID minted at import — becomes the canonical stable ID.
            b.set(qaCol.doc(), {
              question: p.question,
              answer: p.answer,
              status: "pending",
              courseId,
              videoId: video.videoId,
              sectionId: video.sectionId ?? null,
              isFreePreviewVideo: video.isFreePreview === true,
              sourceStartSec: p.sourceStartSec,
              sourceEndSec: p.sourceEndSec,
              sourceSegmentIds: p.sourceSegmentIds,
              avgLogprob: p.avgLogprob,
              noSpeechProb: p.noSpeechProb,
              compressionRatio: p.compressionRatio,
              needsReview: p.needsReview,
              quarantine,
              contentHash: h,
              contentHashVersion: CONTENT_HASH_VERSION,
              pipelineQaId: p.qaId,
              pipelineRunAt,
              promptVersion: opts.promptVersion,
              transcriptHash,
              stale: false,
              importedAt,
            })
          );
        }
      }

      // Hashes in Firestore that no longer exist on disk → stale, never deleted.
      for (const orphan of existingByHash.values()) {
        report.staleMarked++;
        batchOps.push((b) => b.set(orphan.ref, { stale: true }, { merge: true }));
      }

      // Transcript doc = §7.2 storage AND the atomic import marker.
      const transcriptOp = (b: FirebaseFirestore.WriteBatch) =>
        b.set(trCol.doc(video.videoId), {
          courseId,
          videoId: video.videoId,
          segments,
          segmentCount: segments.length,
          qaCount: byHash.size,
          pipelineRunAt,
          transcriptHash,
          promptVersion: opts.promptVersion,
          importedAt,
        });

      report.writeOps = batchOps.length + 1;

      // --- commit (write mode only) ----------------------------------------
      if (opts.write) {
        if (report.writeOps <= 450) {
          const b = db.batch();
          for (const op of batchOps) op(b);
          transcriptOp(b); // same atomic batch: marker ⟺ fully imported
          await b.commit();
        } else {
          // Oversized video: chunk pairs at 400, transcript marker in the
          // LAST batch so marker-exists still implies completeness.
          for (let i = 0; i < batchOps.length; i += 400) {
            const b = db.batch();
            for (const op of batchOps.slice(i, i + 400)) op(b);
            if (i + 400 >= batchOps.length) transcriptOp(b);
            await b.commit();
          }
        }
      }
    } catch (err) {
      refuse(err instanceof Error ? err.message : String(err));
    }
  }
}

// --- report --------------------------------------------------------------------
const pad = (v: string | number, w: number) => String(v).padEnd(w);
console.log(
  `\n${pad("video", 34)}${pad("pairs", 7)}${pad("dup", 5)}${pad("new", 5)}${pad("ident", 7)}${pad("stale", 7)}${pad("Q:num", 7)}${pad("Q:sen", 7)}${pad("Q:flag", 8)}${pad("ops", 5)}status`
);
for (const r of reports) {
  console.log(
    `${pad(`${r.courseId.slice(0, 12)}…/${r.videoId}`, 34)}${pad(r.pairsOnDisk, 7)}${pad(r.duplicateInFile, 5)}${pad(r.newPairs, 5)}${pad(r.identical, 7)}${pad(r.staleMarked, 7)}${pad(r.quarantineNumeric, 7)}${pad(r.quarantineSentinel, 7)}${pad(r.quarantineFlagged, 8)}${pad(r.writeOps, 5)}${r.status}${r.reason ? ` — ${r.reason}` : ""}`
  );
}
const sum = (f: (r: VideoReport) => number) => reports.reduce((a, r) => a + f(r), 0);
const refused = reports.filter((r) => r.status === "REFUSED");
const processed = reports.filter((r) => r.status === "imported" || r.status === "dry-run");
console.log(
  `\nTOTALS: ${processed.length} video(s) ${opts.write ? "imported" : "planned"}, ` +
    `${reports.filter((r) => r.status === "skipped-already-imported").length} skipped (already imported), ${refused.length} refused | ` +
    `pairs ${sum((r) => r.pairsOnDisk)} → new ${sum((r) => r.newPairs)}, identical ${sum((r) => r.identical)}, ` +
    `stale ${sum((r) => r.staleMarked)}, dupInFile ${sum((r) => r.duplicateInFile)} | ` +
    `quarantined ${sum((r) => r.quarantineNumeric + r.quarantineSentinel + r.quarantineFlagged)} ` +
    `(numeric ${sum((r) => r.quarantineNumeric)} / sentinel ${sum((r) => r.quarantineSentinel)} / flagged ${sum((r) => r.quarantineFlagged)}) | ` +
    `planned writes: ${sum((r) => (r.status === "REFUSED" || r.status === "skipped-already-imported" ? 0 : r.writeOps))} ` +
    `(${sum((r) => (r.status === "REFUSED" || r.status === "skipped-already-imported" ? 0 : r.newPairs + r.identical + r.staleMarked))} pair ops + ` +
    `${processed.length} transcript docs)` +
    (opts.write ? "" : "\nDRY-RUN — nothing was written. Re-run with --write after approval.")
);
process.exit(refused.length ? 1 : 0);
