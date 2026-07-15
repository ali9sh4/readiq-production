"use server";

// Q&A review server actions — Phase 2 of docs/RUBIK_STUDY_FEATURES.md.
// The approval gate between imported `pending` pairs and any student surface.
//
// Web-only server actions (NOT /api/*): zero mobile-contract impact. Modeled
// on app/actions/sectional_config_actions.ts — token-as-argument auth, typed
// error-code union, zod at the boundary, return fresh data for local state
// (no router.refresh(), no revalidatePath: nothing student-facing reads qa
// yet, and the review tab mirrors results into client state).
//
// Invariants enforced HERE (the server is the wall — never trust the UI):
//   - Bulk approval takes NO pair ids from the client; server-side selection
//     with per-doc re-checks inside the transaction (invariant 2).
//   - classifyQuarantine is re-run at write time via lib/qa/contentHash.ts;
//     the recomputed result is authoritative, the stored field is a cache.
//   - 2026-07-14 (owner decision): the numericConfirmed requirement was
//     REMOVED — approval is one-tap. Numeric quarantine remains as
//     classification/badge only (still bars bulk, invariant 2). See the
//     dated amendments in docs/AUDIT_MCQ_TRANSFORM.md قرارات decision 4.
//   - Edited pairs (editedAt set) are permanently excluded from bulk —
//     edits invalidate attestation, so they re-enter individual review.
//   - Rejection is never deletion (invariant 5) — no delete API exists here.
//   - Approved pairs are edit-locked: revokeApproval first, which appends
//     the superseded audit record to reviewHistory (owner decision,
//     docs/AUDIT_QA_REVIEW_UI.md §4.2).
//   - stale:true pairs are unapprovable (QA_STALE) until a migrate resolves.

import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, db } from "@/firebase/service";
import {
  CONTENT_HASH_VERSION,
  classifyQuarantine,
  contentHash,
  type Quarantine,
} from "@/lib/qa/contentHash";
import {
  ApprovePairSchema,
  BulkApproveSchema,
  EditPairSchema,
  RejectPairSchema,
  RevokeApprovalSchema,
} from "@/validation/qaReview";

// ===== Result shapes =====

export type QaReviewErrorCode =
  | "AUTH_FAILED"
  | "FORBIDDEN"
  | "COURSE_NOT_FOUND"
  | "COURSE_DELETED"
  | "INVALID_INPUT"
  | "QA_NOT_FOUND"
  | "QA_NOT_PENDING"
  | "QA_APPROVED_LOCKED"
  | "QA_NOT_APPROVED"
  | "QA_STALE"
  | "QA_HASH_MISMATCH"
  | "QA_QUARANTINED"
  | "INTERNAL_ERROR";

export type QaReviewFailure = {
  success: false;
  error: QaReviewErrorCode;
  message: string;
  details?: unknown;
};

// The pair as returned to the review UI — plain JSON, §7.1 fields + doc id.
export interface QaReviewPair {
  id: string;
  question: string;
  answer: string;
  status: "pending" | "approved" | "rejected";
  courseId: string;
  videoId: string;
  sectionId: string | null;
  isFreePreviewVideo: boolean;
  sourceStartSec: number;
  sourceEndSec: number;
  sourceSegmentIds: number[];
  avgLogprob: number | null;
  noSpeechProb: number | null;
  compressionRatio: number | null;
  needsReview: boolean;
  quarantine: Quarantine;
  stale: boolean;
  editedAt: string | null;
  rejectReason: string | null;
  reviewerUid: string | null;
  reviewedAt: string | null;
  approvalMode: "bulk" | "individual" | null;
  numericConfirmed: boolean;
}

function fail(
  error: QaReviewErrorCode,
  message: string,
  details?: unknown
): QaReviewFailure {
  return { success: false, error, message, details };
}

function toPair(id: string, d: FirebaseFirestore.DocumentData): QaReviewPair {
  return {
    id,
    question: d.question,
    answer: d.answer,
    status: d.status,
    courseId: d.courseId,
    videoId: d.videoId,
    sectionId: d.sectionId ?? null,
    isFreePreviewVideo: d.isFreePreviewVideo === true,
    sourceStartSec: d.sourceStartSec,
    sourceEndSec: d.sourceEndSec,
    sourceSegmentIds: Array.isArray(d.sourceSegmentIds) ? d.sourceSegmentIds : [],
    avgLogprob: d.avgLogprob ?? null,
    noSpeechProb: d.noSpeechProb ?? null,
    compressionRatio: d.compressionRatio ?? null,
    needsReview: d.needsReview === true,
    quarantine: (d.quarantine ?? null) as Quarantine,
    stale: d.stale === true,
    editedAt: typeof d.editedAt === "string" ? d.editedAt : null,
    rejectReason: typeof d.rejectReason === "string" ? d.rejectReason : null,
    reviewerUid: typeof d.reviewerUid === "string" ? d.reviewerUid : null,
    reviewedAt: typeof d.reviewedAt === "string" ? d.reviewedAt : null,
    approvalMode: d.approvalMode === "bulk" || d.approvalMode === "individual" ? d.approvalMode : null,
    numericConfirmed: d.numericConfirmed === true,
  };
}

