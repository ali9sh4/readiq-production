// types/wallet.ts

export type WalletTransactionType =
  | "topup"
  | "purchase"
  | "refund"
  | "bonus"
  | "penalty";

export type TopupStatus = "pending" | "approved" | "rejected" | "expired";

export type TopupMethod = "bank_transfer" | "zaincash" | "cash_agent";

// Wallet
export interface Wallet {
  userId: string;
  balance: number;
  totalTopups: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  dailyLimit: number;
  isVerified: boolean;
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
  };
  createdAt: string;
}

// Topup request (user submits, admin approves)
export interface TopupRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  amount: number;
  method: TopupMethod;
  status: TopupStatus;

  receiptUrl: string;
  transactionId?: string;
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
