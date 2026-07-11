"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { enrollInFreeCourse } from "@/app/actions/enrollment_action";
import {
  Loader2,
  CheckCircle,
  ShoppingCart,
  LogIn,
  Clock,
  RefreshCw,
} from "lucide-react";
import { formatAccessDurationArabic } from "@/lib/courses/accessDuration";
import { useAuth } from "@/context/authContext";
import PaymentSelector from "@/components/paymentSelector";
import { generateProtectionKey } from "@/lib/purchaseProtection/protectionKey";
import { purchaseCourseWithWallet } from "@/app/actions/wallet_actions";
import {
  startZainCashTopup,
  ZAINCASH_TOPUP_MIN_IQD,
} from "@/lib/payments/startZainCashTopup";

interface EnrollButtonProps {
  courseId: string;
  courseTitle?: string;
  isFree: boolean;
  fullWidth?: boolean;
  price?: number;
  // Time-limited access: the course's accessDurationDays. Drives the
  // consent badge shown at the moment of purchase (button caption + the
  // payment dialog). Unset/null = lifetime.
  accessDurationDays?: number | null;
  // Renewal mode: same purchase flow, but the enrollment is an expired
  // (or expiring) time-limited one — the server re-stamps the same doc.
  // Changes the label to تجديد الوصول and the success copy.
  renewal?: boolean;
}