// ===== Shared guard =====
// verifyIdToken → course exists → not soft-deleted → owner (createdBy) or
// admin claim. Deliberately does NOT call assertCourseMutationAllowed: review
// writes never touch course.sections/purchaseMode, so the lock helper is a
// structural no-op and invoking it would imply protection it doesn't provide.

// NB: callers narrow via `"success" in ctx` — AuthContext must NEVER gain a
// `success` field or the narrowing silently inverts.
type AuthContext = { uid: string; qaCol: FirebaseFirestore.CollectionReference };

async function authorize(
  token: string,
  courseId: string
): Promise<AuthContext | QaReviewFailure> {
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
    return fail("COURSE_DELETED", "Cannot review Q&A on a deleted course");
  }
  const isOwner = course.createdBy === uid;
  if (!isOwner && !isAdmin) {
    return fail("FORBIDDEN", "Only the course owner or an admin can review Q&A");
  }
  return { uid, qaCol: courseSnap.ref.collection("qa") };
}

function classify(d: FirebaseFirestore.DocumentData): Quarantine {
  return classifyQuarantine({
    answer: d.answer,
    needsReview: d.needsReview === true,
    sourceStartSec: d.sourceStartSec,
    sourceEndSec: d.sourceEndSec,
    avgLogprob: d.avgLogprob ?? null,
  });
}

// ===== Actions =====

export async function listQaForReview(
  token: string,
  courseId: string
): Promise<{ success: true; pairs: QaReviewPair[] } | QaReviewFailure> {
  try {
    const ctx = await authorize(token, courseId);
    if ("success" in ctx) return ctx;
    // One unfiltered course-scoped fetch (≤ ~220 docs today). The §5.1
    // ordering (quarantined-first → by video → worst avgLogprob) is a
    // multi-key sort done client-side; no composite indexes.
    const snap = await ctx.qaCol.get();
    return { success: true, pairs: snap.docs.map((d) => toPair(d.id, d.data())) };
  } catch (err) {
    console.error("listQaForReview failed:", err);
    return fail("INTERNAL_ERROR", "Failed to load Q&A");
  }
}

export async function approvePair(
  token: string,
  courseId: string,
  input: { qaDocId: string }
): Promise<{ success: true; pair: QaReviewPair } | QaReviewFailure> {
  try {
    const parsed = ApprovePairSchema.safeParse(input);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", { issues: parsed.error.issues });
    }
    const ctx = await authorize(token, courseId);
    if ("success" in ctx) return ctx;

    const ref = ctx.qaCol.doc(parsed.data.qaDocId);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return fail("QA_NOT_FOUND", "Pair not found");
      const d = snap.data()!;
      if (d.status !== "pending") return fail("QA_NOT_PENDING", "Pair is not pending");
      if (d.stale === true) return fail("QA_STALE", "Stale pair — resolve via migrate first");

      // §5.2 "re-verified" hash: the text the reviewer saw is the text
      // being approved. Drift (concurrent edit) aborts.
      const h = contentHash(d.videoId, d.question, d.answer);
      if (h !== d.contentHash) {
        return fail("QA_HASH_MISMATCH", "Pair content changed during review");
      }

      // Defense-in-depth: recomputed classification is authoritative.
      const q = classify(d);
      // Citation-failure check on the RAW triple, independent of the class:
      // precedence is numeric > sentinel, so a numeric-sensitive answer can
      // MASK a citation failure — but attestation is physically impossible
      // either way (invariant 2: edit-or-reject only).
      const citationSentinel =
        d.sourceStartSec === 0 &&
        d.sourceEndSec === 0 &&
        (d.avgLogprob ?? null) === null;
      if (q === "sentinel" || citationSentinel) {
        return fail("QA_QUARANTINED", "Sentinel pair (no resolvable citation) cannot be approved");
      }
      // 2026-07-14: no numeric confirmation required — one-tap approval.

      const update = {
        status: "approved" as const,
        reviewerUid: ctx.uid,
        reviewedAt: new Date().toISOString(),
        approvalMode: "individual" as const,
        // Truthful audit value post-2026-07-14: no explicit confirmation is
        // collected anymore. Explicit boolean, never undefined.
        numericConfirmed: false,
        quarantine: q, // refresh the cache alongside the decision it fed
        contentHash: h,
        contentHashVersion: CONTENT_HASH_VERSION,
      };
      tx.update(ref, update);
      return { success: true as const, pair: toPair(snap.id, { ...d, ...update }) };
    });
    return result;
  } catch (err) {
    console.error("approvePair failed:", err);
    return fail("INTERNAL_ERROR", "Approval failed");
  }
}

