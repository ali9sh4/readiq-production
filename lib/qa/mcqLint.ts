// Shared MCQ option lint — consumed by scripts/pipeline/mcq.mts
// (transform-time skip classification) and app/actions/mcq_review_actions.ts
// (edit-time validation), so the two can never drift — the same
// single-module discipline as lib/qa/contentHash.ts.
// Spec: docs/AUDIT_MCQ_TRANSFORM.md §4.3.
import { normalizeQaText } from "./contentHash";

// Meta-options are banned by design (§4.2 rule 5) — they test test-taking,
// not knowledge. Covers the common Arabic forms + the English classics.
export const META_OPTION_RE =
  /(جميع|كل|أي)\s*(ما|مما)\s*(سبق|ذكر|تقدم)|لا\s*شي?ء\s*مما\s*(سبق|ذكر)|all\s+of\s+the\s+above|none\s+of\s+the\s+above/iu;

// Any two options identical after normalization (including key ==
// distractor) make the item unanswerable or a giveaway — hard reject.
export function hasDuplicateOptions(correctAnswer: string, distractors: string[]): boolean {
  const all = [correctAnswer, ...distractors].map(normalizeQaText);
  return new Set(all).size !== all.length;
}

// Warning, never a skip: the classic longest-option-is-correct cue. Only
// fires when the KEY is the longest by a wide margin — a long distractor is
// harmless (it counters the bias).
const LENGTH_RATIO_WARN = 1.8;

export function mcqLintWarnings(correctAnswer: string, distractors: string[]): string[] {
  const normKey = normalizeQaText(correctAnswer);
  const lens = [normKey.length, ...distractors.map((d) => normalizeQaText(d).length)];
  const warnings: string[] = [];
  if (
    Math.max(...lens) === normKey.length &&
    normKey.length > LENGTH_RATIO_WARN * Math.min(...lens)
  ) {
    warnings.push("longest-option-is-correct");
  }
  return warnings;
}
