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

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { adminAuth, db } from "@/firebase/service";
import { evaluateVideoAccess } from "@/lib/courses/videoAccess";
import {
  ListStudyDeckSchema,
  LogStudyEventSchema,
} from "@/validation/qaStudy";

export type QaStudyErrorCode =
  | "AUTH_FAILED"
  | "INVALID_INPUT"
  | "COURSE_NOT_FOUND"
  | "VIDEO_NOT_FOUND"
  | "VIDEO_NOT_READY"
  | "NOT_ENROLLED"
  | "ACCESS_EXPIRED"
  | "SECTION_NOT_OWNED"
  | "RATE_LIMITED"
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

// ===== Study event log (slice 6) =====
//
// Append-only telemetry to the TOP-LEVEL `study_events` collection
// (snake_case like wallet_transactions) — deliberately the only analytics
// substrate (non-goal 7: Vercel logs retain 1 h). NEVER the qa
// subcollection: students keep zero write access to pair docs.
//
// Keying (owner decision 2026-07-04): `qaDocId` — the Firestore doc ID,
// the canonical stable pair identity that survives re-imports via
// contentHash dedupe — is the primary key; `videoId` is a secondary field
// only (positional ids renumber on re-upload and would corrupt the
// permanent log).
//
// Trust model: `uid` comes from the verified token and `at` is
// server-stamped — a client can forge neither identity nor time. There is
// deliberately NO per-event access-gate read (2–3 Firestore reads per
// reveal/grade would triple the cost of pure telemetry): a hostile
// authenticated user can at worst write noise, which (a) is bounded by the
// per-user rate limit below and (b) falls out of Phase 7 aggregation,
// which joins qaDocId against the qa collection where fabricated ids
// don't resolve.

const eventRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  analytics: true,
  prefix: "study_event",
});

export type QaStudyEventKind = "revealed" | "selfGrade" | "jumpToSource";

export async function logStudyEvent(
  token: string,
  input: {
    courseId: string;
    videoId: string;
    qaDocId: string;
    kind: QaStudyEventKind;
    grade?: "yes" | "no";
    elapsedMs?: number;
  }
): Promise<{ success: true } | QaStudyFailure> {
  try {
    const parsed = LogStudyEventSchema.safeParse(input);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", {
        issues: parsed.error.issues,
      });
    }

    let uid: string;
    try {
      uid = (await adminAuth.verifyIdToken(token)).uid;
    } catch {
      return fail("AUTH_FAILED", "Authentication failed");
    }

    // Abuse bound, not a gate. Fail OPEN on Redis errors (same posture as
    // the playback-token route): dropping or admitting one telemetry write
    // is equally harmless, and the established pattern is open.
    try {
      const { success: rateLimitOk } = await eventRatelimit.limit(uid);
      if (!rateLimitOk) {
        return fail("RATE_LIMITED", "Too many study events");
      }
    } catch (rlErr) {
      console.error(
        `study-event rate-limit check failed (failing open) userId=${uid}:`,
        rlErr
      );
    }

    const { courseId, videoId, qaDocId, kind, grade, elapsedMs } = parsed.data;
    // firebase/service.ts does not set ignoreUndefinedProperties — spread
    // optional fields only when present.
    await db.collection("study_events").add({
      uid,
      courseId,
      videoId,
      qaDocId,
      kind,
      ...(grade !== undefined ? { grade } : {}),
      ...(elapsedMs !== undefined ? { elapsedMs } : {}),
      at: new Date().toISOString(),
    });
    return { success: true };
  } catch (err) {
    console.error("logStudyEvent failed:", err);
    return fail("INTERNAL_ERROR", "Failed to log study event");
  }
}
