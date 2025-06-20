// validation/courseSchema.ts
import { z } from "zod";

export const CourseDataSchema = z.object({
  title: z
    .string()
    .min(1, "يجب إدخال عنوان الدورة")
    .min(10, "يجب أن يحتوي العنوان على 10 أحرف على الأقل"),
  subtitle: z
    .string()
    .optional(),
  category: z
    .string()
    .min(1, "يجب اختيار تصنيف الدورة"),
  price: z
    .coerce.number()
    .min(0, "يجب أن يكون السعر صفرًا أو أكثر"),
  description: z
    .string()
    .min(50, "يجب أن يحتوي الوصف على 50 حرفًا على الأقل"),
  level: z.enum([
    "beginner",
    "intermediate", 
    "advanced",
    "all_levels"
  ]),
  language: z.enum([
    "arabic",
    "english",
    "french",
    "spanish"
  ]),
  duration: z
    .coerce.number()
    .min(0, "يجب أن تكون المدة صفرًا أو أكثر"),
  // Add these new fields:
  learningPoints: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  image: z.string().optional(),
});