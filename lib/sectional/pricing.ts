// Pure pricing helpers for sectional purchasing (Phase 3).
//
// Extracted from app/actions/sectional_wallet_actions.ts: that file carries the
// "use server" directive, which requires every export to be an async server
// action. These are synchronous pure functions, so they live here instead —
// importable by routes, components, and the action file alike.
//
// `computeSmartSubtractPrice` computes "buy up to here" pricing with
// already-owned sections subtracted. `computeBundleBreakEven` decides when to
// upsell the bundle CTA.

import type { Course } from "@/types/types";

type SmartSubtractResult =
  | { sectionIdsToCharge: string[]; totalPrice: number }
  | { error: "SECTION_NOT_PRICEABLE" };

export function computeSmartSubtractPrice(
  course: Pick<Course, "sections">,
  targetSectionId: string,
  ownedSectionIds: string[]
): SmartSubtractResult {
  const sections = Array.isArray(course.sections) ? course.sections : [];
  const target = sections.find((s) => s.sectionId === targetSectionId);
  if (!target) {
    return { sectionIdsToCharge: [], totalPrice: 0 };
  }
  const ownedSet = new Set(ownedSectionIds);
  const upTo = sections.filter((s) => s.order <= target.order);
  const sortedUpTo = upTo.slice().sort((a, b) => a.order - b.order);

  const sectionIdsToCharge: string[] = [];
  let totalPrice = 0;
  for (const s of sortedUpTo) {
    if (ownedSet.has(s.sectionId)) continue;
    const effective = s.salePrice ?? s.price;
    if (typeof effective !== "number" || effective <= 0) {
      return { error: "SECTION_NOT_PRICEABLE" };
    }
    sectionIdsToCharge.push(s.sectionId);
    totalPrice += effective;
  }

  return { sectionIdsToCharge, totalPrice };
}

type BundleBreakEvenResult =
  | { offerBundle: false }
  | {
      offerBundle: true;
      bundleDelta: number;
      savingsVsSectional: number;
    };

export function computeBundleBreakEven(
  course: Pick<Course, "fullCoursePrice">,
  enrollmentTotalSpent: number,
  proposedSectionPurchasePrice: number
): BundleBreakEvenResult {
  const fullPrice = course.fullCoursePrice;
  if (typeof fullPrice !== "number" || fullPrice <= 0) {
    return { offerBundle: false };
  }
  const projectedSpent = enrollmentTotalSpent + proposedSectionPurchasePrice;
  if (projectedSpent < fullPrice) {
    return { offerBundle: false };
  }
  const bundleDelta = Math.max(0, fullPrice - enrollmentTotalSpent);
  const savingsVsSectional = proposedSectionPurchasePrice - bundleDelta;
  return { offerBundle: true, bundleDelta, savingsVsSectional };
}
