// Single source of truth for account deletion. Called by both the mobile
// DELETE /api/me handler and the public /delete-account web page.
//
// Scope (decision B — retain financial records):
//   DELETED : R2 topup-receipts/{uid}/*, all favorites where userId == uid,
//             all progress (video viewing history) where userId == uid,
//             wallets/{uid}, users/{uid}, and the Firebase Auth user (refresh
//             tokens revoked first).
//   RETAINED: enrollments, wallet_transactions, topup_requests,
//             payment_transactions, package_sales. Disclosed in the
//             privacy policy.
//
// Order is deliberate: Auth user is deleted LAST so any failure before that
// step leaves a self-healing state (POST /api/me would recreate users/{uid}
// on next sign-in). The function is idempotent — running it twice on the
// same uid succeeds because Firestore admin .delete() is a no-op on missing
// docs and we explicitly catch `auth/user-not-found` on the Auth deletion.

import { adminAuth, db } from "@/firebase/service";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  type ObjectIdentifier,
  type _Object,
} from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "@/lib/R2/r2_client";

export type DeletionBlockedReason =
  | "ACCOUNT_IS_ADMIN"
  | "INSTRUCTOR_HAS_COURSES"
  | "INSTRUCTOR_HAS_EARNINGS"
  | "INSTRUCTOR_HAS_PACKAGE_PAYOUTS";

export interface DeletionEligibility {
  allowed: boolean;
  reason?: DeletionBlockedReason;
  // Authoritative wallet balance from wallets/{uid}.balance. Surfaced so the
  // UI can warn that any remaining balance is forfeited on delete.
  walletBalance: number;
}

export interface DeletionResult {
  ok: true;
  uid: string;
}

// Checks whether a uid is allowed to self-delete. Admins and instructors with
// any course / standalone earnings / unsettled package-sale payout are routed
// to manual support — their data cannot safely be hard-deleted.
export async function checkDeletionEligibility(
  uid: string
): Promise<DeletionEligibility> {
  // Admin claim check (custom claims live on the Auth user, not Firestore).
  const userRecord = await adminAuth.getUser(uid).catch(() => null);
  if (userRecord?.customClaims?.admin === true) {
    return { allowed: false, reason: "ACCOUNT_IS_ADMIN", walletBalance: 0 };
  }

  // Read wallet balance up front so we can surface it on every blocked path.
  const walletSnap = await db.collection("wallets").doc(uid).get();
  const walletBalance: number = walletSnap.exists
    ? (walletSnap.data()?.balance ?? 0)
    : 0;

  // users/{uid}.createdCourses array. This array is intentionally NOT drained
  // when a course is soft- or permanently-deleted (see audit item E:
  // app/actions/course_deletion_action.ts never updates it), so it's a
  // load-bearing fingerprint of "this user ever instructed." If anyone later
  // adds cleanup code on course delete, the package-payouts check below is
  // the second line of defence — keep both.
  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.exists ? (userSnap.data() ?? {}) : {};
  const createdCourses: string[] = Array.isArray(userData.createdCourses)
    ? userData.createdCourses
    : [];
  const earningsTotal: number =
    typeof userData.earningsTotal === "number" ? userData.earningsTotal : 0;

  if (createdCourses.length > 0) {
    return { allowed: false, reason: "INSTRUCTOR_HAS_COURSES", walletBalance };
  }

  // Defence-in-depth: confirm against the live courses collection too.
  const ownedCourses = await db
    .collection("courses")
    .where("createdBy", "==", uid)
    .limit(1)
    .get();
  if (!ownedCourses.empty) {
    return { allowed: false, reason: "INSTRUCTOR_HAS_COURSES", walletBalance };
  }

  // Standalone/sectional earnings flow (lib/earnings/recordEarning.ts is the
  // sole writer of users/{uid}.earningsTotal). Package sales do NOT touch
  // this field — they're handled by the separate check below.
  if (earningsTotal > 0) {
    return { allowed: false, reason: "INSTRUCTOR_HAS_EARNINGS", walletBalance };
  }

  // Package sales payout outstanding check.
  //
  // Package sales credit the platform wallet, not the instructor wallet, and
  // are settled out-of-band against the per-instructor owed tally on
  // `package_sales.payouts[uid]` (see docs/COURSE_PACKAGES.md and
  // app/actions/package_admin_actions.ts:getPayoutLedger). Block self-delete
  // when (Σ owed − Σ paid) > 0 for this uid.
  //
  // Scaling note: this is an unfiltered scan of `package_sales` because the
  // `payouts` map field is not directly queryable in Firestore. At current
  // catalogue size (<100 sales) the scan is fine. If `package_sales` grows
  // large, denormalise `payoutInstructorIds: string[]` onto each sale doc and
  // narrow this read to `where("payoutInstructorIds", "array-contains", uid)`.
  const [salesSnap, paidSnap] = await Promise.all([
    db.collection("package_sales").get(),
    db.collection("instructor_payouts").where("instructorId", "==", uid).get(),
  ]);
  let owed = 0;
  for (const d of salesSnap.docs) {
    const payouts = (d.data().payouts ?? {}) as Record<string, unknown>;
    const v = payouts[uid];
    if (typeof v === "number" && v > 0) owed += v;
  }
  let paid = 0;
  for (const d of paidSnap.docs) {
    const amt = d.data().amount;
    if (typeof amt === "number") paid += amt;
  }
  if (owed - paid > 0) {
    return {
      allowed: false,
      reason: "INSTRUCTOR_HAS_PACKAGE_PAYOUTS",
      walletBalance,
    };
  }

  return { allowed: true, walletBalance };
}

