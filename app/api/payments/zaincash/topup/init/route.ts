// POST /api/payments/zaincash/topup/init  (web-only, bearer-authed)
//
// Step 1 of the ZainCash → wallet top-up. Creates a ZainCash transaction and
// PRE-CREATES a pending `topup_requests` doc whose Firestore id IS the ZainCash
// transaction id — the §7 idempotency anchor. The callback later credits the
// wallet exactly once by gating on that doc.
//
// This is the NEW automated path. It does NOT touch the frozen pay-per-course
// routes at /api/payments/zaincash/{init,webhook}.
import { NextRequest } from "next/server";
import { adminAuth, db } from "@/firebase/service";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { topupInitBody } from "@/lib/validation/api/zaincashTopup";
import { zaincash } from "@/lib/payments/zaincash";
import {
  ZAINCASH_TOPUP_AWAITING_TTL_MINUTES,
  ZAINCASH_TOPUP_SERVICE_TYPE,
  buildTopupCallbackUrl,
  isAwaitingExpired,
} from "@/lib/payments/zaincashTopup";
import type { TopupIntent, Wallet } from "@/types/wallets";

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);
    const body = topupInitBody.parse(await req.json());
    const intent: TopupIntent = body.intent ?? { kind: "none" };

    // --- Ensure the wallet exists (auto-provision, same shape as the rest of
    //     the codebase) so the callback can credit it without a race. ---
    const userRecord = await adminAuth.getUser(auth.userId);
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

    // --- Daily aggregation limit + stale-doc sweep, in one pass. ---
    // "Today" = UTC calendar day to match the ISO strings stored on docs.
    const now = new Date();
    const todayStartIso = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    ).toISOString();

    // Reuses the existing (userId ASC, createdAt DESC) index; status filtered
    // in JS so no extra composite index is needed.
    const todaysSnap = await db
      .collection("topup_requests")
      .where("userId", "==", auth.userId)
      .where("createdAt", ">=", todayStartIso)
      .get();

    let usedToday = 0;
    const sweep = db.batch();
    let sweepCount = 0;
    for (const doc of todaysSnap.docs) {
      const d = doc.data();
      const status = d.status as string;
      // Committed money (credited or manual-pending) always counts.
      if (status === "approved" || status === "pending") {
        usedToday += Number(d.amount) || 0;
        continue;
      }
      // In-flight ZainCash attempt: counts only while genuinely live. Past the
      // TTL it is abandoned — sweep it to "expired" so a stuck doc can never
      // keep inflating the daily total and blocking the user. (It never blocks
      // the MANUAL guard regardless, which only sees status == "pending".)
      if (status === "awaiting_payment") {
        if (isAwaitingExpired(String(d.createdAt), now.getTime())) {
          sweep.update(doc.ref, {
            status: "expired",
            updatedAt: now.toISOString(),
          });
          sweepCount += 1;
        } else {
          usedToday += Number(d.amount) || 0;
        }
      }
    }
    if (sweepCount > 0) {
      await sweep.commit();
    }

    if (usedToday + body.amount > wallet.dailyLimit) {
      return fail(
        "DAILY_LIMIT_EXCEEDED",
        `Daily topup limit exceeded. Limit: ${wallet.dailyLimit}, used today: ${usedToday}, requested: ${body.amount}`,
        400
      );
    }

    // --- Create the ZainCash transaction. The callback host is PINNED (prod),
    //     not the per-deploy preview URL. ---
    const orderId = `wtopup_${auth.userId}_${now.getTime()}`;
    let zc: { id: string; url: string };
    try {
      zc = await zaincash.createTopupTransaction(
        body.amount,
        orderId,
        buildTopupCallbackUrl(),
        ZAINCASH_TOPUP_SERVICE_TYPE
      );
    } catch (err) {
      console.error("[zaincash-topup-init] createTransaction failed", err);
      return fail(
        "ZAINCASH_ERROR",
        err instanceof Error ? err.message : "Failed to create ZainCash transaction",
        502
      );
    }

    // --- Pre-create the pending doc, keyed by the ZainCash transaction id. ---
    const expiresAt = new Date(
      now.getTime() + ZAINCASH_TOPUP_AWAITING_TTL_MINUTES * 60_000
    ).toISOString();
    const nowIso = now.toISOString();
    await db
      .collection("topup_requests")
      .doc(zc.id)
      .set({
        userId: auth.userId,
        userEmail: userRecord.email || "",
        userName: userRecord.displayName || "مستخدم",
        amount: body.amount,
        status: "awaiting_payment",
        source: "zaincash",
        paymentMethod: "zaincash",
        transactionId: zc.id,
        orderId,
        intent,
        createdAt: nowIso,
        expiresAt,
        updatedAt: nowIso,
      });

    console.info(
      `[zaincash-topup-init] userId=${auth.userId} txnId=${zc.id} amount=${body.amount} intent=${intent.kind}`
    );

    return ok({ transactionId: zc.id, payUrl: zc.url });
  } catch (err) {
    return handleApiError(err);
  }
}
