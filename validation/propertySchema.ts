// validation/courseSchema.ts
import { z } from "zod";
export const QuickCourseSchema = z.object({
  // REQUIRED FIELDS (5 only)
  title: z
    .string()
    .min(1, "يجب إدخال عنوان الدورة")
    .min(10, "يجب أن يحتوي العنوان على 10 أحرف على الأقل"),
  category: z.string().min(1, "يجب اختيار تصنيف الدورة"),
  level: z
    .enum(["beginner", "intermediate", "advanced", "all_levels"])
    .default("all_levels"),
  price: z.coerce.number().min(0).default(0),
  description: z.string().optional(), // Optional but shown in form
});

export const CourseSchema = z.object({
  title: z
    .string()
    .min(1, "يجب إدخال عنوان الدورة")
    .min(10, "يجب أن يحتوي العنوان على 10 أحرف على الأقل"),
  category: z.string().min(1, "يجب اختيار تصنيف الدورة"),
  level: z.enum(["beginner", "intermediate", "advanced", "all_levels"]),
  price: z.coerce.number().min(0, "يجب أن يكون السعر صفرًا أو أكثر"),
  description: z.string().min(50, "يجب أن يحتوي الوصف على 50 حرفًا على الأقل"),

  subtitle: z.string().optional(),

  language: z.enum(["arabic", "english", "french", "spanish"]).optional(),
  duration: z.coerce
    .number()
    .min(0, "يجب أن تكون المدة صفرًا أو أكثر")
    .optional(),
  learningPoints: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
});

export const ImageSchema = z.object({
  images: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        file: z.instanceof(File).optional(), // Optional for images (might be existing URLs)
      })
    )
    .optional(),
});

export const FileSchema = z.object({
  files: z
    .array(
      z.object({
        id: z.string(),
        file: z.instanceof(File), // Required for new uploads
        name: z.string().min(1, "اسم الملف مطلوب"), // ✅ Added name field
        size: z
          .number()
          .min(1, "حجم الملف يجب أن يكون أكبر من صفر")
          .max(10 * 1024 * 1024, "حجم الملف يجب أن يكون أقل من 10 ميجابايت"),
        type: z.string().min(1, "نوع الملف مطلوب"),
        // ✅ Removed url field (not needed for files)
      })
    )
    .max(10, "يمكنك تحميل ما يصل إلى 10 ملفات فقط")
    .optional(),
});

export const CourseDataSchema = CourseSchema.and(ImageSchema);