// Deletes every R2 object under topup-receipts/{uid}/. No-op if none. Pages
// through ListObjectsV2 / DeleteObjects 1000 at a time (R2 limits).
async function purgeReceiptsFromR2(uid: string): Promise<void> {
  const prefix = `topup-receipts/${uid}/`;
  let continuationToken: string | undefined = undefined;

  do {
    const page: ListObjectsV2CommandOutput = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    const objects: _Object[] = page.Contents ?? [];
    if (objects.length > 0) {
      const Objects: ObjectIdentifier[] = [];
      for (const o of objects) {
        if (typeof o.Key === "string") Objects.push({ Key: o.Key });
      }
      if (Objects.length > 0) {
        await r2Client.send(
          new DeleteObjectsCommand({
            Bucket: R2_BUCKET_NAME,
            Delete: { Objects },
          })
        );
      }
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);
}

// Deletes every favorites doc for the user (top-level collection keyed by
// {userId}_{courseId}, filtered by userId field).
async function deleteFavorites(uid: string): Promise<void> {
  const snap = await db
    .collection("favorites")
    .where("userId", "==", uid)
    .get();
  const docs = snap.docs;
  // Stay under the 500-write batch limit with margin.
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

// Deletes every progress doc for the user (top-level `progress` collection,
// keyed {userId}_{courseId}, filtered by the userId field — same shape as
// favorites). These rows hold video viewing history (watchedSeconds,
// completionPercentage) and are read only by their owner (progress_actions.ts
// queries by the caller's own uid), so removing them on account deletion
// breaks no instructor analytics, completion, or certificate feature.
async function deleteProgress(uid: string): Promise<void> {
  const snap = await db
    .collection("progress")
    .where("userId", "==", uid)
    .get();
  const docs = snap.docs;
  // Stay under the 500-write batch limit with margin.
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

// Performs the deletion. The caller MUST have called checkDeletionEligibility
// and confirmed `allowed: true` first — this function does not re-check.
//
// Idempotent across re-runs: Firestore admin .delete() is a no-op on missing
// docs, and we explicitly handle auth/user-not-found on the Auth deletion.
export async function performAccountDeletion(
  uid: string
): Promise<DeletionResult> {
  // 1. R2 receipts (topup-receipts/{uid}/*).
  await purgeReceiptsFromR2(uid);

  // 2. favorites.
  await deleteFavorites(uid);

  // 3. progress (video viewing history).
  await deleteProgress(uid);

  // 4. wallets/{uid}. Never wallets/platform-wallet — that's a separate doc
  //    id (see lib/packages/constants.ts:PLATFORM_WALLET_ID) and a uid would
  //    never collide with it (Firebase uids are 28 alphanumeric chars; the
  //    platform-wallet id contains a hyphen).
  await db.collection("wallets").doc(uid).delete();

  // 5. users/{uid}.
  await db.collection("users").doc(uid).delete();

  // NOTE (decision B): enrollments, wallet_transactions, topup_requests,
  // payment_transactions, and package_sales are intentionally RETAINED as
  // financial records. After step 6, the uid on those rows is no longer
  // linked to identifying information — they are effectively pseudonymous.
  // This retention is disclosed in content/legal/privacy-policy.md §6.

  // 6. Firebase Auth — LAST. Revoke first so any in-flight ID tokens on
  //    other devices 401 immediately (verifyBearerToken passes
  //    checkRevoked:true). auth/user-not-found on either call means the user
  //    is already gone — treat as success for idempotency.
  try {
    await adminAuth.revokeRefreshTokens(uid);
    await adminAuth.deleteUser(uid);
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code !== "auth/user-not-found") {
      throw err;
    }
  }

  return { ok: true, uid };
}
