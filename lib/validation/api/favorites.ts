import { z } from "zod";

export const addFavoriteBody = z.object({
  courseId: z.string().min(1),
});

export type AddFavoriteBody = z.infer<typeof addFavoriteBody>;

export const courseIdPath = z.object({
  courseId: z.string().min(1),
});