export default function EnrollButton({
  courseId,
  courseTitle = "الدورة",
  isFree,
  fullWidth = false,
  price,
  accessDurationDays = null,
  renewal = false,
}: EnrollButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const router = useRouter();
  const auth = useAuth();
  const protectionKeyRef = useRef<string | null>(null);

  const handleEnroll = async () => {
    if (loading) return;
    const user = auth?.user;
    if (!user) {
      router.push(`/login?redirect=/course/${courseId}`);
      return;
    }

    if (isFree) {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const result = await enrollInFreeCourse(courseId, token);

        if (result.success) {
          toast.success(renewal ? "تم تجديد وصولك بنجاح!" : "تم الاشتراك بنجاح!", {
            description: "يمكنك الآن الوصول إلى جميع دروس الدورة",
          });
          router.refresh();
        } else {
          toast.error("فشل الاشتراك", {
            description: result.message || "حدث خطأ أثناء الاشتراك",
          });
        }
      } catch (error) {
        console.error("Enrollment error:", error);
        toast.error("خطأ", {
          description: "حدث خطأ غير متوقع أثناء الاشتراك",
        });
      } finally {
        setLoading(false);
      }
    } else {
      protectionKeyRef.current = generateProtectionKey(
        user.uid,
        courseId,
        "purchase"
      );
      setShowPaymentDialog(true);
    }
  };

  const handlePaymentSelect = async (
    method: "zaincash" | "areeba" | "wallet"
  ) => {
    setLoading(true);
    const user = auth?.user;

    try {
      if (!user) {
        toast.error("يرجى تسجيل الدخول");
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();
      if (method === "wallet") {
        if (!protectionKeyRef.current) {
          throw new Error("Protection key not generated");
        }

        const result = await purchaseCourseWithWallet(
          token,
          courseId,
          protectionKeyRef.current
        );

        if (result.success) {
          if (result.isDuplicate) {
            toast.info("لقد قمت بشراء هذه الدورة مسبقاً");
          } else {
            toast.success(
              renewal ? "تم تجديد وصولك بنجاح!" : "تم شراء الدورة بنجاح!"
            );
          }

          setShowPaymentDialog(false);
          setLoading(false);

          setTimeout(() => {
            router.push(`/course/${courseId}`);
            router.refresh();
          }, 1500);
        } else {
          throw new Error(result.error || "فشل في شراء الدورة");
        }

        return;
      }

      // ZainCash now funds the WALLET, not the frozen direct pay-per-course
      // route. Top up the shortfall (carrying a course intent), then the wallet
      // completes the enrollment automatically when the user returns.
      if (method === "zaincash") {
        const coursePrice = price ?? 0;

        const walletRes = await fetch("/api/wallet", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const walletJson = await walletRes.json().catch(() => null);
        const balance = Number(walletJson?.data?.balance ?? 0);
        const shortfall = Math.max(0, coursePrice - balance);

        if (shortfall <= 0) {
          // Wallet already covers it — buy straight from the wallet.
          if (!protectionKeyRef.current) {
            throw new Error("Protection key not generated");
          }
          const result = await purchaseCourseWithWallet(
            token,
            courseId,
            protectionKeyRef.current
          );
          if (result.success) {
            toast.success(
              result.isDuplicate
                ? "لقد قمت بشراء هذه الدورة مسبقاً"
                : "تم شراء الدورة بنجاح!"
            );
            setShowPaymentDialog(false);
            setLoading(false);
            setTimeout(() => {
              router.push(`/course/${courseId}`);
              router.refresh();
            }, 1500);
          } else {
            throw new Error(result.error || "فشل في شراء الدورة");
          }
          return;
        }

        // Top up the shortfall (clamped to the minimum), then redirect to
        // ZainCash. The intent is stored server-side; on return the bridge
        // page finishes the purchase via the wallet.
        const topupAmount = Math.max(shortfall, ZAINCASH_TOPUP_MIN_IQD);
        await startZainCashTopup(token, {
          amount: topupAmount,
          intent: { kind: "course", courseId },
        });
        return;
      }

      // No other gateway is enabled.
      toast.error("طريقة الدفع غير متاحة حالياً");
      setLoading(false);
      setShowPaymentDialog(false);
    } catch (error) {
      console.error("Payment error:", error);

      const errorMessage =
        error instanceof Error ? error.message : "حدث خطأ أثناء معالجة الدفع";

      toast.error(errorMessage, {
        duration: 5000,
      });

      setLoading(false);
      setShowPaymentDialog(false);
    }
  };

  // Consent copy: what access this purchase grants. Shown next to the
  // button AND inside the payment dialog — the page badge alone is not
  // enough at the moment of payment.
  const accessBadgeText = accessDurationDays
    ? `الوصول لمدة ${formatAccessDurationArabic(
        accessDurationDays
      )} من تاريخ الشراء`
    : "وصول دائم";

  return (
    <>
      <Button
        onClick={handleEnroll}
        disabled={loading}
        size="lg"
        className={`${fullWidth ? "w-full" : ""} ${
          isFree
            ? "bg-green-600 hover:bg-green-700"
            : "bg-blue-600 hover:bg-blue-700"
        } text-white font-bold shadow-lg hover:shadow-xl transition-all`}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin ml-2" />
            جاري المعالجة...
          </>
        ) : auth?.user ? (
          renewal ? (
            <>
              <RefreshCw className="w-5 h-5 ml-2" />
              {!isFree && price
                ? `تجديد الوصول - ${price.toLocaleString("en-US")} IQD`
                : "تجديد الوصول"}
            </>
          ) : isFree ? (
            <>
              <CheckCircle className="w-5 h-5 ml-2" />
              اشترك مجاناً
            </>
          ) : (
            <>
              <ShoppingCart className="w-5 h-5 ml-2" />
              {price
                ? `شراء الدورة - ${price.toLocaleString("en-US")} IQD`
                : "شراء الدورة"}
            </>
          )
        ) : (
          <>
            <LogIn className="w-5 h-5 ml-2" />
            سجل الدخول للاشتراك
          </>
        )}
      </Button>

      {/* Consent line at the button (free enrollments have no dialog, so
          this is their moment of informed consent). */}
      {accessDurationDays ? (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-amber-700 font-medium text-center">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          {accessBadgeText}
        </p>
      ) : null}

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          {/* Access-duration badge at the payment-confirm moment. */}
          <div
            dir="rtl"
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
              accessDurationDays
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>{accessBadgeText}</span>
          </div>
          <PaymentSelector
            price={price || 0}
            onSelect={handlePaymentSelect}
            loading={loading}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
