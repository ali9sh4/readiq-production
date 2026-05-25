"use server";

import { headers } from "next/headers";
import {
  checkDeletionEligibility,
  performAccountDeletion,
  type DeletionBlockedReason,
} from "@/lib/services/accountDeletion";
import { removeToken } from "@/context/actions";

export interface DeleteActionResult {
  ok: boolean;
  error?: "NOT_AUTHENTICATED" | "NOT_ALLOWED" | "FAILED";
  reason?: DeletionBlockedReason;
}

// Server action invoked from the /delete-account page after the user types
// the confirm word. Re-checks eligibility on the server — never trusts the
// client-rendered `blocked` flag.
export async function deleteMyAccount(): Promise<DeleteActionResult> {
  const uid = (await headers()).get("x-user-id");
  if (!uid) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }

  const eligibility = await checkDeletionEligibility(uid);
  if (!eligibility.allowed) {
    return { ok: false, error: "NOT_ALLOWED", reason: eligibility.reason };
  }

  try {
    await performAccountDeletion(uid);
  } catch (err) {
    console.error("[account-deletion/web] failed for uid", uid, err);
    return { ok: false, error: "FAILED" };
  }

  // Clear BOTH session cookies (firebaseAuthToken + firebaseAuthRefreshToken).
  // The existing helper already handles both — see context/actions.ts.
  await removeToken();

  return { ok: true };
}