export async function bulkApproveVideo(
  token: string,
  courseId: string,
  input: { videoId: string }
): Promise<
  | { success: true; approved: QaReviewPair[]; skipped: Array<{ id: string; reason: string }> }
  | QaReviewFailure
> {
  try {
    const parsed = BulkApproveSchema.safeParse(input);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", { issues: parsed.error.issues });
    }
    const ctx = await authorize(token, courseId);
    if ("success" in ctx) return ctx;

    const result = await db.runTransaction(async (tx) => {
      // Server-side selection ONLY (invariant 2): the client sends a videoId,
      // never pair ids, so a quarantined id cannot be smuggled in. The query
      // filters are an optimization; the per-doc re-checks below are the wall.
      const snap = await tx.get(
        ctx.qaCol
          .where("videoId", "==", parsed.data.videoId)
          .where("status", "==", "pending")
          .where("quarantine", "==", null)
      );
      if (snap.docs.length > 400) {
        // Transaction write ceiling guard — 32 pairs/video today; if a video
        // ever approaches this, chunk like import.mts does.
        return fail("INTERNAL_ERROR", `Too many pairs for one bulk approval (${snap.docs.length})`);
      }

      const reviewedAt = new Date().toISOString();
      const approved: QaReviewPair[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];

      for (const doc of snap.docs) {
        const d = doc.data();
        if (d.stale === true) { skipped.push({ id: doc.id, reason: "stale" }); continue; }
        if (typeof d.editedAt === "string") {
          // Edits invalidate attestation — edited pairs are permanently
          // barred from bulk and re-enter individual review.
          skipped.push({ id: doc.id, reason: "edited" });
          continue;
        }
        const h = contentHash(d.videoId, d.question, d.answer);
        if (h !== d.contentHash) { skipped.push({ id: doc.id, reason: "hash-mismatch" }); continue; }
        if (classify(d) !== null) {
          // Stored quarantine==null was a lie (cache drift) — recomputation
          // is authoritative; never bulk-approve it.
          skipped.push({ id: doc.id, reason: "quarantined-on-recheck" });
          continue;
        }
        const update = {
          status: "approved" as const,
          reviewerUid: ctx.uid,
          reviewedAt,
          approvalMode: "bulk" as const,
          numericConfirmed: false,
          contentHash: h,
          contentHashVersion: CONTENT_HASH_VERSION,
        };
        tx.update(doc.ref, update);
        approved.push(toPair(doc.id, { ...d, ...update }));
      }
      return { success: true as const, approved, skipped };
    });
    return result;
  } catch (err) {
    console.error("bulkApproveVideo failed:", err);
    return fail("INTERNAL_ERROR", "Bulk approval failed");
  }
}

export async function rejectPair(
  token: string,
  courseId: string,
  input: { qaDocId: string; rejectReason: string }
): Promise<{ success: true; pair: QaReviewPair } | QaReviewFailure> {
  try {
    const parsed = RejectPairSchema.safeParse(input);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", { issues: parsed.error.issues });
    }
    const ctx = await authorize(token, courseId);
    if ("success" in ctx) return ctx;

    const ref = ctx.qaCol.doc(parsed.data.qaDocId);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return fail("QA_NOT_FOUND", "Pair not found");
      const d = snap.data()!;
      // Allowed from pending AND approved (safety recall — owner decision).
      if (d.status !== "pending" && d.status !== "approved") {
        return fail("QA_NOT_PENDING", "Pair is already rejected");
      }

      const now = new Date().toISOString();
      const update: Record<string, unknown> = {
        status: "rejected",
        rejectReason: parsed.data.rejectReason,
        reviewerUid: ctx.uid,
        reviewedAt: now,
      };
      if (d.status === "approved") {
        // Recalling an approval preserves the superseded audit record.
        update.reviewHistory = FieldValue.arrayUnion({
          action: "approval-recalled",
          reviewerUid: d.reviewerUid ?? null,
          reviewedAt: d.reviewedAt ?? null,
          approvalMode: d.approvalMode ?? null,
          numericConfirmed: d.numericConfirmed === true,
          contentHash: d.contentHash ?? null,
          supersededAt: now,
          supersededBy: ctx.uid,
        });
        update.approvalMode = null;
        update.numericConfirmed = false;
      }
      tx.update(ref, update);
      return {
        success: true as const,
        pair: toPair(snap.id, { ...d, ...update, reviewHistory: undefined }),
      };
    });
    return result;
  } catch (err) {
    console.error("rejectPair failed:", err);
    return fail("INTERNAL_ERROR", "Rejection failed");
  }
}

