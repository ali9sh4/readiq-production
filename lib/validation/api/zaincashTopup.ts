import { z } from "zod";
import {
  ZAINCASH_TOPUP_MIN_IQD,
  ZAINCASH_TOPUP_MAX_IQD,
} from "@/lib/payments/zaincashTopup";

// Mirrors the `TopupIntent` union in types/wallets.ts. Validated at the API
// boundary so a malformed intent can never be stored on a pending doc.
export const topupIntent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("course"), courseId: z.string().min(1) }),
  z.object({ kind: z.literal("bundle"), courseId: z.string().min(1) }),
  z.object({
    kind: z.literal("sections"),
    courseId: z.string().min(1),
    sectionIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({ kind: z.literal("package"), packageId: z.string().min(1) }),
]);

export const topupInitBody = z.object({
  amount: z
    .number()
    .int()
    .min(ZAINCASH_TOPUP_MIN_IQD)
    .max(ZAINCASH_TOPUP_MAX_IQD),
  // Optional — a plain top-up (no deferred enrollment) omits it / sends "none".
  intent: topupIntent.optional(),
});

export type TopupInitBody = z.infer<typeof topupInitBody>;
