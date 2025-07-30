"use client";

import CourseForm from "@/components/ui/property-form";
import { CourseDataSchema } from "@/validation/propertySchema";
import z from "zod";
import { UpdateCourse } from "./action";
import { useAuth } from "@/context/authContext";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PlusCircleIcon } from "lucide-react";
import {
  deleteObject,
  ref,
  uploadBytesResumable,
  UploadTask,
} from "firebase/storage";
import { storage } from "@/firebase/client";
import { SaveImages } from "./action";

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
  images?: string[];
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
  images = [],
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
      const { images: newImages = [], ...rest } = data;

      const response = await UpdateCourse({
        ...rest,
        id: id, // ✅ Required id from props
        token: token,
      });

      if (response.error) {
        toast.error("خطأ في تحديث الدورة", {
          description: response.message,
        });
        return;
      }

      const storageTask: (UploadTask | Promise<void>)[] = [];
      const imagesToDelete = images.filter(
        (image) => !newImages.find((newImage) => image === newImage.url)
      );
      imagesToDelete.forEach((image) =>
        storageTask.push(deleteObject(ref(storage, image)))
      );
      // these paths is the array of images in the firebase database
      // and it is reference to our uploaded images in the firebase storage
      const paths: string[] = [];
      newImages.forEach((image, index) => {
        if (image.file) {
          const path = `courses/${response.courseId}-${index}/${Date.now()}-${
            image.file?.name
          }`;
          paths.push(path);
          const storageRef = ref(storage, path);
          storageTask.push(uploadBytesResumable(storageRef, image.file));
        } else {
        }
      });
      Promise.all(storageTask);
      await SaveImages(
        {courseId: id , images:paths},
        token

      )


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
          images: images.map((image) => ({
            id: image, // Assuming images are just URLs or IDs
            url: image, // Adjust based on your actual image structure
          })),
        }}
      />
    </div>
  );
}
