"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wallet as WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/authContext";
import { purchaseCourseWithWallet } from "@/app/actions/wallet_actions";
import {
  purchaseSectionsWithWallet,
  purchaseBundleWithWallet,
} from "@/app/actions/sectional_wallet_actions";
import { purchasePackageWithWallet } from "@/app/actions/package_wallet_actions";
import type { TopupIntent } from "@/types/wallets";

type Phase =
  | "loading" // fetching intent
  | "processing" // ZainCash still pending — no credit yet
  | "completing" // wallet credited, finishing the deferred enrollment
  | "topped_up" // credited, no enrollment to complete (intent: none)
  | "enrolled" // credited + enrollment completed
  | "credited_no_enroll" // credited, but the enrollment step couldn't finish
  | "error";

// Stable, txn-derived idempotency key: a page refresh reuses the SAME key, so
// the existing wallet actions' (userId, protectionKey) dedupe returns the
// original success instead of double-charging. Package keys MUST be namespaced
// `package_purchase_*` (enforced server-side).
function stableProtectionKey(
  intent: TopupIntent,
  uid: string,
  txn: string
): string {
  if (intent.kind === "package") {
    return `package_purchase_${uid}_${intent.packageId}_zc_${txn}`;
  }
  if (intent.kind === "none") return `topup_${uid}_zc_${txn}`;
  const action =
    intent.kind === "bundle"
      ? "bundle"
      : intent.kind === "sections"
      ? "sections"
      : "purchase";
  return `${action}_${uid}_${intent.courseId}_zc_${txn}`;
}

function destinationFor(intent: TopupIntent): string {
  switch (intent.kind) {
    case "course":
    case "sections":
    case "bundle":
      return `/course/${intent.courseId}`;
    case "package":
      return "/user_dashboard";
    case "none":
      return "/wallet/transactions";
  }
}

export default function CompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const txn = searchParams.get("txn");

  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState<string>("");
  const [dest, setDest] = useState<string>("/wallet/transactions");
  // Guard so the credited→enroll completion runs at most once per mount.
  const completedRef = useRef(false);

  const completeEnrollment = useCallback(
    async (intent: TopupIntent, token: string, uid: string) => {
      if (intent.kind === "none") {
        setDest(destinationFor(intent));
        setPhase("topped_up");
        return;
      }

      setPhase("completing");
      setDest(destinationFor(intent));
      const key = stableProtectionKey(intent, uid, txn as string);

      try {
        let result:
          | { success: boolean; error?: string; message?: string }
          | undefined;

        if (intent.kind === "course") {
          result = await purchaseCourseWithWallet(token, intent.courseId, key);
        } else if (intent.kind === "sections") {
          result = await purchaseSectionsWithWallet(
            token,
            intent.courseId,
            intent.sectionIds,
            key
          );
        } else if (intent.kind === "bundle") {
          result = await purchaseBundleWithWallet(token, intent.courseId, key);
        } else if (intent.kind === "package") {
          result = await purchasePackageWithWallet(token, intent.packageId, key);
        }

        if (result?.success) {
          setPhase("enrolled");
          // Mirror EnrollButton: brief success, then navigate + refresh.
          setTimeout(() => {
            router.push(destinationFor(intent));
            router.refresh();
          }, 1500);
          return;
        }

        // Credited but enrollment didn't finish (e.g. price moved, already
        // owned). The money is safely in the wallet — say so, don't imply loss.
        setMessage(
          result?.message ||
            result?.error ||
            "تم شحن محفظتك، لكن تعذّر إتمام الشراء تلقائيًا."
        );
        setPhase("credited_no_enroll");
      } catch (err) {
        console.error("[topup-complete] enrollment failed", err);
        setMessage("تم شحن محفظتك، لكن حدث خطأ أثناء إتمام الشراء.");
        setPhase("credited_no_enroll");
      }
    },
    [router, txn]
  );

  const load = useCallback(async () => {
    if (!txn) {
      setPhase("error");
      setMessage("رابط غير صالح.");
      return;
    }
    const user = auth?.user;
    if (!user) return; // wait for auth to hydrate

    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/payments/zaincash/topup/intent?txn=${encodeURIComponent(txn)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json().catch(() => null);
      if (!json?.success) {
        setPhase("error");
        setMessage(json?.error?.message || "تعذّر العثور على عملية الشحن.");
        return;
      }

      const { status, intent } = json.data as {
        status: string;
        intent: TopupIntent;
      };
      setDest(destinationFor(intent));

      if (status === "approved") {
        if (completedRef.current) return;
        completedRef.current = true;
        await completeEnrollment(intent, token, user.uid);
      } else if (status === "awaiting_payment") {
        setPhase("processing");
      } else {
        // rejected / expired
        setPhase("error");
        setMessage("لم تكتمل عملية الدفع. لم يتم شحن محفظتك.");
      }
    } catch (err) {
      console.error("[topup-complete] load failed", err);
      setPhase("error");
      setMessage("حدث خطأ غير متوقع.");
    }
  }, [txn, auth?.user, completeEnrollment]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 p-4"
      dir="rtl"
    >
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center space-y-5">
        {(phase === "loading" ||
          phase === "completing") && (
          <>
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
            <h1 className="text-xl font-bold text-gray-900">
              {phase === "loading" ? "جارٍ التحقق من الدفع..." : "جارٍ إتمام الشراء..."}
            </h1>
            <p className="text-gray-600">يرجى الانتظار، لا تغلق هذه الصفحة.</p>
          </>
        )}

        {phase === "processing" && (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-9 h-9 text-amber-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">الدفع قيد المعالجة</h1>
            <p className="text-gray-600">
              لم يتم تأكيد الدفع بعد. إذا أكملت الدفع للتو، حدّث الصفحة بعد لحظات.
            </p>
            <Button onClick={() => load()} className="w-full">
              تحديث الحالة
            </Button>
          </>
        )}

        {(phase === "enrolled" || phase === "topped_up") && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              {phase === "topped_up" ? "تم شحن المحفظة بنجاح" : "تم الشراء بنجاح!"}
            </h1>
            <p className="text-gray-600">
              {phase === "topped_up"
                ? "تمت إضافة الرصيد إلى محفظتك."
                : "جارٍ تحويلك..."}
            </p>
            <Button asChild className="w-full">
              <Link href={dest}>متابعة</Link>
            </Button>
          </>
        )}

        {phase === "credited_no_enroll" && (
          <>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <WalletIcon className="w-9 h-9 text-blue-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">تم شحن محفظتك</h1>
            <p className="text-gray-600">{message}</p>
            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link href={dest}>المتابعة للشراء</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/wallet/transactions">عرض المحفظة</Link>
              </Button>
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-9 h-9 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">تعذّر إتمام العملية</h1>
            <p className="text-gray-600">{message}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">العودة للرئيسية</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
