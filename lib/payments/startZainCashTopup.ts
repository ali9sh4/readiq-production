// Client helper: kick off a ZainCash wallet top-up and redirect the browser to
// the ZainCash pay page. The deferred `intent` is stored server-side on the
// pending doc; after payment the user lands on /wallet/topup/complete, which
// finishes the purchase via the existing wallet-pays-enrollment path.
//
// Plain fetch util (no server imports) so it is safe to call from any client
// component.
import type { TopupIntent } from "@/types/wallets";

export const ZAINCASH_TOPUP_MIN_IQD = 1_000;

export async function startZainCashTopup(
  idToken: string,
  args: { amount: number; intent: TopupIntent }
): Promise<never | void> {
  const res = await fetch("/api/payments/zaincash/topup/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ amount: args.amount, intent: args.intent }),
  });

  const json = await res.json().catch(() => null);
  if (!json?.success || !json?.data?.payUrl) {
    throw new Error(json?.error?.message || "فشل بدء عملية الدفع عبر زين كاش");
  }

  // Full-page navigation to ZainCash. Resolves to `never` in practice.
  window.location.href = json.data.payUrl as string;
}
