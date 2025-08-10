"use client";

import {
  SaveImages,
  SaveNewProperty,
  SaveQuickCourseCreation,
} from "@/app/course-upload/action";
import QuickCourseForm from "@/components/quick_course_form";
import { useAuth } from "@/context/authContext";
import { storage } from "@/firebase/client";
import {
  CourseDataSchema,
  QuickCourseSchema,
} from "@/validation/propertySchema";
import { ref, uploadBytesResumable, UploadTask } from "firebase/storage";
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
    router.push(`/course-upload/${response.courseId}/courseDashboard`); // ✅ Now this will work
  };

  const handleSubmit = async (data: z.infer<typeof CourseDataSchema>) => {
    const token = await auth?.user?.getIdToken();

    if (!token) {
      return;
    }
    const { images, ...rest } = data;
    // this isolate the images from the rest of the data

    const response = await SaveNewProperty({ ...rest, token });
    if (!!response.error || !response.courseId) {
      toast.error("حدث خطأ أثناء حفظ الدورة: ", {
        description: response.message || "يرجى المحاولة مرة أخرى.",
      });
      return;
    }
    const UploadImages: UploadTask[] = [];
    const paths: string[] = [];
    images?.forEach((image, index) => {
      if (image.file) {
        const path = `courses/${response.courseId}-${index}/${Date.now()}-${
          image.file?.name
        }`;
        paths.push(path);
        const storageRef = ref(storage, path);
        UploadImages.push(uploadBytesResumable(storageRef, image.file));
      }
      // this storage is from firebase/client.ts.. and any uploads from the user to the firebase storage will use the storage from the firebase/client.ts
    });
    await Promise.all(UploadImages);
    await SaveImages(
      {
        courseId: response.courseId,
        images: paths,
      },
      token
    );

    toast.success("تم حفظ الدورة بنجاح!", {
      description: "يمكنك الآن إدارة الدورة من لوحة التحكم.",
    });

    router.replace(`/course-upload/${response.courseId}/files`); // ✅ Now this will work

    console.log({ response });
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
