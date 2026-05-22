// Revenue-split math for instructor earnings.
//
// A course sale is split between the instructor and the platform by a
// per-instructor percentage (`users/{uid}.revenueSharePercent`, default 70).
// These helpers are pure — no SDK, no I/O — so they are safe to use on the
// server, in the migration script, and in any future client preview.
//
// See docs/INSTRUCTOR_PAYOUTS.md.

import { DEFAULT_REVENUE_SHARE_PERCENT } from "@/lib/services/userDoc";

export type RevenueSplit = {
  grossAmount: number;
  revenueSharePercent: number;
  instructorShareAmount: number;
  platformShareAmount: number;
};

// Coerce a stored `revenueSharePercent` into a usable number. A missing,
// non-numeric, or out-of-range value falls back to the launch default — so
// a legacy user doc with no rate behaves exactly like a 70% instructor.
export function normalizeRevenueSharePercent(raw: unknown): number {
  if (
    typeof raw === "number" &&
    Number.isFinite(raw) &&
    raw >= 0 &&
    raw <= 100
  ) {
    return raw;
  }
  return DEFAULT_REVENUE_SHARE_PERCENT;
}

// Split a gross sale amount (IQD) into instructor and platform shares.
// `instructorShareAmount` is rounded to a whole dinar; `platformShareAmount`
// takes the remainder, so the two always sum back to the gross exactly and
// no fraction of a dinar is ever lost or invented.
export function computeRevenueSplit(
  grossAmount: number,
  revenueSharePercent: unknown
): RevenueSplit {
  const pct = normalizeRevenueSharePercent(revenueSharePercent);
  const gross = Math.max(0, Math.round(grossAmount));
  const instructorShareAmount = Math.round((gross * pct) / 100);
  const platformShareAmount = gross - instructorShareAmount;
  return { grossAmount: gross, revenueSharePercent: pct, instructorShareAmount, platformShareAmount };
}
