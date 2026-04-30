import { z } from "zod";
import { paginationQuery } from "./pagination";

export const listCoursesQuery = paginationQuery.extend({
  category: z.string().min(1).optional(),
  level: z
    .enum(["beginner", "intermediate", "advanced", "all_levels"])
    .optional(),
  language: z.enum(["arabic", "english", "french", "spanish"]).optional(),
});

export type ListCoursesQuery = z.infer<typeof listCoursesQuery>;
