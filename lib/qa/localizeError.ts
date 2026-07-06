// Arabic localization for Q&A review + study action failures — parallel to
// lib/sectional/localizeError.ts (that one is type-bound to the sectional
// unions; widening it would couple unrelated features).
import type { QaReviewFailure } from "@/app/actions/qa_review_actions";
import type { QaStudyFailure } from "@/app/actions/qa_study_actions";

function firstZodIssueMessage(details: unknown): string | null {
  if (
    details &&
    typeof details === "object" &&
    "issues" in details &&
    Array.isArray((details as { issues: unknown }).issues)
  ) {
    const first = (details as { issues: Array<{ message?: unknown }> }).issues[0];
    if (first && typeof first.message === "string") return first.message;
  }
  return null;
}

export function localizeQaReviewError(failure: QaReviewFailure): string {
  switch (failure.error) {
    case "AUTH_FAILED":
      return "انتهت الجلسة — يرجى تسجيل الدخول من جديد.";
    case "FORBIDDEN":
      return "لا تملك صلاحية مراجعة أسئلة هذا الكورس.";
    case "COURSE_NOT_FOUND":
      return "الكورس غير موجود.";
    case "COURSE_DELETED":
      return "لا يمكن مراجعة أسئلة كورس محذوف.";
    case "INVALID_INPUT":
      return firstZodIssueMessage(failure.details) ?? "المدخلات غير صالحة.";
    case "QA_NOT_FOUND":
      return "السؤال غير موجود — حدّث القائمة.";
    case "QA_NOT_PENDING":
      return "هذا السؤال ليس بانتظار المراجعة — حدّث القائمة.";
    case "QA_APPROVED_LOCKED":
      return "السؤال معتمد — يجب إلغاء الاعتماد قبل التعديل.";
    case "QA_NOT_APPROVED":
      return "السؤال غير معتمد أصلاً.";
    case "QA_STALE":
      return "هذا السؤال لم يعد موجوداً في آخر توليد — لا يمكن اعتماده قبل المزامنة.";
    case "QA_HASH_MISMATCH":
      return "تغيّر محتوى السؤال أثناء المراجعة — حدّث القائمة وأعد المحاولة.";
    case "QA_NUMERIC_CONFIRM_REQUIRED":
      return "هذا الجواب يحتوي رقماً/قياساً — أكّد مطابقة الرقم لما قيل في المحاضرة أولاً.";
    case "QA_QUARANTINED":
      return "سؤال بدون اقتباس زمني صالح — عدّله أو ارفضه؛ لا يمكن اعتماده كما هو.";
    case "INTERNAL_ERROR":
    default:
      return "حدث خطأ غير متوقع. حاول مرة أخرى.";
  }
}

// Student-facing copy for the study deck (Phase 3 slice 4). The denial
// cases should be rare in practice — the practice tab only renders for
// lessons the client-side predicate already believes are covered — but the
// server gate is authoritative and these keep its answers readable.
export function localizeQaStudyError(failure: QaStudyFailure): string {
  switch (failure.error) {
    case "AUTH_FAILED":
      return "انتهت الجلسة — يرجى تسجيل الدخول من جديد.";
    case "INVALID_INPUT":
      return firstZodIssueMessage(failure.details) ?? "المدخلات غير صالحة.";
    case "COURSE_NOT_FOUND":
      return "الكورس غير موجود.";
    case "VIDEO_NOT_FOUND":
      return "الدرس غير موجود.";
    case "VIDEO_NOT_READY":
      return "فيديو الدرس قيد المعالجة — حاول لاحقاً.";
    case "NOT_ENROLLED":
      return "التدريب متاح للمسجّلين في الدورة — سجّل للوصول إلى بطاقات الأسئلة.";
    case "SECTION_NOT_OWNED":
      return "هذا القسم غير مشترى بعد — اشترِ القسم للتدرّب على أسئلته.";
    case "RATE_LIMITED":
      return "طلبات كثيرة — انتظر لحظة ثم أعد المحاولة.";
    case "INTERNAL_ERROR":
    default:
      return "حدث خطأ غير متوقع. حاول مرة أخرى.";
  }
}
