import { z } from "zod";

export const createEnrollmentBody = z.object({
  courseId: z.string().min(1),
});

export type CreateEnrollmentBody = z.infer<typeof createEnrollmentBody>;
