// Transcription pipeline — per video: Firestore lookup -> signed Mux HLS audio
// pull (ffmpeg) -> faster-whisper transcript (Python) -> Claude Q&A generation.
//
// READ-ONLY against Firestore and Mux. All output goes to disk:
//   output/{courseId}/{videoId}/transcript.json   raw segments + confidence
//   output/{courseId}/{videoId}/transcript.txt    human-readable
//   output/{courseId}/{videoId}/qa.json           Q&A pairs (status "pending")
//   output/{courseId}/_errors.log                 per-video failures (batch keeps going)
//
// Usage:
//   npm run pipeline -- --video <courseId> <videoId>
//   npm run pipeline -- --course <courseId>
//
// The npm script loads .env.local via tsx --env-file. NB: --env-file does NOT
// override variables already exported in your shell. The Anthropic key is
// therefore read from PIPELINE_ANTHROPIC_API_KEY (not ANTHROPIC_API_KEY) and
// passed to the client explicitly, so an ambient ANTHROPIC_API_KEY from other
// tooling (e.g. Claude Code) can never shadow it. Required vars:
//   FIREBASE_PRIVATE_KEY_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL,
//   FIREBASE_CLIENT_ID, MUX_SIGNING_KEY_ID, MUX_SIGNING_PRIVATE_KEY,
//   PIPELINE_ANTHROPIC_API_KEY
// Local tools (not committed): scripts/spike/ffmpeg.exe, and a Python with
// faster-whisper installed (default C:\Python313\python.exe; override with
// PIPELINE_PYTHON). First whisper run downloads the ~3 GB large-v3 model.
//
// Resume: a video whose qa.json already exists is skipped, so re-running the
// same --course command continues where a crash/lid-close stopped.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// zod/v4 subpath (shipped in zod ^3.25): the SDK's zodOutputFormat helper
// types against zod v4 — the app's plain "zod" import stays untouched.
import { z } from "zod/v4";
import { signPlaybackToken } from "../../lib/mux/playbackToken";
import type { CourseVideo } from "../../types/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const FFMPEG = join(ROOT, "scripts", "spike", "ffmpeg.exe");
const TRANSCRIBE_PY = join(HERE, "transcribe.py");
const PYTHON = process.env.PIPELINE_PYTHON ?? "C:\\Python313\\python.exe";
const OUTPUT_ROOT = join(ROOT, "output");

// ---------------------------------------------------------------------------
// Cleanup prompt — the user's VALIDATED Sonnet wording, verbatim, for the
// correction + grounding portion. The final line adds the segment-citation
// instruction required by the structured-output schema
// (question/answer/sourceSegmentIds). Do not soften the grounding sentences.
// ---------------------------------------------------------------------------
const CLEANUP_PROMPT = `You are processing a raw speech-recognition transcript of a dental lecture taught in Iraqi Arabic with English technical terms mixed in. It has recognition errors.

Do two things:

1. CORRECT obvious recognition errors using dental domain knowledge. Example: "Combium Computed Tomography" is clearly "Cone Beam Computed Tomography." Fix mangled English terms and garbled words. Keep English technical terms in English (as the instructor said them); keep everything else in Arabic. Do NOT add information that wasn't spoken.

2. From the corrected content, generate study Q&A pairs in Arabic (keeping English technical terms in English). Every answer must come ONLY from what the lecture actually said.

CRITICAL RULE: You may not introduce any fact from outside this transcript. If unsure whether something was said, leave it out. Your job is to structure and clean what exists — not to teach beyond it.

For each Q&A pair, cite the ids of the transcript segments the answer is derived from (sourceSegmentIds).`;

// faster-whisper's own reject thresholds — a pair derived from any segment
// breaching one of these is flagged needsReview.
const THRESHOLDS = { avgLogprob: -1.0, noSpeechProb: 0.6, compressionRatio: 2.4 };

interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  avg_logprob: number;
  no_speech_prob: number;
  compression_ratio: number;
}

interface QaRecord {
  qaId: string;
  courseId: string;
  videoId: string;
  question: string;
  answer: string;
  status: "pending";
  sourceStartSec: number;
  sourceEndSec: number;
  avgLogprob: number | null;
  noSpeechProb: number | null;
  needsReview: boolean;
  createdAt: string;
}

const QaGenSchema = z.object({
  pairs: z.array(
    z.object({
      question: z.string().describe("Arabic question; English technical terms stay in English"),
      answer: z.string().describe("Arabic answer grounded ONLY in the cited transcript segments"),
      sourceSegmentIds: z
        .array(z.number().int())
        .describe("ids of the transcript segments this pair is derived from"),
    })
  ),
});

// Same pattern as lib/sectional/sectionId.ts mintSectionId, different prefix.
const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function mintQaId(): string {
  let id = "";
  for (const byte of randomBytes(10)) id += ID_ALPHABET[byte % ID_ALPHABET.length];
  return `qa_${id}`;
}

