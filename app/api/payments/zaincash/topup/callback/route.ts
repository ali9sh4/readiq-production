// GET /api/payments/zaincash/topup/callback?token=...
//
// ZainCash redirects the user's browser here after payment. No user auth — the
// HMAC-signed JWT in `?token=` is the authentication (only ZainCash, holding
// ZAINCASH_SECRET_KEY, can mint a valid one), re-confirmed server-side via
// /transaction/get.
//
// The credit is the §7 fix: the SAME atomic, status-gated transaction as
// `approveTopupRequest` (wallet_actions.ts), but gated on the ZainCash txn id
// instead of a human click. The "already done" sentinel is status === "approved",
// so the credit is EXACTLY-ONCE even if the callback fires repeatedly.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/firebase/service";
import { zaincash } from "@/lib/payments/zaincash";
import { TOPUP_COMPLETE_PATH } from "@/lib/payments/zaincashTopup";
import type { Wallet } from "@/types/wallets";

function errorRedirect(req: NextRequest, message: string) {
  return NextResponse.redirect(
    new URL(`/payments/error?message=${message}`, req.url)
  );
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return errorRedirect(req, "missing_token");

    // 1. Verify + decode the redirect token (constant-time HMAC in the class).
    let verified: { id?: string; status?: string } & Record<string, unknown>;
    try {
      verified = zaincash.verifyToken(token);
    } catch (err) {
      console.error("[zaincash-topup-callback] token verify failed", err);
      return errorRedirect(req, "invalid_token");
    }

    const transactionId = verified.id;
    if (!transactionId || typeof transactionId !== "string") {
      return errorRedirect(req, "invalid_token");
    }
    const callbackStatus = verified.status;

    // 2. Reconcile against the server (authoritative). On any reconciliation
    //    failure we fall back to the signed callback status.
    let finalStatus = callbackStatus;
    let serverAmount: number | undefined;
    try {
      const serverCheck = await zaincash.getTransactionStatus(transactionId);
      if (serverCheck?.status) finalStatus = serverCheck.status;
      if (typeof serverCheck?.amount === "number")
        serverAmount = serverCheck.amount;
    } catch (err) {
      console.error(
        "[zaincash-topup-callback] server reconcile failed, using callback status",
        err
      );
    }

    const topupRef = db.collection("topup_requests").doc(transactionId);

    // 3a. Terminal failure — record it (unless already credited) and surface it.
    if (finalStatus === "failed") {
      const snap = await topupRef.get();
      if (snap.exists && snap.data()?.status !== "approved") {
        await topupRef.update({
          status: "rejected",
          rejectionReason: "zaincash_failed",
          updatedAt: new Date().toISOString(),
        });
      }
      console.info(`[zaincash-topup-callback] failed txnId=${transactionId}`);
      return errorRedirect(req, "topup_failed");
    }

    // 3b. Still pending at ZainCash — hand off to the bridge page, which polls
    //     the intent endpoint and can reconcile/retry. No credit yet.
    if (finalStatus !== "success" && finalStatus !== "completed") {
      console.info(
        `[zaincash-topup-callback] non-final status=${finalStatus} txnId=${transactionId}`
      );
      return NextResponse.redirect(
        new URL(
          `${TOPUP_COMPLETE_PATH}?txn=${transactionId}&state=pending`,
          req.url
        )
      );
    }

    // 3c. Success — credit the wallet EXACTLY ONCE.
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(topupRef);
      if (!doc.exists) {
        return { outcome: "not_found" as const };
      }
      const d = doc.data() as {
        userId: string;
        userName?: string;
        amount: number;
        status: string;
      };

      // The dedupe gate: already credited → no-op. A replayed callback lands
      // here and changes nothing.
      if (d.status === "approved") {
        return { outcome: "already_credited" as const };
      }

      // Amount is taken from the STORED doc (set at init), never from the
      // token. If the server-confirmed amount disagrees, refuse — something is
      // wrong, don't credit a number we didn't originate.
      const amount = Number(d.amount) || 0;
      if (serverAmount !== undefined && serverAmount !== amount) {
        return { outcome: "amount_mismatch" as const };
      }
      if (!(amount > 0)) {
        return { outcome: "bad_amount" as const };
      }

      const walletRef = db.collection("wallets").doc(d.userId);
      const walletDoc = await transaction.get(walletRef);
      const nowIso = new Date().toISOString();

      const balanceBefore = walletDoc.exists
        ? (walletDoc.data() as Wallet).balance ?? 0
        : 0;
      const newBalance = balanceBefore + amount;

      if (walletDoc.exists) {
        transaction.update(walletRef, {
          balance: newBalance,
          totalTopups: FieldValue.increment(amount),
          updatedAt: nowIso,
        });
      } else {
        // Defensive: init provisions the wallet, but never trust that across a
        // multi-hop redirect.
        transaction.set(walletRef, {
          userId: d.userId,
          userName: d.userName || "مستخدم",
          balance: newBalance,
          totalTopups: amount,
          totalSpent: 0,
          dailyLimit: 5_000_000,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      transaction.update(topupRef, {
        status: "approved",
        processedBy: "zaincash-callback",
        processedAt: nowIso,
        updatedAt: nowIso,
      });

      const txnRef = db.collection("wallet_transactions").doc();
      transaction.set(txnRef, {
        userId: d.userId,
        type: "topup",
        amount,
        balanceBefore,
        balanceAfter: newBalance,
        description: "إيداع عبر زين كاش",
        metadata: {
          topupRequestId: transactionId,
          source: "zaincash",
          zaincashTxnId: transactionId,
        },
        // Idempotency marker mirroring the wallet-purchase convention, so this
        // row is also dedupable by (userId, protectionKey) if ever queried.
        protectionKey: `zaincash_topup_${transactionId}`,
        createdAt: nowIso,
      });

      return { outcome: "credited" as const };
    });

    if (result.outcome === "not_found") {
      return errorRedirect(req, "topup_not_found");
    }
    if (result.outcome === "amount_mismatch" || result.outcome === "bad_amount") {
      console.error(
        `[zaincash-topup-callback] ${result.outcome} txnId=${transactionId} serverAmount=${serverAmount}`
      );
      return errorRedirect(req, "processing_error");
    }

    console.info(
      `[zaincash-topup-callback] ${result.outcome} txnId=${transactionId}`
    );

    // Credited (or already-credited on replay) → bridge page finishes any
    // deferred enrollment via the existing wallet-pays-enrollment path.
    return NextResponse.redirect(
      new URL(`${TOPUP_COMPLETE_PATH}?txn=${transactionId}`, req.url)
    );
  } catch (err) {
    console.error("[zaincash-topup-callback] unhandled", err);
    return errorRedirect(req, "processing_error");
  }
}
