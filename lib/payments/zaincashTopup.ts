// Shared constants + pure helpers for the ZainCash → wallet top-up flow.
//
// This is the NEW automated top-up path. It is wholly separate from the frozen
// pay-per-course ZainCash routes (`/api/payments/zaincash/init` +
// `/webhook`), which it does not touch. The only thing reused from the legacy
// code is the `ZainCash` class in `./zaincash` (signing/verifying).
//
// No secrets and no `NEXT_PUBLIC_` exposure live here — this module is imported
// only by server route handlers.

import type { TopupIntent } from "@/types/wallets";

// Amount bounds for a ZainCash top-up. Matches the manual bank-transfer flow
// (createTopupRequest) per product decision, so the two channels feel the same.
// ZainCash's own merchant floor is 250 IQD (enforced again in the class).
export const ZAINCASH_TOPUP_MIN_IQD = 1_000;
export const ZAINCASH_TOPUP_MAX_IQD = 5_000_000;

// Shows on the user's ZainCash receipt (truncated to 50 chars by the class).
export const ZAINCASH_TOPUP_SERVICE_TYPE = "Rubik Wallet Top-up";

// How long a pre-payment ("awaiting_payment") ZainCash doc stays live before it
// is considered abandoned. Short, because a real payment resolves in minutes via
// the callback. Past this, a new init for the same user supersedes it and a
// stale-doc sweep treats it as expired — so a stuck doc never permanently
// blocks the user. (It already never blocks the MANUAL guard, which only
// queries status == "pending".)
export const ZAINCASH_TOPUP_AWAITING_TTL_MINUTES = 30;

// Collection shared with the manual flow (product decision: one collection,
// discriminated by `source`).
export const TOPUP_REQUESTS_COLLECTION = "topup_requests";

// The path the post-payment browser lands on. The bridge page reads `?txn=`,
// fetches the intent + status, and finishes the purchase via the existing
// wallet-pays-enrollment action.
export const TOPUP_COMPLETE_PATH = "/wallet/topup/complete";

/**
 * Resolve the base URL the ZainCash callback redirect is built from.
 *
 * Prefers `ZAINCASH_CALLBACK_BASE_URL` — a value PINNED to the production host
 * — over `NEXT_PUBLIC_APP_URL`, because Vercel preview deploys get per-deploy
 * URLs that ZainCash will not have whitelisted. Set `ZAINCASH_CALLBACK_BASE_URL`
 * in prod env; leave it unset locally to fall back to `NEXT_PUBLIC_APP_URL`.
 * Trailing slash is stripped so callers can append a leading-slash path.
 */
export function resolveTopupCallbackBaseUrl(): string {
  const raw =
    process.env.ZAINCASH_CALLBACK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";
  if (!raw) {
    throw new Error(
      "No callback base URL configured: set ZAINCASH_CALLBACK_BASE_URL (preferred) or NEXT_PUBLIC_APP_URL"
    );
  }
  return raw.replace(/\/+$/, "");
}

/** Full absolute URL ZainCash redirects the user back to after payment. */
export function buildTopupCallbackUrl(): string {
  return `${resolveTopupCallbackBaseUrl()}/api/payments/zaincash/topup/callback`;
}

// ISO timestamp comparison: is an awaiting_payment doc past its TTL?
export function isAwaitingExpired(
  createdAtIso: string,
  nowMs: number = Date.now()
): boolean {
  const created = Date.parse(createdAtIso);
  if (Number.isNaN(created)) return true; // unparseable → treat as stale
  return nowMs - created > ZAINCASH_TOPUP_AWAITING_TTL_MINUTES * 60_000;
}

// Narrowing guard used by both the init validation and the bridge completion.
export function isValidIntent(value: unknown): value is TopupIntent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  switch (v.kind) {
    case "none":
      return true;
    case "course":
    case "bundle":
      return typeof v.courseId === "string" && v.courseId.length > 0;
    case "sections":
      return (
        typeof v.courseId === "string" &&
        v.courseId.length > 0 &&
        Array.isArray(v.sectionIds) &&
        v.sectionIds.length > 0 &&
        v.sectionIds.every((s) => typeof s === "string" && s.length > 0)
      );
    case "package":
      return typeof v.packageId === "string" && v.packageId.length > 0;
    default:
      return false;
  }
}
