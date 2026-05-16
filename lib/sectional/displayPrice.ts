// Unified course price display (Phase 6c — post-Phase-6b cleanup).
//
// Single source of truth for "what price string should we show for this
// course?" — called by every catalog/admin/dashboard surface that needs
// to render a course price. Keeps sectional vs full-course pricing
// consistent across the app and isolates currency formatting in one place.
//
// Sectional courses ignore legacy `course.price` / `course.salePrice` and
// read `course.fullCoursePrice` instead. Non-sectional courses preserve
// the legacy strikethrough-sale display.
//
// Pure function. No I/O, no React, safe for server components and
// generateMetadata.

import type { Course } from "@/types/types";

export type CourseDisplayPrice = {
  // Formatted primary text. Always present.
  // Examples: "مجاني" | "50,000 د.ع" | "السعر غير محدد"
  primary: string;
  // Formatted strikethrough text for legacy sales only. undefined for
  // sectional courses (no sale concept on the bundle price) and for any
  // course without a valid sale.
  strikethrough?: string;
  // Numeric value of the primary price. `null` when unpriced.
  // Callers that need to compute badges or pass to other actions read this.
  numeric: number | null;
  // True iff the course is meant to be free to all enrolled users
  // (course.price === 0, or sectional with fullCoursePrice === 0).
  isFree: boolean;
  // False when no usable price is set (e.g. sectional with no bundle
  // price). Callers can suppress paid/free badges in that case.
  isPriced: boolean;
  // Mirrors course.purchaseMode === 'sectional'. Consumers that want
  // their own sublabel copy (e.g. catalog "دورة مقسّمة") render based
  // on this — the helper deliberately doesn't bake in any sublabel string.
  isSectional: boolean;
};

function format(amount: number): string {
  return `${amount.toLocaleString()} د.ع`;
}

const UNPRICED: Pick<CourseDisplayPrice, "primary" | "numeric" | "isFree" | "isPriced"> = {
  primary: "السعر غير محدد",
  numeric: null,
  isFree: false,
  isPriced: false,
};

export function getCourseDisplayPrice(
  course: Pick<
    Course,
    "price" | "salePrice" | "purchaseMode" | "fullCoursePrice"
  >
): CourseDisplayPrice {
  const isSectional = course.purchaseMode === "sectional";

  if (isSectional) {
    const bundle = course.fullCoursePrice;
    if (typeof bundle !== "number") {
      return { ...UNPRICED, isSectional: true };
    }
    if (bundle === 0) {
      return {
        primary: "مجاني",
        numeric: 0,
        isFree: true,
        isPriced: true,
        isSectional: true,
      };
    }
    return {
      primary: format(bundle),
      numeric: bundle,
      isFree: false,
      isPriced: true,
      isSectional: true,
    };
  }

  // Legacy full-course pricing.
  const price = course.price;
  if (typeof price !== "number") {
    return { ...UNPRICED, isSectional: false };
  }
  if (price === 0) {
    return {
      primary: "مجاني",
      numeric: 0,
      isFree: true,
      isPriced: true,
      isSectional: false,
    };
  }

  const sale = course.salePrice;
  const hasValidSale =
    typeof sale === "number" && sale > 0 && sale < price;

  return {
    primary: format(hasValidSale ? sale! : price),
    strikethrough: hasValidSale ? format(price) : undefined,
    numeric: hasValidSale ? sale! : price,
    isFree: false,
    isPriced: true,
    isSectional: false,
  };
}
