// types/wallet.ts

export type WalletTransactionType =
  | "topup"
  | "purchase"
  | "refund"
  | "earning"
  | "bonus"
  | "penalty";

export type TopupStatus = "pending" | "approved" | "rejected" | "expired";

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
