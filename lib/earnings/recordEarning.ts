// Atomic earning-ledger write, shared by every sale path.
//
// On a sale the platform owes the instructor a real-world cash payable —
// NOT spendable platform credit. So instead of crediting the instructor's
// spend wallet (`wallets/{uid}`), each sale path calls this helper inside
// its existing purchase transaction. It:
//   1. snapshots the instructor's revenue split at sale time,
//   2. appends an immutable 'earning' entry to
//      `users/{uid}/earningsLedger`, and
//   3. increments the denormalized `earningsTotal` on the user doc.
//
// All three happen inside the caller's transaction, so the earning is
// atomic with the enrollment write and the buyer's wallet debit.
//
// Firestore requires every read before any write in a transaction. The
// caller MUST therefore `transaction.get(users/{instructorId})` itself and
// pass the resulting snapshot in as `instructorDocSnap` — this helper only
// writes.
//
// See docs/INSTRUCTOR_PAYOUTS.md.

import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/firebase/service";
import { computeRevenueSplit, type RevenueSplit } from "./split";

export type RecordEarningArgs = {
  transaction: FirebaseFirestore.Transaction;
  instructorId: string;
  // Snapshot of `users/{instructorId}` read INSIDE the same transaction.
  instructorDocSnap: FirebaseFirestore.DocumentSnapshot;
  // The gross sale amount in IQD — the full money the buyer paid for this
  // transaction (course price / section total / bundle charge).
  grossAmount: number;
  courseId: string;
  enrollmentId: string;
  // uid of the buyer — recorded as the entry's `createdBy`.
  buyerId: string;
  // Present only for per-section purchases; one earning entry covers the
  // whole purchase event even when it spans several sections.
  sectionIds?: string[];
  source: "wallet" | "zaincash";
};

// Writes the earning entry + total increment. Returns the snapshotted split
// (handy for logging), or `null` when there was nothing to record — a free
// or zero-charge sale owes the instructor nothing.
export function recordEarningInTransaction(
  args: RecordEarningArgs
): RevenueSplit | null {
  const {
    transaction,
    instructorId,
    instructorDocSnap,
    grossAmount,
    courseId,
    enrollmentId,
    buyerId,
    sectionIds,
    source,
  } = args;

  if (!(grossAmount > 0)) return null;

  const rawPct = instructorDocSnap.exists
    ? instructorDocSnap.get("revenueSharePercent")
    : undefined;
  const split = computeRevenueSplit(grossAmount, rawPct);

  const instructorRef = db.collection("users").doc(instructorId);
  const entryRef = instructorRef.collection("earningsLedger").doc();

  const entry: Record<string, unknown> = {
    kind: "earning",
    // `amount` is always the instructor's share — the same convention the
    // payout entries use, so a ledger reader never has to special-case kind.
    amount: split.instructorShareAmount,
    grossAmount: split.grossAmount,
    revenueSharePercent: split.revenueSharePercent,
    instructorShareAmount: split.instructorShareAmount,
    platformShareAmount: split.platformShareAmount,
    courseId,
    enrollmentId,
    source,
    createdBy: buyerId,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (sectionIds && sectionIds.length > 0) {
    entry.sectionIds = sectionIds;
  }
  transaction.set(entryRef, entry);

  // Bump the denormalized total. `set` with `merge` so it still works if
  // the instructor has no user doc yet (rare, but possible for an account
  // created before the user-doc bootstrap ran).
  transaction.set(
    instructorRef,
    {
      earningsTotal: FieldValue.increment(split.instructorShareAmount),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return split;
}
