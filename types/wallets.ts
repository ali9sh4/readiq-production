// types/wallet.ts

export type WalletTransactionType =
  | "topup"
  | "purchase"
  | "refund"
  | "earning"
  | "bonus"
  | "penalty"
  // Credited to the dedicated platform wallet on a course-package sale.
  // Distinct from "earning" (instructor course revenue) so platform
  // package income is filterable.
  | "package_revenue";

// "pending" is the MANUAL bank-transfer state awaiting admin review.
// "awaiting_payment" is the ZainCash state after init, before the user has
// paid. They are deliberately DIFFERENT values so the manual one-pending-per-
// user guard (which queries status == "pending") never counts an in-flight
// ZainCash top-up — and so an abandoned ZainCash doc can never block a user's
// next manual request. Both converge to "approved" once credited.
export type TopupStatus =
  | "pending"
  | "awaiting_payment"
  | "approved"
  | "rejected"
  | "expired";

// Which channel created the topup_requests doc. Legacy docs predate this
// field — treat a missing source as "manual" (every pre-existing doc was a
// manual bank transfer).
export type TopupSource = "manual" | "zaincash";

// What to do with the buyer AFTER a ZainCash top-up credits the wallet. Stored
// on the pending doc at init time so the post-payment bridge can finish the
// purchase through the EXISTING wallet-pays-enrollment path. "none" is a plain
// top-up with no enrollment to complete.
export type TopupIntent =
  | { kind: "none" }
  | { kind: "course"; courseId: string }
  | { kind: "sections"; courseId: string; sectionIds: string[] }
  | { kind: "bundle"; courseId: string }
  | { kind: "package"; packageId: string };

// Wallet
export interface Wallet {
  userId: string;
  userName?: string;
  balance: number;
  totalTopups: number;
  totalEarnings?: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
  dailyLimit: number;
}

// Transaction record
export interface WalletTransaction {
  id: string;
  userId: string;
  type: WalletTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  metadata?: {
    courseId?: string;
    courseTitle?: string;
    topupRequestId?: string;
    packageId?: string;
    packageTitle?: string;
  };
  createdAt: string;
  protectionKey?: string;
}

// Topup request (user submits, admin approves)
export interface TopupRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  amount: number;
  status: TopupStatus;
  // For ZainCash docs this is the ZainCash transaction id (also used as the
  // Firestore doc id, so a duplicate create is impossible — the §7 dedupe
  // anchor). Unused by the manual flow.
  transactionId?: string;
  source?: TopupSource;
  // Present only on ZainCash docs — the deferred enrollment to finish post-credit.
  intent?: TopupIntent;
  senderName?: string;
  senderAccount?: string;

  processedBy?: string;
  processedAt?: string;
  rejectionReason?: string;
  adminNotes?: string;

  createdAt: string;
  expiresAt: string;
  updatedAt: string;
}
