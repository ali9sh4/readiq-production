"use server";

// Student study-deck server action — Phase 3 slice 4 of
// docs/RUBIK_STUDY_FEATURES.md (build plan: docs/AUDIT_STUDY_DECK.md §3/§7).
//
// Web-only server action (NOT /api/*): zero mobile-contract impact. Modeled
// on app/actions/qa_review_actions.ts — token-as-argument auth, typed
// error-code union, zod at the boundary — but with the STUDENT gate, not the
// owner gate: access is the §8.1 shared predicate via evaluateVideoAccess
// with allowFreePreview: false (owner decision 2026-07-04: the deck is
// enrolled-only; free preview plays the video but never opens the deck —
// enrolled students still pass on free-preview lessons they own, because
// the check falls through to the enrollment branch).
//
// Invariants enforced HERE:
//   - Students read approved pairs ONLY: status == "approved" AND
//     stale == false (a migrate can mark an approved pair stale; invariant 1
//     says students must never see it). Same triple predicate as the
//     practice-tab counts (lib/qa/approvedCounts.ts).
//   - Minimal DTO. Nothing beyond
//     { qaId, question, answer, sourceStartSec, sourceEndSec, videoId,
//       hasValidClip } ships to the client — no transcript text, no
//     confidence scores, no needsReview, no quarantine class, no reviewer
//     metadata, no hashes.
//   - hasValidClip is computed SERVER-side (§8.2): false for needsReview
//     pairs, the 0/0/null citation sentinel, and >5-minute spans — so the
//     client cannot render a jump affordance to a bad timestamp even if it
//     wanted to.

import { adminAuth, db } from "@/firebase/service";
import { evaluateVideoAccess } from "@/lib/courses/videoAccess";
import { ListStudyDeckSchema } from "@/validation/qaStudy";

export type QaStudyErrorCode =
  | "AUTH_FAILED"
  | "INVALID_INPUT"
  | "COURSE_NOT_FOUND"
  | "VIDEO_NOT_FOUND"
  | "VIDEO_NOT_READY"
  | "NOT_ENROLLED"
  | "SECTION_NOT_OWNED"
  | "INTERNAL_ERROR";

export type QaStudyFailure = {
  success: false;
  error: QaStudyErrorCode;
  message: string;
  details?: unknown;
};

// One flashcard as the deck consumes it. `qaId` is the Firestore doc ID —
// the canonical stable pair identity (§7.1): React key today, the
// progress/SRS/event key in later phases.
export interface QaStudyCard {
  qaId: string;
  question: string;
  answer: string;
  sourceStartSec: number;
  sourceEndSec: number;
  videoId: string;
  hasValidClip: boolean;
}

function fail(
  error: QaStudyErrorCode,
  message: string,
  details?: unknown
): QaStudyFailure {
  return { success: false, error, message, details };
}

// §8.2 jump-affordance rule. The >5-min suppression matches the review
// tab's WIDE_SPAN_SEC — min/max span inflation across far-apart citations
// makes a single seek target meaningless.
const WIDE_SPAN_SEC = 300;

function computeHasValidClip(d: FirebaseFirestore.DocumentData): boolean {
  const start = typeof d.sourceStartSec === "number" ? d.sourceStartSec : 0;
  const end = typeof d.sourceEndSec === "number" ? d.sourceEndSec : 0;
  const citationSentinel =
    start === 0 && end === 0 && (d.avgLogprob ?? null) === null;
  return (
    d.needsReview !== true && !citationSentinel && end - start <= WIDE_SPAN_SEC
  );
}

export async function listApprovedQaForStudy(
  token: string,
  input: { courseId: string; videoId: string }
): Promise<{ success: true; cards: QaStudyCard[] } | QaStudyFailure> {
  try {
    const parsed = ListStudyDeckSchema.safeParse(input);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", {
        issues: parsed.error.issues,
      });
    }
    const { courseId, videoId } = parsed.data;

    let uid: string;
    let isAdmin: boolean;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
      isAdmin = decoded.admin === true;
    } catch {
      return fail("AUTH_FAILED", "Authentication failed");
    }

    const access = await evaluateVideoAccess({
      userId: uid,
      isAdmin,
      courseId,
      videoId,
      allowFreePreview: false, // enrolled-only (§13 q1, decided 2026-07-04)
    });
    if (!access.allowed) {
      return fail(access.code, access.message);
    }

    const snap = await db
      .collection("courses")
      .doc(courseId)
      .collection("qa")
      .where("videoId", "==", videoId)
      .where("status", "==", "approved")
      .where("stale", "==", false)
      .get();

    const cards: QaStudyCard[] = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          qaId: doc.id,
          question: typeof d.question === "string" ? d.question : "",
          answer: typeof d.answer === "string" ? d.answer : "",
          sourceStartSec:
            typeof d.sourceStartSec === "number" ? d.sourceStartSec : 0,
          sourceEndSec:
            typeof d.sourceEndSec === "number" ? d.sourceEndSec : 0,
          videoId,
          hasValidClip: computeHasValidClip(d),
        };
      })
      // Lecture order (§3 of the audit) — same ordering the review tab uses.
      .sort((a, b) => a.sourceStartSec - b.sourceStartSec);

    return { success: true, cards };
  } catch (err) {
    console.error("listApprovedQaForStudy failed:", err);
    return fail("INTERNAL_ERROR", "Failed to load the study deck");
  }
}
