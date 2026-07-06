import { z } from "zod";

// Input schema for app/actions/qa_study_actions.ts. Arabic issue messages —
// the client surfaces the first issue verbatim via lib/qa/localizeError.ts
// (same convention as validation/qaReview.ts).

export const ListStudyDeckSchema = z.object({
  courseId: z.string().min(1, "معرّف الكورس مفقود"),
  videoId: z.string().min(1, "معرّف الفيديو مفقود"),
});

// Slice 6 — study telemetry events (§7.3 of docs/RUBIK_STUDY_FEATURES.md).
// `grade` travels with selfGrade only; `elapsedMs` is optional recall
// latency (question shown → reveal), capped at 24 h to keep garbage out.
export const LogStudyEventSchema = z
  .object({
    courseId: z.string().min(1, "معرّف الكورس مفقود"),
    videoId: z.string().min(1, "معرّف الفيديو مفقود"),
    qaDocId: z.string().min(1, "معرّف السؤال مفقود"),
    kind: z.enum(["revealed", "selfGrade", "jumpToSource"]),
    grade: z.enum(["yes", "no"]).optional(),
    elapsedMs: z.number().int().nonnegative().max(86_400_000).optional(),
  })
  .refine((v) => (v.kind === "selfGrade") === (v.grade !== undefined), {
    message: "grade يُرسل مع selfGrade فقط",
  });
