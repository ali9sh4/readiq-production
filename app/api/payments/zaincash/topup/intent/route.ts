// GET /api/payments/zaincash/topup/intent?txn=<zaincashTxnId>  (bearer-authed)
//
// The post-payment bridge page (/wallet/topup/complete) calls this to learn the
// top-up's current status and its deferred enrollment intent, so it can finish
// the purchase. Ownership-checked: a user can only read their own top-up doc.
import { NextRequest } from "next/server";
import { db } from "@/firebase/service";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { fail, handleApiError, ok } from "@/lib/api/response";
import type { TopupIntent } from "@/types/wallets";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);
    const txn = req.nextUrl.searchParams.get("txn");
    if (!txn) {
      return fail("VALIDATION_ERROR", "txn query param is required", 400);
    }

    const snap = await db.collection("topup_requests").doc(txn).get();
    // 404 (not 403) on a foreign doc too, so we never confirm a txn id exists
    // to someone who doesn't own it.
    if (!snap.exists || snap.data()?.userId !== auth.userId) {
      return fail("NOT_FOUND", "Top-up not found", 404);
    }

    const d = snap.data()!;
    const intent: TopupIntent =
      d.intent && typeof d.intent === "object"
        ? (d.intent as TopupIntent)
        : { kind: "none" };

    return ok({
      transactionId: txn,
      status: d.status as string,
      amount: Number(d.amount) || 0,
      source: (d.source as string) ?? "manual",
      intent,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
