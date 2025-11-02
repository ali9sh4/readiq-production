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

  const handleEnroll = async () => {
    if (loading) return;
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
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();

      const response = await fetch(`/api/payments/${method}/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          courseTitle,
          amount: price,
          token,
        }),
      });

      const data = await response.json();

      if (data.success && data.redirectUrl) {
        // Success - redirect to payment gateway
        window.location.href = data.redirectUrl;
      } else {
        // Handle different error types with specific messages
        const errorMessage = data.error || "";

        if (errorMessage.includes("قيد المعالجة")) {
          toast.error("عملية دفع نشطة", {
            description:
              "لديك عملية دفع قيد المعالجة. يمكنك المحاولة مرة أخرى بعد 15 دقيقة أو إكمال الدفع السابق.",
            duration: 6000,
          });
        } else if (errorMessage.includes("مسجل بالفعل")) {
          toast.success("مسجل بالفعل!", {
            description: "أنت مسجل بالفعل في هذه الدورة",
            duration: 4000,
          });
          // Optionally refresh the page to show enrolled state
          setTimeout(() => router.refresh(), 2000);
        } else if (errorMessage.includes("سعر غير صحيح")) {
          toast.error("خطأ في السعر", {
            description: "يرجى تحديث الصفحة والمحاولة مرة أخرى",
            duration: 5000,
          });
        } else if (errorMessage.includes("مجانية")) {
          toast.info("دورة مجانية", {
            description: "هذه دورة مجانية، يمكنك الاشتراك بدون دفع",
            duration: 4000,
          });
        } else {
          // Generic error fallback
          toast.error("فشل في إنشاء جلسة الدفع", {
            description: errorMessage || "حدث خطأ غير متوقع",
            duration: 5000,
          });
        }

        setLoading(false);
        setShowPaymentDialog(false);
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("خطأ في الاتصال", {
        description:
          "حدث خطأ أثناء معالجة الدفع. يرجى التحقق من اتصال الإنترنت",
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
              {price
                ? `شراء الدورة - ${price.toLocaleString()} IQD`
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
          <PaymentSelector
            price={price ?? 0}
            onSelect={handlePaymentSelect}
            loading={loading}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
