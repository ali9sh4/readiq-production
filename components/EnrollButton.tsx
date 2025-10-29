"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner"; // ✅ Better than alert
import { Button } from "@/components/ui/button";
import { enrollInFreeCourse } from "@/app/actions/enrollment_action";
import { Loader2, CheckCircle, ShoppingCart, LogIn } from "lucide-react";
import { useAuth } from "@/context/authContext";

interface EnrollButtonProps {
  courseId: string;
  isFree: boolean;
  fullWidth?: boolean;
  price?: number; // Optional: for displaying price
}

export default function EnrollButton({
  courseId,
  isFree,
  fullWidth = false,
  price,
}: EnrollButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const auth = useAuth();

  const handleEnroll = async () => {
    const user = auth?.user;
    if (!user) {
      router.push(`/login?redirect=/Course/${courseId}`);
      return;
    }

    setLoading(true);

    try {
      if (isFree) {
        // Handle free enrollment
        const token = await user.getIdToken();
        const result = await enrollInFreeCourse(courseId, token);

        if (result.success) {
          // ✅ MY APPROACH: Toast instead of alert
          toast.success("تم الاشتراك بنجاح!", {
            description: "يمكنك الآن الوصول إلى جميع دروس الدورة",
          });
          // Refresh to show CoursePlayer
          router.refresh();
        } else {
          toast.error("فشل الاشتراك", {
            description: result.message || "حدث خطأ أثناء الاشتراك",
          });
        }
      } else {
        // ✅ MY APPROACH: Redirect to checkout for paid courses
        router.push(`/checkout/${courseId}`);
      }
    } catch (error) {
      console.error("Enrollment error:", error);
      toast.error("خطأ", {
        description: "حدث خطأ غير متوقع أثناء الاشتراك",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
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
          جاري الاشتراك...
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
            {price ? `شراء الدورة - $${price}` : "شراء الدورة"}
          </>
        )
      ) : (
        <>
          <LogIn className="w-5 h-5 ml-2" />
          سجل الدخول للاشتراك
        </>
      )}
    </Button>
  );
}
