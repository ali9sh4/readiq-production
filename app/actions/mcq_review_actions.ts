"use server";

// MCQ review server actions — E1 step 4 of docs/AUDIT_MCQ_TRANSFORM.md.
// The approval gate between imported `pending` mcqItems and the future exam
// runtime. Modeled on app/actions/qa_review_actions.ts (which is deliberately
// NOT modified — this file duplicates the small authorize guard instead of
// extracting it from a settled, adversarially-reviewed file).
//
// Web-only server actions (NOT /api/*): zero mobile-contract impact.
//
// Invariants enforced HERE (the server is the wall — never trust the UI):
//   - NO bulk action exists in this file, structurally (قرارات المالك
//     decision 2: individual-only MCQ review in v1). Do not add one without
//     reopening that decision.
//   - The correct answer is NEVER editable (finding §3): EditMcqSchema has
//     no correctAnswer field and editMcq never writes it. Fixing a wrong key
//     = fix the source pair, re-run the transform.
//   - approveMcq re-verifies mcqContentHash via lib/qa/contentHash.ts,
//     re-checks the SOURCE pair in the same transaction (approved, not
//     stale, contentHash === sourceContentHash, answer still verbatim-equal
//     — finding §2.3c), and recomputes the numeric class as a
//     classification/badge. 2026-07-14 (owner decision): the explicit
//     numericConfirmed requirement was REMOVED — approval is one-tap; only
//     the integrity re-checks above gate it. See the dated amendment on
//     قرارات decision 4 in docs/AUDIT_MCQ_TRANSFORM.md.
//   - Rejection is never deletion; approved items are edit-locked behind
//     revokeMcqApproval with a reviewHistory audit append (§5.2b grammar).
//   - stale items are unapprovable (MCQ_STALE) — a re-import stale-marks
//     items whose source pair diverged.

import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, db } from "@/firebase/service";
import {
  CONTENT_HASH_VERSION,
  isNumericSensitive,
  mcqContentHash,
  normalizeQaText,
} from "@/lib/qa/contentHash";
import { META_OPTION_RE, hasDuplicateOptions, mcqLintWarnings } from "@/lib/qa/mcqLint";
import {
  ApproveMcqSchema,
  EditMcqSchema,
  RejectMcqSchema,
  RevokeMcqApprovalSchema,
} from "@/validation/mcqReview";

// ===== Result shapes =====

export type McqReviewErrorCode =
  | "AUTH_FAILED"
  | "FORBIDDEN"
  | "COURSE_NOT_FOUND"
  | "COURSE_DELETED"
  | "INVALID_INPUT"
  | "MCQ_NOT_FOUND"
  | "MCQ_NOT_PENDING"
  | "MCQ_APPROVED_LOCKED"
  | "MCQ_NOT_APPROVED"
  | "MCQ_STALE"
  | "MCQ_HASH_MISMATCH"
  | "MCQ_SOURCE_DIVERGED"
  | "INTERNAL_ERROR";

export type McqReviewFailure = {
  success: false;
  error: McqReviewErrorCode;
  message: string;
  details?: unknown;
};

// The MCQ as returned to the review UI — §2.2 fields + doc id + the joined
// source-pair panel (so the reviewer verifies faithfulness in place).
export interface McqReviewItem {
  id: string;
  stem: string;
  correctAnswer: string;
  distractors: string[];
  status: "pending" | "approved" | "rejected";
  courseId: string;
  videoId: string;
  sectionId: string | null;
  sourceStartSec: number;
  sourceEndSec: number;
  quarantine: "numeric" | null;
  stale: boolean;
  editedAt: string | null;
  rejectReason: string | null;
  reviewerUid: string | null;
  reviewedAt: string | null;
  approvalMode: "individual" | null;
  numericConfirmed: boolean;
  lintWarnings: string[];
  sourceQaDocId: string;
  // Joined server-side for the review panel; null when the pair is gone.
  sourcePair: { question: string; answer: string; status: string; stale: boolean } | null;
  // True when the source pair no longer backs this item (missing, not
  // approved, stale, or text diverged) — approve will fail server-side; the
  // UI disables it up front.
  sourceDiverged: boolean;
}

function fail(
  error: McqReviewErrorCode,
  message: string,
  details?: unknown
): McqReviewFailure {
  return { success: false, error, message, details };
}

