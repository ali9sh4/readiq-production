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
  price: z.coerce.number().min(0),
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
export const ThumbnailUpdateSchema = z.object({
  image: z
    .object({
      id: z.string(),
      url: z.string(),
      file: z.instanceof(File).optional(),
      isExisting: z.boolean().optional(),
    })
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

// Basic Info Schema
export const BasicInfoSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب").min(10, "العنوان قصير جداً"),
  subtitle: z.string().optional(),
  instructorName: z.string().optional(),
  description: z.string().optional(),
  category: z.string().min(1, "التصنيف مطلوب"),
  level: z.enum(["beginner", "intermediate", "advanced", "all_levels"]),
  language: z.enum(["arabic", "english", "french", "spanish"]),
});

// Time-limited access duration: 90 | 180 | 365 days, or null/absent for
// lifetime. Server boundary re-validates in updateCoursePricing, which
// also rejects the field on sectional courses and on courses inside a
// package (mutual exclusivity). Kept as number().refine() rather than a
// literal union so the inferred form type stays `number | null` — the
// literal union breaks react-hook-form's resolver generics and mismatches
// Course.accessDurationDays (a plain number).
export const AccessDurationDaysSchema = z
  .number()
  .nullable()
  // `: boolean` matters: without it TS 5.5+ infers a type predicate from
  // this expression and zod narrows the output type back to the literal
  // union, breaking the form generics.
  .refine((v): boolean => v === null || v === 90 || v === 180 || v === 365, {
    message: "مدة الوصول يجب أن تكون ٩٠ أو ١٨٠ أو ٣٦٥ يومًا",
  });

// Pricing Schema
export const PricingSchema = z
  .object({
    price: z.coerce.number().min(0, "السعر يجب أن يكون صفر أو أكثر"),
    salePrice: z.coerce.number().min(0).optional(),
    accessDurationDays: AccessDurationDaysSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.salePrice && data.salePrice >= data.price) {
        return false;
      }
      return true;
    },
    {
      message: "يجب أن يكون سعر البيع أقل من السعر الأصلي",
      path: ["salePrice"],
    }
  );

export const CourseDataSchema = CourseSchema.and(ImageSchema);
export const QuickCourseSchemaThumbNail = QuickCourseSchema.and(
  ThumbnailUpdateSchema
);
