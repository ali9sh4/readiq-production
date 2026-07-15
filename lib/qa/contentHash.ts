// Shared Q&A content-addressing + quarantine classification.
// Consumers: scripts/pipeline/import.mts (Phase 1) and the future Phase 2
// review server actions — approval MUST re-hash and re-run the tripwire via
// THIS module so the two can never drift (docs/RUBIK_STUDY_FEATURES.md §5.2).
// Spec: docs/RUBIK_STUDY_FEATURES.md §4 invariants 2-3, §5.3, §7.1; decisions
// recorded in docs/AUDIT_QA_IMPORT.md.
import { createHash } from "node:crypto";

export const CONTENT_HASH_VERSION = 1;

// NFC + whitespace-collapse + trim ONLY. Deliberately NO case folding, NO
// diacritic/tatweel stripping, NO Arabic-Indic<->ASCII digit unification:
// a false "identical" silently inherits an approval (dangerous direction);
// a false "changed" merely arrives as pending for re-review (safe direction).
export function normalizeQaText(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

// One preimage, everywhere: sha256(videoId \0 norm(question) \0 norm(answer)),
// hex. The NUL delimiter prevents video_1/video_10 prefix collisions.
export function contentHash(videoId: string, question: string, answer: string): string {
  return createHash("sha256")
    .update(
      videoId + "\0" + normalizeQaText(question) + "\0" + normalizeQaText(answer),
      "utf8"
    )
    .digest("hex");
}

// MCQ identity — E1 (docs/AUDIT_MCQ_TRANSFORM.md §2.2). Same normalization,
// same NUL-delimiter rationale as contentHash. Distractors are normalized
// then SORTED before hashing: option order is meaningless (shuffled at serve
// time), so reordering must not change identity. This module is the ONLY
// hashing site for MCQs, exactly as it is for pairs.
export function mcqContentHash(
  videoId: string,
  stem: string,
  correctAnswer: string,
  distractors: string[]
): string {
  const parts = [
    videoId,
    normalizeQaText(stem),
    normalizeQaText(correctAnswer),
    ...distractors.map(normalizeQaText).sort(),
  ];
  return createHash("sha256").update(parts.join("\0"), "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Numeric tripwire (invariant 3): any answer containing a numeral adjacent to
// a unit — or any decimal number at all — quarantines for individual
// clip-attested review with an explicit number-confirmation, even when
// needsReview is false. Validated against all 426 corpus answers on
// 2026-07-03 (54 quarantined = 12.7%; see docs/AUDIT_QA_IMPORT.md §5).
// Over-matching is acceptable by design (a shade code like "2R 2.5" costs one
// review); under-matching is the failure class. Known residuals: spelled-out
// number words (دقيقتين) and unit-less integers ("القيمة على 60").
// ---------------------------------------------------------------------------
const NUM = "[0-9٠-٩]+(?:[.,٫،][0-9٠-٩]+)?";
const UNIT =
  "(?:ملم|مليمتر|ميليمتر|مليم|مم|mm|سم|cm|متر|مل|ml|ملغ|مغ|mg|غرام|غم|كغم|كغ|kg|MPa|ميغاباسكال|باسكال|٪|%|بالمية|بالمئة|بالمائة|درجة|درجات|°|مئوية|سيليزية|مايكرون|ميكرون|ميكرومتر|مايكرومتر|micron|micrometer|µm|دقيقة|دقيقتين|دقائق|ثانية|ثواني|ساعة|ساعات|نيوتن|N)";

// Number+unit adjacency, both orders, tolerating "من" / "ال" / "الـ" fillers.
export const NUMBER_UNIT_RE = new RegExp(
  `${NUM}\\s*(?:من\\s*)?(?:ال\\s*|الـ\\s*)?${UNIT}|${UNIT}\\s*(?:ال\\s*|الـ\\s*)?${NUM}`,
  "iu"
);

// Decimals anywhere: unit-less CAD parameters where mm is implied in Exocad
// ("connector 0.2", "margin 0.08", "-0.2"). The left boundary guard rejects
// decimals embedded in identifiers ("v1.5", "2R2.5" with no space) while
// "2R 2.5" (spaced shade code) still matches — the documented accepted
// false positive.
export const DECIMAL_RE =
  /(?:^|[^0-9٠-٩A-Za-z])-?[0-9٠-٩]+[.٫][0-9٠-٩]+/u;

export function isNumericSensitive(answer: string): boolean {
  return NUMBER_UNIT_RE.test(answer) || DECIMAL_RE.test(answer);
}

// ---------------------------------------------------------------------------
// Quarantine classification (single-valued field, §7.1).
// Precedence: numeric > sentinel > flagged — numeric is the only class whose
// trigger is not otherwise stored as a first-class field on the doc AND the
// only one adding an extra approval requirement (the explicit number
// confirmation); needsReview and the 0/0/null triple stay independently
// inspectable, so numeric-first loses nothing.
// Sentinel is the FULL triple — never 0/0 alone: the corpus contains a
// legitimate pair whose citation starts at 0.0s (docs/AUDIT_QA_IMPORT.md §1).
// ---------------------------------------------------------------------------
export type Quarantine = "numeric" | "sentinel" | "flagged" | null;

export function classifyQuarantine(pair: {
  answer: string;
  needsReview: boolean;
  sourceStartSec: number;
  sourceEndSec: number;
  avgLogprob: number | null;
}): Quarantine {
  if (isNumericSensitive(pair.answer)) return "numeric";
  if (
    pair.sourceStartSec === 0 &&
    pair.sourceEndSec === 0 &&
    pair.avgLogprob === null
  ) {
    return "sentinel";
  }
  if (pair.needsReview === true) return "flagged";
  return null;
}
