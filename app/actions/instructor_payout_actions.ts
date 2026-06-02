// Instructor earnings & payout server actions.
//
// Backs three surfaces:
//   - the admin payout page  (/admin-dashboard/instructor-payouts)
//   - the instructor self-view (/user_dashboard/earnings)
//
// Model (see docs/INSTRUCTOR_PAYOUTS.md): a sale appends an immutable
// 'earning' entry to `users/{uid}/earningsLedger` and bumps the
// denormalized `earningsTotal`. An admin records out-of-band payments as
// immutable 'payout' entries, bumping `payoutsTotal`. `outstanding` is
// ALWAYS derived (earningsTotal − payoutsTotal) and never stored — there is
// deliberately no "mark as paid / zero it out" operation.
//
// All reads use the firebase-admin SDK (bypasses security rules); every
// admin function verifies admin rights server-side, the same check the
// topup-approval and package actions use.
"use server";

import { adminAuth, db } from "@/firebase/service";
import { FieldValue } from "firebase-admin/firestore";
import type { Course } from "@/types/types";
import { normalizeRevenueSharePercent } from "@/lib/earnings/split";
import { recordPayoutSchema, revenueShareSchema } from "@/lib/earnings/validation";
import { normalizeIraqiPhone } from "@/lib/validation/phone";

// ===== Result shapes =====

type Ok<T> = { success: true } & T;
type Err = { success: false; error: string; message: string };
type Result<T> = Ok<T> | Err;

function err(error: string, message: string): Err {
  return { success: false, error, message };
}

// ===== Auth gates =====

async function verifyAdmin(
  token: string
): Promise<{ ok: true; uid: string } | { ok: false }> {
  try {
    const verified = await adminAuth.verifyIdToken(token);
    const user = await adminAuth.getUser(verified.uid);
    const isAdmin =
      user.customClaims?.admin === true ||
      process.env.FIREBASE_ADMIN_EMAIL === user.email;
    return isAdmin ? { ok: true, uid: verified.uid } : { ok: false };
  } catch {
    return { ok: false };
  }
}

// ===== Helpers =====

