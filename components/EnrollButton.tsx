"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { enrollInFreeCourse } from "@/app/actions/enrollment_action";
import { Loader2, CheckCircle, ShoppingCart, LogIn } from "lucide-react";
import { useAuth } from "@/context/authContext";
import PaymentSelector from "@/components/paymentSelector";

interface EnrollButtonProps {
  courseId: string;
  courseTitle?: string; // Added for payment
  isFree: boolean;
  fullWidth?: boolean;
  priceIQD?: number;
}

export default function EnrollButton({
  courseId,
  courseTitle = "الدورة",
  isFree,
  fullWidth = false,
  priceIQD = 0,
}: EnrollButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const router = useRouter();
  const auth = useAuth();

  const handleEnroll = async () => {
    const user = auth?.user;
    if (!user) {
      router.push(`/login?redirect=/Course/${courseId}`);
      return;
    }

    // ✅ YOUR EXISTING LOGIC for free courses
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
      // ✅ NEW: Show payment dialog for paid courses
      setShowPaymentDialog(true);
    }
  };

  const handlePaymentSelect = async (method: "zaincash" | "areeba") => {
    setLoading(true);
    const user = auth?.user;

    try {
      if (!user) {
        toast.error("يرجى تسجيل الدخول");
        return;
      }

      const token = await user.getIdToken();

      // ✅ Call your payment init route
      const response = await fetch(`/api/payments/${method}/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          courseTitle,
          amount: priceIQD,
          token,
        }),
      });

      const data = await response.json();

      if (data.success && data.redirectUrl) {
        // ✅ Redirect to payment gateway
        window.location.href = data.redirectUrl;
      } else {
        toast.error("فشل في إنشاء جلسة الدفع", {
          description: data.error || "حدث خطأ",
        });
        setLoading(false);
      }
    } catch (error) {
      console.error("Payments error:", error);
      toast.error("خطأ", {
        description: "حدث خطأ أثناء معالجة الدفع",
      });
      setLoading(false);
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
            ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
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
              {priceIQD
                ? `شراء الدورة - ${priceIQD.toLocaleString()} IQD`
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

      {/* ✅ NEW: Payment dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-right">الدفع</DialogTitle>
          </DialogHeader>
          <PaymentSelector
            priceIQD={priceIQD}
            onSelect={handlePaymentSelect}
            loading={loading}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
