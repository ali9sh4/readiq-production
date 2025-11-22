"use client";

import { SaveQuickCourseCreation } from "@/app/course-upload/action";
import QuickCourseForm from "@/components/quick_course_form";
import { useAuth } from "@/context/authContext";
import { QuickCourseSchema } from "@/validation/courseSchema";
import { PlusCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { useRef } from "react";

export default function NewPropertyForm() {
  const auth = useAuth();
  const router = useRouter();
  const isNavigatingRef = useRef(false); // ✅ Track if navigating

  const handelSubmitQuickCourseCreation = async (
    data: z.infer<typeof QuickCourseSchema>
  ) => {
    

    try {
      const token = await auth?.user?.getIdToken();
      if (!token) {
        toast.error("خطأ في المصادقة", {
          description: "يرجى تسجيل الدخول مرة أخرى",
        });
        return;
      }

      const response = await SaveQuickCourseCreation({ ...data, token });

      // ✅ Check for error response
      if ("error" in response && response.error) {
        toast.error("حدث خطأ أثناء حفظ الدورة", {
          description: response.message || "يرجى المحاولة مرة أخرى.",
        });
        return;
      }

      // ✅ Check for courseId
      if (!("courseId" in response) || !response.courseId) {
        toast.error("حدث خطأ أثناء حفظ الدورة", {
          description: "لم يتم إنشاء معرف الدورة",
        });
        return;
      }

      // ✅ Success - mark as navigating to block any further attempts
      isNavigatingRef.current = true;

      toast.success("✅ تم إنشاء الدورة بنجاح!", {
        description: "جاري الانتقال إلى لوحة التحكم...",
      });

      // ✅ Navigate after showing success message
      setTimeout(() => {
        router.push(`/course-upload/edit/${response.courseId}/`);
      }, 500);
    } catch (error) {
      console.error("Error creating course:", error);
      toast.error("حدث خطأ غير متوقع", {
        description: "يرجى المحاولة مرة أخرى",
      });
      // ✅ On error, allow retry
      isNavigatingRef.current = false;
    }
    // ✅ No finally block needed - if success, we're navigating away anyway
  };

  return (
    <div>
      <QuickCourseForm
        submitButtonLabel={
          <div dir="rtl" className="flex items-center gap-2">
            <PlusCircleIcon className="w-4 h-4" />
            <span>إنشاء دورة جديدة</span>
          </div>
        }
        handleSubmit={handelSubmitQuickCourseCreation}
      />
    </div>
  );
}
