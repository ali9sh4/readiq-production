import { NextRequest } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { adminAuth, db } from "@/firebase/service";
import { r2Client, R2_BUCKET_NAME } from "@/lib/R2/r2_client";
import { getPresignedDownloadUrl } from "@/lib/R2/presignedUpload";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { topupRequestBody } from "@/lib/validation/api/wallet";
import type { Wallet } from "@/types/wallets";

const RECEIPT_VIEW_URL_TTL_SECONDS = 60 * 60 * 24;
const TOPUP_EXPIRES_DAYS = 7;

// Shape of the doc written to `topup_requests` for both web and mobile.
// Existing fields (userId, userEmail, userName, amount, status, senderName,
// createdAt, expiresAt, updatedAt) match `createTopupRequest` in
// `app/actions/wallet_actions.ts` byte-for-byte. The new mobile-only fields
// (paymentMethod, receiptKey, receiptUrl, receiptContentType, note) are
// additive — old web-created docs simply don't have them, and the history
// route surfaces them as null with `?? null` fallbacks.
//
// Why we don't call `createTopupRequest` directly:
//   - mobile bounds are stricter (1k–1M vs the action's 1k–5M)
//   - mobile enforces a daily-limit *aggregation* the action doesn't do
//   - mobile writes extra fields the action doesn't take as parameters
// Wrapping the action with post-write updates would race with admin
// approvals between insert and patch, so we inline equivalent logic and keep
// the existing action 100% intact for the web flow.
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);
    const body = topupRequestBody.parse(await req.json());

    const expectedPrefix = `topup-receipts/${auth.userId}/`;
    if (!body.receiptKey.startsWith(expectedPrefix)) {
      return fail(
        "VALIDATION_ERROR",
        "receiptKey does not belong to this user",
        400
      );
    }

    // Best-effort HEAD on the R2 object so a typo'd / never-PUT key fails
    // fast at request time instead of confusing the admin reviewer later.
    // If R2 is briefly unreachable we surface a generic 500 from
    // handleApiError — that's preferable to silently accepting a missing
    // receipt.
    try {
      await r2Client.send(
        new HeadObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: body.receiptKey,
        })
      );
    } catch (err: unknown) {
      const name = (err as { name?: string } | null)?.name;
      const httpStatus = (err as { $metadata?: { httpStatusCode?: number } })
        ?.$metadata?.httpStatusCode;
      if (name === "NotFound" || httpStatus === 404) {
        return fail(
          "RECEIPT_NOT_UPLOADED",
          "Receipt object not found in storage. Upload it first via POST /api/wallet/topup/upload-receipt.",
          400
        );
      }
      throw err;
    }

    const userRecord = await adminAuth.getUser(auth.userId);

    // Match the auto-provision pattern from GET /api/wallet and
    // createTopupRequest so a brand-new user can top up immediately.
    const walletRef = db.collection("wallets").doc(auth.userId);
    const walletSnap = await walletRef.get();
    let wallet: Wallet;
    if (!walletSnap.exists) {
      const initial: Wallet = {
        userId: auth.userId,
        userName: userRecord.displayName || "مستخدم",
        balance: 0,
        totalTopups: 0,
        totalSpent: 0,
        dailyLimit: 5_000_000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await walletRef.set(initial);
      wallet = initial;
    } else {
      wallet = walletSnap.data() as Wallet;
    }

    if (!wallet) {
      return fail("WALLET_NOT_FOUND", "Wallet not found", 404);
    }

    // "Today" = UTC calendar day. ISO strings stored on docs are UTC, so
    // this aligns with the existing data shape. If product later wants
    // Asia/Baghdad calendar boundaries, swap the start computation.
    const now = new Date();
    const todayStartIso = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    ).toISOString();

    // Reuses existing index: topup_requests (userId ASC, createdAt DESC).
    // We filter status in JS to avoid needing a 3-field composite index for
    // this rarely-large per-user-per-day result set.
    const todaysSnap = await db
      .collection("topup_requests")
      .where("userId", "==", auth.userId)
      .where("createdAt", ">=", todayStartIso)
      .get();

    let pendingCount = 0;
    let usedToday = 0;
    for (const doc of todaysSnap.docs) {
      const d = doc.data();
      if (d.status === "approved" || d.status === "pending") {
        usedToday += Number(d.amount) || 0;
        if (d.status === "pending") pendingCount += 1;
      }
    }

    // Mirror the existing single-pending-at-a-time policy from
    // createTopupRequest. Surfacing as VALIDATION_ERROR keeps the error
    // taxonomy small; the message identifies the cause.
    if (pendingCount > 0) {
      return fail(
        "VALIDATION_ERROR",
        "You already have a pending topup request",
        400
      );
    }

    if (usedToday + body.amount > wallet.dailyLimit) {
      return fail(
        "DAILY_LIMIT_EXCEEDED",
        `Daily topup limit exceeded. Limit: ${wallet.dailyLimit}, used today: ${usedToday}, requested: ${body.amount}`,
        400
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOPUP_EXPIRES_DAYS);

    const receiptUrl = await getPresignedDownloadUrl({
      key: body.receiptKey,
      expiresIn: RECEIPT_VIEW_URL_TTL_SECONDS,
    });

    // Derive contentType from extension to keep the doc self-describing for
    // the admin UI without trusting client input again.
    const ext = body.receiptKey.split(".").pop()?.toLowerCase() ?? "";
    const receiptContentType =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "png"
        ? "image/png"
        : ext === "webp"
        ? "image/webp"
        : ext === "pdf"
        ? "application/pdf"
        : null;

    const nowIso = new Date().toISOString();
    const topupDoc: Record<string, unknown> = {
      // Canonical fields — must match createTopupRequest shape exactly.
      userId: auth.userId,
      userEmail: userRecord.email || "",
      userName: userRecord.displayName || "مستخدم",
      amount: body.amount,
      status: "pending",
      source: "manual" as const,
      senderName: body.senderName,
      createdAt: nowIso,
      expiresAt: expiresAt.toISOString(),
      updatedAt: nowIso,
      // New mobile-only additive fields.
      paymentMethod: body.paymentMethod,
      receiptKey: body.receiptKey,
      receiptUrl,
      receiptContentType,
    };
    if (body.note !== undefined) topupDoc.note = body.note;

    const docRef = await db.collection("topup_requests").add(topupDoc);

    return ok({
      topupRequestId: docRef.id,
      status: "pending" as const,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