function usage(): never {
  console.error(
    "Usage:\n" +
      "  npm run pipeline -- --video <courseId> <videoId>\n" +
      "  npm run pipeline -- --course <courseId>"
  );
  process.exit(1);
}

function parseArgs(argv: string[]): { courseId: string; videoId?: string } {
  if (argv[0] === "--video" && argv[1] && argv[2]) return { courseId: argv[1], videoId: argv[2] };
  if (argv[0] === "--course" && argv[1] && !argv[2]) return { courseId: argv[1] };
  usage();
}

async function pullAudio(playbackId: string, outPath: string): Promise<void> {
  const token = await signPlaybackToken({ playbackId, ttlSeconds: 3600 });
  const url = `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
  // Token travels via argv only; scrub it from anything ffmpeg echoes back.
  const scrub = (s: string) => s.split(token).join("<TOKEN_REDACTED>");
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", url, "-vn", "-acodec", "copy", outPath];
  const r = spawnSync(FFMPEG, args, { encoding: "utf8" });
  if (r.error) throw new Error(`ffmpeg failed to start: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ffmpeg exit ${r.status}: ${scrub(r.stderr ?? "").trim()}`);
  if (!existsSync(outPath) || statSync(outPath).size === 0) {
    throw new Error("ffmpeg produced no audio output");
  }
}

function transcribe(audioPath: string, jsonOut: string, txtOut: string): TranscriptSegment[] {
  const r = spawnSync(
    PYTHON,
    [TRANSCRIBE_PY, "--audio", audioPath, "--json-out", jsonOut, "--txt-out", txtOut],
    {
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      stdio: ["ignore", "inherit", "inherit"], // stream whisper progress live
    }
  );
  if (r.error) throw new Error(`python failed to start (${PYTHON}): ${r.error.message}`);
  if (r.status !== 0) throw new Error(`transcribe.py exit ${r.status}`);
  const segments = JSON.parse(readFileSync(jsonOut, "utf8")) as TranscriptSegment[];
  if (!segments.length) throw new Error("transcription produced zero segments");
  return segments;
}

async function generateQa(
  anthropic: Anthropic,
  segments: TranscriptSegment[]
): Promise<z.infer<typeof QaGenSchema>["pairs"]> {
  const promptSegments = segments.map((s) => ({ id: s.id, start: s.start, end: s.end, text: s.text }));
  const response = await anthropic.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 16000,
    system: CLEANUP_PROMPT,
    messages: [
      {
        role: "user",
        content: `Transcript segments (JSON array of {id, start, end, text}; start/end in seconds):\n${JSON.stringify(promptSegments)}`,
      },
    ],
    output_config: { format: zodOutputFormat(QaGenSchema) },
  });
  if (!response.parsed_output) {
    throw new Error(`Claude returned no parsable output (stop_reason=${response.stop_reason})`);
  }
  return response.parsed_output.pairs;
}

function buildQaRecords(
  courseId: string,
  videoId: string,
  pairs: z.infer<typeof QaGenSchema>["pairs"],
  segments: TranscriptSegment[]
): QaRecord[] {
  const byId = new Map(segments.map((s) => [s.id, s]));
  return pairs.map((pair) => {
    const src = pair.sourceSegmentIds
      .map((id) => byId.get(id))
      .filter((s): s is TranscriptSegment => s !== undefined);
    const citedUnknownSegment = src.length !== pair.sourceSegmentIds.length;
    const breachesThreshold = src.some(
      (s) =>
        s.avg_logprob < THRESHOLDS.avgLogprob ||
        s.no_speech_prob > THRESHOLDS.noSpeechProb ||
        s.compression_ratio > THRESHOLDS.compressionRatio
    );
    return {
      qaId: mintQaId(),
      courseId,
      videoId,
      question: pair.question,
      answer: pair.answer,
      status: "pending",
      sourceStartSec: src.length ? Math.min(...src.map((s) => s.start)) : 0,
      sourceEndSec: src.length ? Math.max(...src.map((s) => s.end)) : 0,
      avgLogprob: src.length ? Math.min(...src.map((s) => s.avg_logprob)) : null,
      noSpeechProb: src.length ? Math.max(...src.map((s) => s.no_speech_prob)) : null,
      needsReview: breachesThreshold || citedUnknownSegment || src.length === 0,
      createdAt: new Date().toISOString(),
    };
  });
}

function logError(courseId: string, videoId: string, err: unknown): void {
  const dir = join(OUTPUT_ROOT, courseId);
  mkdirSync(dir, { recursive: true });
  const message = err instanceof Error ? err.message : String(err);
  appendFileSync(join(dir, "_errors.log"), `${new Date().toISOString()} ${videoId} ${message}\n`, "utf8");
}

// --- main -------------------------------------------------------------------

const REQUIRED_ENV = [
  "FIREBASE_PRIVATE_KEY_ID",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_CLIENT_ID",
  "MUX_SIGNING_KEY_ID",
  "MUX_SIGNING_PRIVATE_KEY",
  "PIPELINE_ANTHROPIC_API_KEY",
];
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missingEnv.length) {
  console.error(
    `Missing env vars: ${missingEnv.join(", ")}\n` +
      "Run via `npm run pipeline -- ...` so tsx loads .env.local."
  );
  process.exit(1);
}
if (!existsSync(FFMPEG)) {
  console.error(`ffmpeg not found at ${FFMPEG} — supply it (the spike dir is gitignored).`);
  process.exit(1);
}

const { courseId, videoId } = parseArgs(process.argv.slice(2));

// Imported dynamically AFTER the env check: firebase/service.ts initializes
// eagerly at import and crashes with a cryptic TypeError if FIREBASE_* is unset.
const { db } = await import("../../firebase/service");
// Explicit key + authToken:null — the SDK must never fall back to ambient
// ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN from the surrounding shell.
const anthropic = new Anthropic({
  apiKey: process.env.PIPELINE_ANTHROPIC_API_KEY,
  authToken: null,
});

const courseSnap = await db.collection("courses").doc(courseId).get();
if (!courseSnap.exists) {
  console.error(`Course not found: ${courseId}`);
  process.exit(1);
}
const courseData = courseSnap.data() ?? {};
let videos = ((courseData.videos ?? []) as CourseVideo[])
  .slice()
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

if (videoId) {
  videos = videos.filter((v) => v.videoId === videoId);
  if (!videos.length) {
    console.error(`Video not found on course ${courseId}: ${videoId}`);
    process.exit(1);
  }
}

console.log(`Course ${courseId} ("${courseData.title ?? "?"}") — ${videos.length} video(s) to process`);

let done = 0;
let skippedDone = 0;
let skippedNoPlayback = 0;
let failed = 0;

for (let i = 0; i < videos.length; i++) {
  const video = videos[i];
  const tag = `[${i + 1}/${videos.length}] videoId=${video.videoId}`;

  if (!video.playbackId) {
    console.log(`${tag} — SKIP: no playbackId`);
    logError(courseId, video.videoId, "skipped: no playbackId");
    skippedNoPlayback++;
    continue;
  }

  const outDir = join(OUTPUT_ROOT, courseId, video.videoId);
  const qaPath = join(outDir, "qa.json");
  if (existsSync(qaPath)) {
    console.log(`${tag} — SKIP: qa.json already exists (resume)`);
    skippedDone++;
    continue;
  }

  const audioPath = join(outDir, "audio.m4a");
  try {
    mkdirSync(outDir, { recursive: true });
    const jsonOut = join(outDir, "transcript.json");
    const txtOut = join(outDir, "transcript.txt");

    let segments: TranscriptSegment[];
    if (existsSync(jsonOut) && statSync(jsonOut).size > 0) {
      // Stage-level resume: reuse a transcript from a prior run (e.g. qa.json
      // deleted to regenerate Q&A after a prompt change) instead of re-pulling
      // audio + re-transcribing (~realtime on CPU). Delete transcript.json to
      // force a full redo.
      console.log(`${tag} "${video.title}" — reusing existing transcript.json`);
      segments = JSON.parse(readFileSync(jsonOut, "utf8")) as TranscriptSegment[];
      if (!segments.length) {
        throw new Error("existing transcript.json has zero segments — delete it to re-transcribe");
      }
    } else {
      console.log(`${tag} "${video.title}" — pulling audio...`);
      await pullAudio(video.playbackId, audioPath);
      console.log(`${tag} — transcribing (CPU, roughly realtime for long videos)...`);
      segments = transcribe(audioPath, jsonOut, txtOut);
    }

    console.log(`${tag} — cleaning via claude-sonnet-5 (${segments.length} segments)...`);
    const pairs = await generateQa(anthropic, segments);
    const records = buildQaRecords(courseId, video.videoId, pairs, segments);
    // qa.json is written last — it doubles as the resume marker, so it must
    // only exist once the whole chain succeeded.
    writeFileSync(qaPath, JSON.stringify(records, null, 1), "utf8");

    if (existsSync(audioPath)) {
      unlinkSync(audioPath); // ~30 MB intermediate; kept only on failure for debugging
    }
    const flagged = records.filter((r) => r.needsReview).length;
    console.log(`${tag} — done (${segments.length} segments -> ${records.length} Q&A pairs, ${flagged} flagged needsReview)`);
    done++;
  } catch (err) {
    failed++;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} — FAILED: ${message}`);
    logError(courseId, video.videoId, err);
  }
}

console.log(
  `\nSummary: ${done} done, ${skippedDone} skipped (qa.json exists), ` +
    `${skippedNoPlayback} skipped (no playbackId), ${failed} failed` +
    (failed || skippedNoPlayback ? ` — see output/${courseId}/_errors.log` : "")
);
// firebase-admin keeps gRPC channels open; exit explicitly.
process.exit(failed ? 1 : 0);