function toItem(
  id: string,
  d: FirebaseFirestore.DocumentData,
  sourcePair: McqReviewItem["sourcePair"],
  sourceDiverged: boolean
): McqReviewItem {
  return {
    id,
    stem: d.stem,
    correctAnswer: d.correctAnswer,
    distractors: Array.isArray(d.distractors) ? d.distractors : [],
    status: d.status,
    courseId: d.courseId,
    videoId: d.videoId,
    sectionId: d.sectionId ?? null,
    sourceStartSec: typeof d.sourceStartSec === "number" ? d.sourceStartSec : 0,
    sourceEndSec: typeof d.sourceEndSec === "number" ? d.sourceEndSec : 0,
    quarantine: d.quarantine === "numeric" ? "numeric" : null,
    stale: d.stale === true,
    editedAt: typeof d.editedAt === "string" ? d.editedAt : null,
    rejectReason: typeof d.rejectReason === "string" ? d.rejectReason : null,
    reviewerUid: typeof d.reviewerUid === "string" ? d.reviewerUid : null,
    reviewedAt: typeof d.reviewedAt === "string" ? d.reviewedAt : null,
    approvalMode: d.approvalMode === "individual" ? "individual" : null,
    numericConfirmed: d.numericConfirmed === true,
    lintWarnings: Array.isArray(d.lintWarnings) ? d.lintWarnings : [],
    sourceQaDocId: d.sourceQaDocId,
    sourcePair,
    sourceDiverged,
  };
}

// Divergence predicate — one definition used by list (badge) and approve
// (transaction wall). Finding §2.3: status/stale/hash, plus the verbatim
// re-check against the live pair text.
function sourceDiverged(
  mcq: FirebaseFirestore.DocumentData,
  pair: FirebaseFirestore.DocumentData | null
): boolean {
  return (
    !pair ||
    pair.status !== "approved" ||
    pair.stale === true ||
    pair.contentHash !== mcq.sourceContentHash ||
    normalizeQaText(pair.answer) !== normalizeQaText(mcq.correctAnswer)
  );
}

// ===== Shared guard (qa_review_actions.ts pattern, duplicated by design) =====
// NB: callers narrow via `"success" in ctx` — AuthContext must NEVER gain a
// `success` field or the narrowing silently inverts.
type AuthContext = {
  uid: string;
  mcqCol: FirebaseFirestore.CollectionReference;
  qaCol: FirebaseFirestore.CollectionReference;
};

async function authorize(
  token: string,
  courseId: string
): Promise<AuthContext | McqReviewFailure> {
  let uid: string;
  let isAdmin: boolean;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
    isAdmin = decoded.admin === true;
  } catch {
    return fail("AUTH_FAILED", "Authentication failed");
  }
  if (!courseId) return fail("COURSE_NOT_FOUND", "Missing courseId");

  const courseSnap = await db.collection("courses").doc(courseId).get();
  if (!courseSnap.exists) return fail("COURSE_NOT_FOUND", "Course not found");
  const course = courseSnap.data() ?? {};
  if (course.isDeleted === true) {
    return fail("COURSE_DELETED", "Cannot review MCQs on a deleted course");
  }
  const isOwner = course.createdBy === uid;
  if (!isOwner && !isAdmin) {
    return fail("FORBIDDEN", "Only the course owner or an admin can review MCQs");
  }
  return {
    uid,
    mcqCol: courseSnap.ref.collection("mcqItems"),
    qaCol: courseSnap.ref.collection("qa"),
  };
}

// ===== Actions =====

export async function listMcqForReview(
  token: string,
  courseId: string
): Promise<{ success: true; items: McqReviewItem[] } | McqReviewFailure> {
  try {
    const ctx = await authorize(token, courseId);
    if ("success" in ctx) return ctx;

    // One unfiltered course-scoped fetch (≤ ~100 docs today), like
    // listQaForReview; ordering is client-side.
    const snap = await ctx.mcqCol.get();
    if (snap.empty) return { success: true, items: [] };

    // Join the source pairs (distinct ids, one getAll) for the faithfulness
    // panel + the divergence badge.
    const sourceIds = [...new Set(snap.docs.map((d) => d.data().sourceQaDocId as string))].filter(
      (s) => typeof s === "string" && s.length > 0
    );
    const pairSnaps = sourceIds.length
      ? await db.getAll(...sourceIds.map((id) => ctx.qaCol.doc(id)))
      : [];
    const pairById = new Map(pairSnaps.map((s) => [s.id, s.exists ? s.data()! : null]));

    const items = snap.docs.map((doc) => {
      const d = doc.data();
      const pair = pairById.get(d.sourceQaDocId) ?? null;
      const panel = pair
        ? {
            question: String(pair.question ?? ""),
            answer: String(pair.answer ?? ""),
            status: String(pair.status ?? "unknown"),
            stale: pair.stale === true,
          }
        : null;
      return toItem(doc.id, d, panel, sourceDiverged(d, pair));
    });
    return { success: true, items };
  } catch (err) {
    console.error("listMcqForReview failed:", err);
    return fail("INTERNAL_ERROR", "Failed to load MCQs");
  }
}

