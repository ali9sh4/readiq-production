// Zod schemas for the instructor earnings / payout admin actions.
// Mirrors the placement of `lib/packages/validation.ts`.

import { z } from "zod";

export const PAYOUT_METHODS = ["bank_transfer", "zaincash", "cash"] as const;

// Recording a manual payout. `amount` is a whole IQD amount the admin
// actually paid the instructor out of band; it must be positive (a payout
// is a real event — zero is not a payout). Partial payouts are allowed, so
// the amount is NOT capped at the current outstanding.
export const recordPayoutSchema = z.object({
  instructorId: z.string().min(1),
  amount: z.number().int().positive(),
  method: z.enum(PAYOUT_METHODS),
  note: z.string().trim().max(500).optional(),
});

// Editing an instructor's revenue share. Affects FUTURE sales only — past
// ledger entries keep their snapshotted percentage.
export const revenueShareSchema = z.object({
  instructorId: z.string().min(1),
  revenueSharePercent: z.number().min(0).max(100),
});

export type RecordPayoutInput = z.infer<typeof recordPayoutSchema>;
export type RevenueShareInput = z.infer<typeof revenueShareSchema>;
