// Arabic localization for sectional server-action failures.
//
// The actions in `app/actions/sectional_config_actions.ts` and
// `app/actions/sectional_wallet_actions.ts` return English `message`
// strings keyed by a stable `error` code. The UI is Arabic-only, so an
// English toast reads as "something went wrong" to the user. This helper
// maps the code to user-facing Arabic copy.
//
// Zod-derived issues (INVALID_INPUT) already carry Arabic strings from
// `validation/sectional.ts`; we surface the first one when present.

import type { SectionalConfigErrorCode } from "@/app/actions/sectional_config_actions";
import type { PurchaseErrorCode } from "@/app/actions/sectional_wallet_actions";

type AnyErrorCode = SectionalConfigErrorCode | PurchaseErrorCode;

type LocalizableFailure = {
  success: false;
  error: AnyErrorCode;
  message: string;
  details?: unknown;
};

function firstZodIssueMessage(details: unknown): string | undefined {
  if (!details || typeof details !== "object") return undefined;
  const maybeIssues = (details as { issues?: unknown }).issues;
  if (!Array.isArray(maybeIssues) || maybeIssues.length === 0) return undefined;
  const first = maybeIssues[0];
  if (
    first &&
    typeof first === "object" &&
    typeof (first as { message?: unknown }).message === "string"
  ) {
    return (first as { message: string }).message;
  }
  return undefined;
}

export function localizeSectionalError(result: LocalizableFailure): string {
  switch (result.error) {
    case "AUTH_FAILED":
      return "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجددًا";
    case "FORBIDDEN":
      return "لا تملك صلاحية تعديل هذه الدورة";
    case "COURSE_NOT_FOUND":
      return "لم يتم العثور على الدورة";
    case "INVALID_INPUT":
      return firstZodIssueMessage(result.details) ?? "بيانات غير صحيحة";
    case "INVALID_SECTION_ID":
      return "القسم المحدد غير موجود في هذه الدورة";
    case "VIDEO_NOT_FOUND":
      return "الفيديو غير موجود";
    case "SECTION_LOCKED":
      return "لا يمكن تعديل قسم تم بيعه. يمكن رفع السعر فقط، لا يمكن خفضه أو حذف القسم";
    case "COURSE_PURCHASE_MODE_LOCKED":
      return "لا يمكن تغيير نمط البيع — توجد عمليات شراء سابقة على هذه الدورة";
    case "COURSE_NOT_SECTIONAL":
      return "هذه الدورة ليست في وضع البيع بالأقسام";
    case "ALREADY_FULL_ACCESS":
      return "أنت تملك كامل الدورة بالفعل";
    case "ALL_SECTIONS_ALREADY_OWNED":
      return "أنت تملك كل الأقسام المطلوبة بالفعل";
    case "SECTION_NOT_PRICEABLE":
      return "أحد الأقسام لا يملك سعرًا صالحًا للشراء";
    case "BUNDLE_PRICE_NOT_SET":
      return "سعر الحزمة الكاملة غير محدد لهذه الدورة";
    case "INSUFFICIENT_BALANCE":
      return "رصيد المحفظة غير كافٍ لإتمام الشراء";
    case "OWN_COURSE":
      return "لا يمكنك شراء دورتك الخاصة";
    case "MISSING_INSTRUCTOR":
      return "الدورة لا تحتوي على معلومات المدرّب";
    case "INTERNAL_ERROR":
      return "حدث خطأ أثناء الحفظ. حاول مجددًا";
    default:
      return result.message;
  }
}
