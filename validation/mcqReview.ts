import { z } from "zod";

// Input schemas for app/actions/mcq_review_actions.ts. Arabic issue messages —
// the client surfaces the first issue verbatim via lib/qa/localizeError.ts
// (same convention as validation/qaReview.ts).
//
// Deliberately ABSENT: any correctAnswer field. The key is never editable on
// an MCQ (docs/AUDIT_MCQ_TRANSFORM.md §3) — fixing a wrong key means fixing
// the source pair and re-running the transform. Also absent: any bulk
// schema — MCQ approval is individual-only (قرارات المالك decision 2).

export const ApproveMcqSchema = z.object({
  mcqDocId: z.string().min(1, "معرّف السؤال مفقود"),
  // 2026-07-14 (owner decision): numericConfirmed removed — approval is
  // one-tap; the numeric quarantine class remains as classification/badge
  // only. See docs/AUDIT_MCQ_TRANSFORM.md قرارات decision 4 amendment.
});

export const RejectMcqSchema = z.object({
  mcqDocId: z.string().min(1, "معرّف السؤال مفقود"),
  // Rejection always carries a reason and never deletes (invariant-5 grammar).
  rejectReason: z
    .string()
    .trim()
    .min(1, "سبب الرفض مطلوب")
    .max(1000, "سبب الرفض طويل جداً"),
});

export const EditMcqSchema = z.object({
  mcqDocId: z.string().min(1, "معرّف السؤال مفقود"),
  stem: z
    .string()
    .trim()
    .min(1, "نص السؤال لا يمكن أن يكون فارغاً")
    .max(2000, "نص السؤال طويل جداً"),
  distractors: z
    .array(
      z
        .string()
        .trim()
        .min(1, "الخيار لا يمكن أن يكون فارغاً")
        .max(2000, "الخيار طويل جداً")
    )
    .length(3, "ثلاثة بدائل بالضبط"),
});

export const RevokeMcqApprovalSchema = z.object({
  mcqDocId: z.string().min(1, "معرّف السؤال مفقود"),
});