export async function editPair(
  token: string,
  courseId: string,
  input: { qaDocId: string; question: string; answer: string }
): Promise<{ success: true; pair: QaReviewPair } | QaReviewFailure> {
  try {
    const parsed = EditPairSchema.safeParse(input);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", { issues: parsed.error.issues });
    }
    const ctx = await authorize(token, courseId);
    if ("success" in ctx) return ctx;

    const ref = ctx.qaCol.doc(parsed.data.qaDocId);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return fail("QA_NOT_FOUND", "Pair not found");
      const d = snap.data()!;
      if (d.status === "approved") {
        // Owner decision: approved pairs are edit-locked; revokeApproval
        // first (which preserves the audit record in reviewHistory).
        return fail("QA_APPROVED_LOCKED", "Revoke approval before editing");
      }

      const question = parsed.data.question;
      const answer = parsed.data.answer;
      const newHash = contentHash(d.videoId, question, answer);
      const q = classifyQuarantine({
        answer,
        needsReview: d.needsReview === true,
        sourceStartSec: d.sourceStartSec,
        sourceEndSec: d.sourceEndSec,
        avgLogprob: d.avgLogprob ?? null,
      });
      const now = new Date().toISOString();

      const update: Record<string, unknown> = {
        question,
        answer,
        contentHash: newHash,
        contentHashVersion: CONTENT_HASH_VERSION,
        quarantine: q,
        editedAt: now,
        editedBy: ctx.uid,
        numericConfirmed: false,
        // Editing a rejected pair resurrects it into the review queue.
        status: "pending",
      };
      // §5.3 firewall identity: freeze the disk-corpus hash the first time
      // this doc's text diverges from its import (lazy backfill — the one-off
      // backfill script sets this for all pre-edit docs, this is the belt).
      if (typeof d.importContentHash !== "string") {
        update.importContentHash = d.contentHash;
      }
      if (d.status === "rejected") {
        update.reviewHistory = FieldValue.arrayUnion({
          action: "rejection-superseded-by-edit",
          reviewerUid: d.reviewerUid ?? null,
          reviewedAt: d.reviewedAt ?? null,
          rejectReason: d.rejectReason ?? null,
          supersededAt: now,
          supersededBy: ctx.uid,
        });
        // Clear the superseded rejection's attribution from the live doc —
        // the history entry above is its home now (mirrors revokeApproval).
        update.rejectReason = null;
        update.reviewerUid = null;
        update.reviewedAt = null;
      }
      tx.update(ref, update);
      return {
        success: true as const,
        pair: toPair(snap.id, { ...d, ...update, reviewHistory: undefined }),
      };
    });
    return result;
  } catch (err) {
    console.error("editPair failed:", err);
    return fail("INTERNAL_ERROR", "Edit failed");
  }
}

export async function revokeApproval(
  token: string,
  courseId: string,
  input: { qaDocId: string }
): Promise<{ success: true; pair: QaReviewPair } | QaReviewFailure> {
  try {
    const parsed = RevokeApprovalSchema.safeParse(input);
    if (!parsed.success) {
      return fail("INVALID_INPUT", "Invalid input", { issues: parsed.error.issues });
    }
    const ctx = await authorize(token, courseId);
    if ("success" in ctx) return ctx;

    const ref = ctx.qaCol.doc(parsed.data.qaDocId);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return fail("QA_NOT_FOUND", "Pair not found");
      const d = snap.data()!;
      if (d.status !== "approved") return fail("QA_NOT_APPROVED", "Pair is not approved");

      const now = new Date().toISOString();
      const update: Record<string, unknown> = {
        status: "pending",
        reviewHistory: FieldValue.arrayUnion({
          action: "approval-revoked",
          reviewerUid: d.reviewerUid ?? null,
          reviewedAt: d.reviewedAt ?? null,
          approvalMode: d.approvalMode ?? null,
          numericConfirmed: d.numericConfirmed === true,
          contentHash: d.contentHash ?? null,
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
        pair: toPair(snap.id, { ...d, ...update, reviewHistory: undefined }),
      };
    });
    return result;
  } catch (err) {
    console.error("revokeApproval failed:", err);
    return fail("INTERNAL_ERROR", "Revoke failed");
  }
}
