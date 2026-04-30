import { z } from "zod";

export const patchMeBody = z.object({
  displayName: z.string().min(1).max(100).optional(),
  language: z.enum(["ar", "en"]).optional(),
});

export type PatchMeBody = z.infer<typeof patchMeBody>;
