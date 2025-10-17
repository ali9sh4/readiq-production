"use client";

import { SaveQuickCourseCreation } from "@/app/course-upload/action";
import QuickCourseForm from "@/components/quick_course_form";
import { useAuth } from "@/context/authContext";
import { QuickCourseSchema } from "@/validation/propertySchema";
import { PlusCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation"; // ✅ Correct import
import { toast } from "sonner";
import z from "zod";

export default function NewPropertyForm() {
  const auth = useAuth();
  const router = useRouter(); // ✅ Use the hook
  const handelSubmitQuickCourseCreation = async (
    data: z.infer<typeof QuickCourseSchema>
  ) => {
    const token = await auth?.user?.getIdToken();
    if (!token) {
      return;
    }
    const response = await SaveQuickCourseCreation({ ...data, token });
    if (!!response.error || !response.courseId) {
      toast.error("حدث خطأ أثناء حفظ الدورة السريعة: ", {
        description: response.message || "يرجى المحاولة مرة أخرى.",
      });
      return;
    }
    toast.success("تم حفظ الدورة السريعة بنجاح!", {
      description: "يمكنك الآن إدارة الدورة من لوحة التحكم.",
    });
    router.push(`/course-upload/edit/${response.courseId}/`); // ✅ Now this will work
  };

  return (
    <div>
      <QuickCourseForm
        submitButtonLabel={
          <div dir="rtl" className="flex items-center gap-2">
            <PlusCircleIcon className="w-4 h-4" />
            <span>إنشاء دورة سريعة</span>
          </div>
        }
        handleSubmit={handelSubmitQuickCourseCreation}
      />
    </div>
  );
}

///courseForm is the old way
