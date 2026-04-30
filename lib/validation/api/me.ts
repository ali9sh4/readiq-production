import { z } from "zod";

export const patchMeBody = z
  .object({
    displayName: z.string().min(1).max(100).optional(),
    language: z.enum(["ar", "en"]).optional(),
  })
  .refine(
    (data) => data.displayName !== undefined || data.language !== undefined,
    { message: "At least one field must be provided" }
  );

export type PatchMeBody = z.infer<typeof patchMeBody>;
