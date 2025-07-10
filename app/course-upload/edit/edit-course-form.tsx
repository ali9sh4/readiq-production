"use client";

import CourseForm from "@/components/ui/property-form";
import { CourseDataSchema } from "@/validation/propertySchema";
import z from "zod";
import { UpdateCourse } from "./action";
import { useAuth } from "@/context/authContext";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PlusCircleIcon } from "lucide-react";

type Props = {
  id: string; // ✅ Required since we're editing
  title?: string;
  subtitle?: string;
  category?: string;
  price?: number;
  description?: string;
  level?: "beginner" | "intermediate" | "advanced" | "all_levels";
  language?: "arabic" | "english" | "french" | "spanish";
  duration?: number;
  requirements?: string[];
  learningPoints?: string[];
  label?: string;
};

export default function EditCourseForm({
  id, // ✅ Required parameter
  title = "",
  subtitle = "",
  category = "",
  price = 0,
  description = "",
  level = "beginner",
  language = "arabic",
  duration = 0,
  requirements = [],
  learningPoints = [],
}: Props) {
  const auth = useAuth();
  const router = useRouter();

  const handleSubmit = async (
    data: z.infer<typeof CourseDataSchema> // ✅ Removed optional id
  ) => {
    try {
      // ✅ Proper error handling with toast
      const token = await auth?.user?.getIdToken();
      if (!token) {
        toast.error("يجب تسجيل الدخول أولاً", {
          description: "لم يتم العثور على رمز المصادقة",
        });
        return;
      }

      const response = await UpdateCourse({
        ...data,
        id: id, // ✅ Required id from props
        token: token,
      });

      if (response.error) {
        toast.error("خطأ في تحديث الدورة", {
          description: response.message,
        });
        return;
      }

      // ✅ Success handling
      toast.success("تم تعديل الدورة بنجاح!", {
        description: "يمكنك الآن إدارة الدورة من لوحة التحكم.",
      });
      router.push(`/course-upload`);
    } catch (error) {
      console.error("Error updating course:", error);
      toast.error("خطأ غير متوقع", {
        description: "حدث خطأ أثناء تحديث الدورة",
      });
    }
  };

  return (
    <div>
      <CourseForm
        handleSubmit={handleSubmit}
        submitButtonLabel={
          <div dir="rtl" className="flex items-center gap-2">
            <PlusCircleIcon className="w-4 h-4" />
            <span>تحديث الدورة</span>
          </div>
        }
        defaultValues={{
          title,
          subtitle,
          category,
          price,
          description,
          level,
          language,
          duration,
          requirements,
          learningPoints,
        }}
      />
    </div>
  );
}
