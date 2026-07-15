import { z } from "zod";

// Input schemas for app/actions/qa_review_actions.ts. Arabic issue messages —
// the client surfaces the first issue verbatim via lib/qa/localizeError.ts
// (same convention as validation/sectional.ts).

export const ApprovePairSchema = z.object({
  qaDocId: z.string().min(1, "معرّف السؤال مفقود"),
  // 2026-07-14 (owner decision): numericConfirmed removed — approval is
  // one-tap; the numeric quarantine class remains as classification/badge
  // only. See docs/AUDIT_MCQ_TRANSFORM.md قرارات decision 4 amendment.
});

export const BulkApproveSchema = z.object({
  videoId: z.string().min(1, "معرّف الفيديو مفقود"),
});

export const RejectPairSchema = z.object({
  qaDocId: z.string().min(1, "معرّف السؤال مفقود"),
  // Invariant 5: rejection always carries a reason and never deletes.
  rejectReason: z
    .string()
    .trim()
    .min(1, "سبب الرفض مطلوب")
    .max(1000, "سبب الرفض طويل جداً"),
});

export const EditPairSchema = z.object({
  qaDocId: z.string().min(1, "معرّف السؤال مفقود"),
  question: z
    .string()
    .trim()
    .min(1, "السؤال لا يمكن أن يكون فارغاً")
    .max(2000, "السؤال طويل جداً"),
  answer: z
    .string()
    .trim()
    .min(1, "الجواب لا يمكن أن يكون فارغاً")
    .max(8000, "الجواب طويل جداً"),
});

export const RevokeApprovalSchema = z.object({
  qaDocId: z.string().min(1, "معرّف السؤال مفقود"),
});