export async function approveMcq(
  token: string,
  courseId: string,
  input: { mcqDocId: string }
): Promise<{ success: true; item: McqReviewItem } | McqReviewFailure> {
  try {
    const parsed = ApproveMcqSchema.safeParse(input);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", { issues: parsed.error.issues });
    }
    const ctx = await authorize(token, courseId);
    if ("success" in ctx) return ctx;

    const ref = ctx.mcqCol.doc(parsed.data.mcqDocId);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return fail("MCQ_NOT_FOUND", "MCQ not found");
      const d = snap.data()!;
      if (d.status !== "pending") return fail("MCQ_NOT_PENDING", "MCQ is not pending");
      if (d.stale === true) return fail("MCQ_STALE", "Stale MCQ — re-run the transform first");

      // The options the reviewer saw are the options being approved —
      // recomputed hash must match the stored one (drift aborts).
      const distractors: string[] = Array.isArray(d.distractors) ? d.distractors : [];
      const h = mcqContentHash(d.videoId, d.stem, d.correctAnswer, distractors);
      if (h !== d.mcqContentHash) {
        return fail("MCQ_HASH_MISMATCH", "MCQ content changed during review");
      }

      // Source-pair re-check INSIDE the transaction (finding §2.3c): the key
      // is only as approved as the pair that backs it, right now.
      const pairSnap = await tx.get(ctx.qaCol.doc(String(d.sourceQaDocId)));
      const pair = pairSnap.exists ? pairSnap.data()! : null;
      if (sourceDiverged(d, pair)) {
        return fail(
          "MCQ_SOURCE_DIVERGED",
          "Source pair no longer backs this MCQ — re-run the transform"
        );
      }

      // Recomputed numeric class is authoritative; stored field is a cache.
      // 2026-07-14: classification/badge only — no confirmation required.
      const q = isNumericSensitive(d.correctAnswer) ? ("numeric" as const) : null;

      const update = {
        status: "approved" as const,
        reviewerUid: ctx.uid,
        reviewedAt: new Date().toISOString(),
        approvalMode: "individual" as const, // the only mode that exists (decision 2)
        // Truthful audit value post-2026-07-14: no confirmation collected.
        numericConfirmed: false,
        quarantine: q,
        mcqContentHash: h,
        contentHashVersion: CONTENT_HASH_VERSION,
      };
      tx.update(ref, update);
      const merged = { ...d, ...update };
      return {
        success: true as const,
        item: toItem(snap.id, merged, {
          question: String(pair!.question ?? ""),
          answer: String(pair!.answer ?? ""),
          status: String(pair!.status ?? "unknown"),
          stale: pair!.stale === true,
        }, false),
      };
    });
    return result;
  } catch (err) {
    console.error("approveMcq failed:", err);
    return fail("INTERNAL_ERROR", "Approval failed");
  }
}

export async function rejectMcq(
  token: string,
  courseId: string,
  input: { mcqDocId: string; rejectReason: string }
): Promise<{ success: true; item: McqReviewItem } | McqReviewFailure> {
  try {
    const parsed = RejectMcqSchema.safeParse(input);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", { issues: parsed.error.issues });
    }
    const ctx = await authorize(token, courseId);
    if ("success" in ctx) return ctx;

    const ref = ctx.mcqCol.doc(parsed.data.mcqDocId);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return fail("MCQ_NOT_FOUND", "MCQ not found");
      const d = snap.data()!;
      // Allowed from pending AND approved (safety recall, §5.2b grammar).
      if (d.status !== "pending" && d.status !== "approved") {
        return fail("MCQ_NOT_PENDING", "MCQ is already rejected");
      }

      const now = new Date().toISOString();
      const update: Record<string, unknown> = {
        status: "rejected",
        rejectReason: parsed.data.rejectReason,
        reviewerUid: ctx.uid,
        reviewedAt: now,
      };
      if (d.status === "approved") {
        update.reviewHistory = FieldValue.arrayUnion({
          action: "approval-recalled",
          reviewerUid: d.reviewerUid ?? null,
          reviewedAt: d.reviewedAt ?? null,
          approvalMode: d.approvalMode ?? null,
          numericConfirmed: d.numericConfirmed === true,
          mcqContentHash: d.mcqContentHash ?? null,
          supersededAt: now,
          supersededBy: ctx.uid,
        });
        update.approvalMode = null;
        update.numericConfirmed = false;
      }
      tx.update(ref, update);
      return {
        success: true as const,
        item: toItem(snap.id, { ...d, ...update, reviewHistory: undefined }, null, false),
      };
    });
    return result;
  } catch (err) {
    console.error("rejectMcq failed:", err);
    return fail("INTERNAL_ERROR", "Rejection failed");
  }
}

