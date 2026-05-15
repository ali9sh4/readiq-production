// Zod schemas for sectional purchasing config updates (Phase 5a).
//
// Used by `app/actions/sectional_config_actions.ts` to validate the
// `update` payload before running it through the lock helper. Each field
// is independently optional so the editor can PATCH-style partial updates
// (e.g. flip `purchaseMode` without re-sending every section).

import { z } from "zod";

const SectionInputSchema = z.object({
  sectionId: z.string().min(1).optional(),
  title: z.string().min(1, "عنوان القسم مطلوب"),
  order: z
    .number()
    .int("ترتيب القسم يجب أن يكون عددًا صحيحًا")
    .min(0, "ترتيب القسم يجب أن يكون صفرًا أو أكثر"),
  price: z.number().min(0, "السعر يجب أن يكون صفرًا أو أكثر").optional(),
  salePrice: z
    .number()
    .min(0, "سعر التخفيض يجب أن يكون صفرًا أو أكثر")
    .optional(),
});

export const SectionalConfigSchema = z
  .object({
    purchaseMode: z.enum(["full", "sectional"]).optional(),
    fullCoursePrice: z
      .number()
      .min(0, "سعر الحزمة الكاملة يجب أن يكون صفرًا أو أكثر")
      .optional(),
    sections: z.array(SectionInputSchema).optional(),
  })
  .refine(
    (data) => {
      if (!data.sections) return true;
      const ids = data.sections
        .map((s) => s.sectionId)
        .filter((id): id is string => typeof id === "string");
      return new Set(ids).size === ids.length;
    },
    { message: "تكرر معرّف قسم (sectionId) في الإدخال", path: ["sections"] }
  )
  .refine(
    (data) => {
      if (!data.sections) return true;
      return data.sections.every(
        (s) =>
          s.salePrice === undefined ||
          s.price === undefined ||
          s.salePrice < s.price
      );
    },
    {
      message: "يجب أن يكون سعر التخفيض أقل من السعر الأصلي لكل قسم",
      path: ["sections"],
    }
  );

export type SectionalConfigInput = z.infer<typeof SectionalConfigSchema>;
