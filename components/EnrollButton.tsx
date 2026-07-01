"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { enrollInFreeCourse } from "@/app/actions/enrollment_action";
import { Loader2, CheckCircle, ShoppingCart, LogIn } from "lucide-react";
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
}

export default function EnrollButton({
  courseId,
  courseTitle = "الدورة",
  isFree,
  fullWidth = false,
  price,
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
          toast.success("تم الاشتراك بنجاح!", {
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
            toast.success("تم شراء الدورة بنجاح!");
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
          isFree ? (
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

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-[425px]">
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