// Firestore admin Timestamp -> ISO string, tolerating already-ISO strings
// and absent values. Server actions can't return Timestamp instances over
// the serialization boundary, so every timestamp leaves this file as a
// string or null.
function tsToIso(v: unknown): string | null {
  if (!v) return null;
  if (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { toDate?: unknown }).toDate === "function"
  ) {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return typeof v === "string" ? v : null;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// ===== View types =====

export type InstructorEarningsRow = {
  instructorId: string;
  instructorName: string;
  email: string | null;
  phone: string | null;
  revenueSharePercent: number;
  earningsTotal: number;
  payoutsTotal: number;
  outstanding: number; // derived: earningsTotal − payoutsTotal
  lastPayoutAt: string | null;
};

export type EarningsOverview = {
  rows: InstructorEarningsRow[];
  totalEarnings: number;
  totalPayouts: number;
  totalOutstanding: number;
};

export type LedgerEntryView = {
  id: string;
  kind: "earning" | "payout";
  amount: number;
  createdAt: string | null;
  createdBy: string;
  // earning-only (snapshotted at sale time)
  grossAmount?: number;
  revenueSharePercent?: number;
  instructorShareAmount?: number;
  platformShareAmount?: number;
  courseId?: string;
  enrollmentId?: string;
  sectionIds?: string[];
  source?: string;
  // payout-only
  method?: string;
  note?: string;
  settledBy?: string;
};

export type InstructorLedgerDetail = {
  instructorId: string;
  instructorName: string;
  email: string | null;
  phone: string | null;
  revenueSharePercent: number;
  earningsTotal: number;
  payoutsTotal: number;
  outstanding: number;
  entries: LedgerEntryView[];
};

// ===== Shared: read + shape one instructor's full ledger =====

async function loadLedgerEntries(
  instructorId: string
): Promise<LedgerEntryView[]> {
  const snap = await db
    .collection("users")
    .doc(instructorId)
    .collection("earningsLedger")
    .orderBy("createdAt", "asc")
    .get();

  return snap.docs.map((d) => {
    const e = d.data();
    return {
      id: d.id,
      kind: e.kind === "payout" ? "payout" : "earning",
      amount: num(e.amount),
      createdAt: tsToIso(e.createdAt),
      createdBy: typeof e.createdBy === "string" ? e.createdBy : "",
      grossAmount: typeof e.grossAmount === "number" ? e.grossAmount : undefined,
      revenueSharePercent:
        typeof e.revenueSharePercent === "number"
          ? e.revenueSharePercent
          : undefined,
      instructorShareAmount:
        typeof e.instructorShareAmount === "number"
          ? e.instructorShareAmount
          : undefined,
      platformShareAmount:
        typeof e.platformShareAmount === "number"
          ? e.platformShareAmount
          : undefined,
      courseId: typeof e.courseId === "string" ? e.courseId : undefined,
      enrollmentId:
        typeof e.enrollmentId === "string" ? e.enrollmentId : undefined,
      sectionIds: Array.isArray(e.sectionIds)
        ? (e.sectionIds as string[])
        : undefined,
      source: typeof e.source === "string" ? e.source : undefined,
      method: typeof e.method === "string" ? e.method : undefined,
      note: typeof e.note === "string" ? e.note : undefined,
      settledBy: typeof e.settledBy === "string" ? e.settledBy : undefined,
    };
  });
}

// ===== Admin: earnings overview (every instructor) =====

// An "instructor" is anyone who created a course, plus anyone who already
// has earnings recorded (covers an instructor whose courses were later
// deleted). The owed/paid/outstanding tally reads the denormalized totals
// on each user doc — the ledger remains the authoritative audit trail.
export async function getInstructorEarningsOverview(
  token: string
): Promise<Result<{ overview: EarningsOverview }>> {
  const admin = await verifyAdmin(token);
  if (!admin.ok) return err("NOT_ADMIN", "Admin access required");

  try {
    const [coursesSnap, earnersSnap] = await Promise.all([
      db.collection("courses").get(),
      db.collection("users").where("earningsTotal", ">", 0).get(),
    ]);

    // Instructor uid -> best-known display name (from courses).
    const courseNames: Record<string, string> = {};
    coursesSnap.docs.forEach((d) => {
      const c = d.data() as Course;
      if (c.createdBy) {
        courseNames[c.createdBy] = c.instructorName ?? courseNames[c.createdBy];
      }
    });

    const instructorIds = new Set<string>([
      ...Object.keys(courseNames),
      ...earnersSnap.docs.map((d) => d.id),
    ]);

    if (instructorIds.size === 0) {
      return {
        success: true,
        overview: { rows: [], totalEarnings: 0, totalPayouts: 0, totalOutstanding: 0 },
      };
    }

    const refs = [...instructorIds].map((id) =>
      db.collection("users").doc(id)
    );
    const userDocs = await db.getAll(...refs);

    let totalEarnings = 0;
    let totalPayouts = 0;
    const rows: InstructorEarningsRow[] = userDocs.map((doc) => {
      const id = doc.id;
      const data = doc.exists ? doc.data() ?? {} : {};
      const earningsTotal = num(data.earningsTotal);
      const payoutsTotal = num(data.payoutsTotal);
      totalEarnings += earningsTotal;
      totalPayouts += payoutsTotal;
      return {
        instructorId: id,
        instructorName:
          courseNames[id] ||
          (typeof data.displayName === "string" && data.displayName) ||
          (typeof data.email === "string" && data.email) ||
          id,
        email: typeof data.email === "string" ? data.email : null,
        phone: typeof data.phone === "string" && data.phone ? data.phone : null,
        revenueSharePercent: normalizeRevenueSharePercent(
          data.revenueSharePercent
        ),
        earningsTotal,
        payoutsTotal,
        outstanding: earningsTotal - payoutsTotal,
        lastPayoutAt: tsToIso(data.lastPayoutAt),
      };
    });

    // Highest outstanding first — that is what the admin needs to action.
    rows.sort((a, b) => b.outstanding - a.outstanding);

    return {
      success: true,
      overview: {
        rows,
        totalEarnings,
        totalPayouts,
        totalOutstanding: totalEarnings - totalPayouts,
      },
    };
  } catch (e) {
    console.error("getInstructorEarningsOverview error", e);
    return err("INTERNAL_ERROR", "Failed to load instructor earnings");
  }
}

// ===== Admin: one instructor's full ledger =====

export async function getInstructorLedgerDetail(
  token: string,
  instructorId: string
): Promise<Result<{ detail: InstructorLedgerDetail }>> {
  const admin = await verifyAdmin(token);
  if (!admin.ok) return err("NOT_ADMIN", "Admin access required");
  if (!instructorId || typeof instructorId !== "string") {
    return err("INVALID_INPUT", "instructorId is required");
  }

  try {
    const [userDoc, entries] = await Promise.all([
      db.collection("users").doc(instructorId).get(),
      loadLedgerEntries(instructorId),
    ]);
    const data = userDoc.exists ? userDoc.data() ?? {} : {};
    const earningsTotal = num(data.earningsTotal);
    const payoutsTotal = num(data.payoutsTotal);

    return {
      success: true,
      detail: {
        instructorId,
        instructorName:
          (typeof data.displayName === "string" && data.displayName) ||
          (typeof data.email === "string" && data.email) ||
          instructorId,
        email: typeof data.email === "string" ? data.email : null,
        phone: typeof data.phone === "string" && data.phone ? data.phone : null,
        revenueSharePercent: normalizeRevenueSharePercent(
          data.revenueSharePercent
        ),
        earningsTotal,
        payoutsTotal,
        outstanding: earningsTotal - payoutsTotal,
        entries,
      },
    };
  } catch (e) {
    console.error("getInstructorLedgerDetail error", e);
    return err("INTERNAL_ERROR", "Failed to load instructor ledger");
  }
}

// ===== Admin: record a manual payout =====

export type RecordPayoutResult = {
  payoutId: string;
  // Live numbers from inside the transaction — the authoritative re-fetch.
  outstandingBefore: number;
  amountRecorded: number;
  outstandingAfter: number;
};

// Records an out-of-band payment as an immutable 'payout' entry and bumps
// `payoutsTotal`. The transaction re-reads the instructor's totals, so the
// returned numbers reflect state at write time, not whatever the admin's
// screen showed. `outstandingAfter` may be negative — that is an
// overpayment / advance and is allowed; the UI surfaces it as a credit.
export async function recordInstructorPayout(
  token: string,
  input: unknown
): Promise<Result<RecordPayoutResult>> {
  const admin = await verifyAdmin(token);
  if (!admin.ok) return err("NOT_ADMIN", "Admin access required");

  const parsed = recordPayoutSchema.safeParse(input);
  if (!parsed.success) {
    return err("INVALID_INPUT", "بيانات الدفعة غير صحيحة");
  }
  const { instructorId, amount, method, note } = parsed.data;

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(instructorId);
      const userDoc = await transaction.get(userRef);
      const data = userDoc.exists ? userDoc.data() ?? {} : {};

      const earningsTotal = num(data.earningsTotal);
      const payoutsTotal = num(data.payoutsTotal);
      const outstandingBefore = earningsTotal - payoutsTotal;

      // Immutable payout entry — the audit trail.
      const entryRef = userRef.collection("earningsLedger").doc();
      transaction.set(entryRef, {
        kind: "payout",
        amount,
        method,
        note: note ?? null,
        settledBy: admin.uid,
        createdBy: admin.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Bump the running total only. Never write `outstanding`, never zero
      // `earningsTotal` — a payout is only ever an additive recorded event.
      transaction.set(
        userRef,
        {
          payoutsTotal: FieldValue.increment(amount),
          lastPayoutAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        payoutId: entryRef.id,
        outstandingBefore,
        amountRecorded: amount,
        outstandingAfter: outstandingBefore - amount,
      };
    });

    console.log(
      `instructor-payout recorded instructorId=${instructorId} amount=${amount} method=${method} by=${admin.uid} outstandingAfter=${result.outstandingAfter}`
    );
    return { success: true, ...result };
  } catch (e) {
    console.error("recordInstructorPayout error", e);
    return err("INTERNAL_ERROR", "فشل تسجيل الدفعة");
  }
}

// ===== Admin: edit an instructor's revenue share =====

// Changes the rate used for FUTURE sales only. Past ledger entries keep the
// `revenueSharePercent` they snapshotted, so history never moves.
export async function updateInstructorRevenueShare(
  token: string,
  input: unknown
): Promise<Result<{ instructorId: string; revenueSharePercent: number }>> {
  const admin = await verifyAdmin(token);
  if (!admin.ok) return err("NOT_ADMIN", "Admin access required");

  const parsed = revenueShareSchema.safeParse(input);
  if (!parsed.success) {
    return err("INVALID_INPUT", "نسبة غير صحيحة (0–100)");
  }
  const { instructorId, revenueSharePercent } = parsed.data;

  try {
    await db.collection("users").doc(instructorId).set(
      {
        revenueSharePercent,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(
      `instructor-revenue-share updated instructorId=${instructorId} percent=${revenueSharePercent} by=${admin.uid}`
    );
    return { success: true, instructorId, revenueSharePercent };
  } catch (e) {
    console.error("updateInstructorRevenueShare error", e);
    return err("INTERNAL_ERROR", "فشل تحديث النسبة");
  }
}

// ===== Admin: set / correct an instructor's contact phone =====

// Backfills or corrects the optional contact phone on a user doc. This is how
// an existing phone-less instructor gets a number on file. Same admin gate and
// merge-write pattern as updateInstructorRevenueShare; validation goes through
// the shared normalizer so the stored value is always the canonical "07…" form
// (or "" when the admin clears it — phone is optional).
export async function updateInstructorPhone(
  token: string,
  input: { instructorId: string; phone: string }
): Promise<Result<{ instructorId: string; phone: string }>> {
  const admin = await verifyAdmin(token);
  if (!admin.ok) return err("NOT_ADMIN", "Admin access required");

  const instructorId =
    typeof input?.instructorId === "string" ? input.instructorId : "";
  if (!instructorId) return err("INVALID_INPUT", "instructorId is required");

  const normalized = normalizeIraqiPhone(input?.phone);
  if (!normalized.ok) return err("INVALID_INPUT", normalized.error);

  try {
    await db.collection("users").doc(instructorId).set(
      {
        phone: normalized.value,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(
      `instructor-phone updated instructorId=${instructorId} by=${admin.uid}`
    );
    return { success: true, instructorId, phone: normalized.value };
  } catch (e) {
    console.error("updateInstructorPhone error", e);
    return err("INTERNAL_ERROR", "فشل تحديث رقم الهاتف");
  }
}

// ===== Instructor self-view =====

export type MyEarnings = {
  revenueSharePercent: number;
  earningsTotal: number;
  payoutsTotal: number;
  outstanding: number;
  entries: LedgerEntryView[];
};

// Any logged-in user can call this; a non-instructor simply sees all-zero
// totals and an empty ledger. Read-only.
export async function getMyEarnings(
  token: string
): Promise<Result<{ earnings: MyEarnings }>> {
  let uid: string;
  try {
    const verified = await adminAuth.verifyIdToken(token);
    uid = verified.uid;
  } catch {
    return err("AUTH_FAILED", "Authentication failed");
  }

  try {
    const [userDoc, entries] = await Promise.all([
      db.collection("users").doc(uid).get(),
      loadLedgerEntries(uid),
    ]);
    const data = userDoc.exists ? userDoc.data() ?? {} : {};
    const earningsTotal = num(data.earningsTotal);
    const payoutsTotal = num(data.payoutsTotal);

    return {
      success: true,
      earnings: {
        revenueSharePercent: normalizeRevenueSharePercent(
          data.revenueSharePercent
        ),
        earningsTotal,
        payoutsTotal,
        outstanding: earningsTotal - payoutsTotal,
        entries,
      },
    };
  } catch (e) {
    console.error("getMyEarnings error", e);
    return err("INTERNAL_ERROR", "Failed to load earnings");
  }
}
