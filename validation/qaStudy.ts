import { z } from "zod";

// Input schema for app/actions/qa_study_actions.ts. Arabic issue messages —
// the client surfaces the first issue verbatim via lib/qa/localizeError.ts
// (same convention as validation/qaReview.ts).

export const ListStudyDeckSchema = z.object({
  courseId: z.string().min(1, "معرّف الكورس مفقود"),
  videoId: z.string().min(1, "معرّف الفيديو مفقود"),
});
