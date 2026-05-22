import { z } from "zod";

// Zod schemas for the course-packages feature. Used at the action /
// route boundary in later phases; Phase 1 only defines them.

export const packageStatusSchema = z.enum(["draft", "active", "archived"]);

// Admin create/edit payload for a package.
//
// `courseIds` allows a single course at the schema level so a draft can be
// built up incrementally; the "a package needs >= 2 courses to go active"
// rule is enforced in the admin action (it depends on `status`).
// Amounts are whole IQD (no minor units), so every money field is an int.
// `payouts` is a map of instructor uid -> agreed payout; the "sum of
// payouts vs price" warning is computed in the admin UI/action, not here.
export const packageInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  thumbnailUrl: z.string().url().optional(),
  courseIds: z.array(z.string().min(1)).min(1),
  price: z.number().int().positive(),
  payouts: z.record(z.string().min(1), z.number().int().nonnegative()),
  status: packageStatusSchema,
});

export type PackageInput = z.infer<typeof packageInputSchema>;

// Admin payload to record a manual out-of-band payout to an instructor.
export const recordPayoutSchema = z.object({
  instructorId: z.string().min(1),
  amount: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
});

export type RecordPayoutInput = z.infer<typeof recordPayoutSchema>;
