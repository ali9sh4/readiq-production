"use client";

import { SaveQuickCourseCreation } from "@/app/course-upload/action";
import QuickCourseForm from "@/components/quick_course_form";
import { useAuth } from "@/context/authContext";
import { QuickCourseSchema } from "@/validation/courseSchema";
import { PlusCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { useState } from "react"; // ✅ Changed from useRef

export default function NewPropertyForm() {
  const auth = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false); // ✅ Use state instead

  const handelSubmitQuickCourseCreation = async (
    data: z.infer<typeof QuickCourseSchema>
  ) => {
    setIsSubmitting(true); // ✅ Set state

    try {
      const token = await auth?.user?.getIdToken();
      if (!token) {
        toast.error("خطأ في المصادقة", {
          description: "يرجى تسجيل الدخول مرة أخرى",
        });
        return;
      }

      const response = await SaveQuickCourseCreation({ ...data, token });

      if (!!response.error || !response.courseId) {
        toast.error("حدث خطأ أثناء حفظ الدورة", {
          description: response.message || "يرجى المحاولة مرة أخرى.",
        });
        return;
      }

      toast.success("✅ تم إنشاء الدورة بنجاح!", {
        description: "جاري الانتقال إلى لوحة التحكم...",
      });

      router.push(`/course-upload/edit/${response.courseId}/`);
    } catch (error) {
      console.error("Error creating course:", error);
      toast.error("حدث خطأ غير متوقع", {
        description: "يرجى المحاولة مرة أخرى",
      });
    } finally {
      setIsSubmitting(false); // ✅ Always reset
    }
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