export async function editMcq(
  token: string,
  courseId: string,
  input: { mcqDocId: string; stem: string; distractors: string[] }
): Promise<{ success: true; item: McqReviewItem } | McqReviewFailure> {
  try {
    const parsed = EditMcqSchema.safeParse(input);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", { issues: parsed.error.issues });
    }
    const ctx = await authorize(token, courseId);
    if ("success" in ctx) return ctx;

    const ref = ctx.mcqCol.doc(parsed.data.mcqDocId);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return fail("MCQ_NOT_FOUND", "MCQ not found");
      const d = snap.data()!;
      if (d.status === "approved") {
        // Approved items are edit-locked; revokeMcqApproval first.
        return fail("MCQ_APPROVED_LOCKED", "Revoke approval before editing");
      }

      const stem = parsed.data.stem;
      const distractors = parsed.data.distractors;
      // The KEY is deliberately not an input — d.correctAnswer is reused
      // untouched. Shared lint (same module as the transform, §4.3):
      if (hasDuplicateOptions(d.correctAnswer, distractors)) {
        return fail("INVALID_INPUT", "Invalid input", {
          issues: [{ message: "خياران متطابقان — البدائل يجب أن تختلف عن بعضها وعن الإجابة الصحيحة" }],
        });
      }
      if (distractors.some((x) => META_OPTION_RE.test(x))) {
        return fail("INVALID_INPUT", "Invalid input", {
          issues: [{ message: "خيارات من نوع (جميع ما سبق / لا شيء مما سبق) غير مسموحة" }],
        });
      }

      const now = new Date().toISOString();
      const update: Record<string, unknown> = {
        stem,
        distractors,
        mcqContentHash: mcqContentHash(d.videoId, stem, d.correctAnswer, distractors),
        contentHashVersion: CONTENT_HASH_VERSION,
        lintWarnings: mcqLintWarnings(d.correctAnswer, distractors),
        editedAt: now,
        editedBy: ctx.uid,
        numericConfirmed: false,
        // Editing a rejected item resurrects it into the review queue.
        status: "pending",
      };
      if (d.status === "rejected") {
        update.reviewHistory = FieldValue.arrayUnion({
          action: "rejection-superseded-by-edit",
          reviewerUid: d.reviewerUid ?? null,
          reviewedAt: d.reviewedAt ?? null,
          rejectReason: d.rejectReason ?? null,
          supersededAt: now,
          supersededBy: ctx.uid,
        });
        update.rejectReason = null;
        update.reviewerUid = null;
        update.reviewedAt = null;
      }
      tx.update(ref, update);
      return {
        success: true as const,
        item: toItem(snap.id, { ...d, ...update, reviewHistory: undefined }, null, false),
      };
    });
    return result;
  } catch (err) {
    console.error("editMcq failed:", err);
    return fail("INTERNAL_ERROR", "Edit failed");
  }
}

export async function revokeMcqApproval(
  token: string,
  courseId: string,
  input: { mcqDocId: string }
): Promise<{ success: true; item: McqReviewItem } | McqReviewFailure> {
  try {
    const parsed = RevokeMcqApprovalSchema.safeParse(input);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", { issues: parsed.error.issues });
    }
    const ctx = await authorize(token, courseId);
    if ("success" in ctx) return ctx;

    const ref = ctx.mcqCol.doc(parsed.data.mcqDocId);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return fail("MCQ_NOT_FOUND", "MCQ not found");
      const d = snap.data()!;
      if (d.status !== "approved") return fail("MCQ_NOT_APPROVED", "MCQ is not approved");

      const now = new Date().toISOString();
      const update: Record<string, unknown> = {
        status: "pending",
        reviewHistory: FieldValue.arrayUnion({
          action: "approval-revoked",
          reviewerUid: d.reviewerUid ?? null,
          reviewedAt: d.reviewedAt ?? null,
          approvalMode: d.approvalMode ?? null,
          numericConfirmed: d.numericConfirmed === true,
          mcqContentHash: d.mcqContentHash ?? null,
          supersededAt: now,
          supersededBy: ctx.uid,
        }),
        reviewerUid: null,
        reviewedAt: null,
        approvalMode: null,
        numericConfirmed: false,
      };
      tx.update(ref, update);
      return {
        success: true as const,
        item: toItem(snap.id, { ...d, ...update, reviewHistory: undefined }, null, false),
      };
    });
    return result;
  } catch (err) {
    console.error("revokeMcqApproval failed:", err);
    return fail("INTERNAL_ERROR", "Revoke failed");
  }
}
