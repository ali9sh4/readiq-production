// Hero-block bundle CTA for sectional courses (Phase 6b).
//
// Replaces the three legacy <EnrollButton> render sites on `CoursePreview`
// (mobile inline hero, desktop card, sticky sidebar). Shows
// `course.fullCoursePrice` and a single "شراء الحزمة الكاملة" button
// that opens <SectionalBuyDialog mode='bundle'>. A small secondary line
// points the user at the per-section CTAs in the curriculum block.

"use client";

import React, { useCallback, useState } from "react";
import { ShoppingCart, ArrowDown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionalBuyDialog from "./SectionalBuyDialog";
import type { Course, Enrollment } from "@/types/types";

type Props = {
  course: Course;
  enrollment?: Enrollment | null;
  // Optional: scrolls the curriculum block into view when the user
  // clicks the "or buy sections individually" link. Parent passes a
  // function that focuses the curriculum container.
  onScrollToCurriculum?: () => void;
  // Renders a wider button when used as the primary card CTA. Some
  // sites want a tighter inline look.
  fullWidth?: boolean;
};

export default function SectionalCoursePurchase({
  course,
  enrollment,
  onScrollToCurriculum,
  fullWidth = true,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const fullPrice = course.fullCoursePrice;
  const priceSet = typeof fullPrice === "number" && fullPrice > 0;

  // Already-bundled buyer: just show "you own the bundle" — no CTA.
  const isFullAccessBuyer =
    enrollment?.status === "completed" &&
    enrollment.accessScope !== "sectional";

  const handleScroll = useCallback(() => {
    if (onScrollToCurriculum) {
      onScrollToCurriculum();
    }
  }, [onScrollToCurriculum]);

  if (isFullAccessBuyer) {
    return (
      <div className="text-center py-2">
        <p className="text-sm font-semibold text-green-700">
          ✓ تملك الحزمة الكاملة لهذه الدورة
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-center">
      <div>
        {priceSet ? (
          <>
            <p className="text-xs text-gray-500 mb-1">سعر الحزمة الكاملة</p>
            <p className="text-2xl md:text-3xl font-bold text-gray-900">
              {fullPrice!.toLocaleString("en-US")} د.ع
            </p>
          </>
        ) : (
          <div className="inline-flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4" />
            سعر الحزمة غير محدد — اشترِ الأقسام منفصلةً
          </div>
        )}
      </div>

      {priceSet && (
        <Button
          type="button"
          size="lg"
          onClick={() => setDialogOpen(true)}
          className={`${
            fullWidth ? "w-full" : ""
          } gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg`}
        >
          <ShoppingCart className="w-5 h-5" />
          شراء الحزمة الكاملة
        </Button>
      )}

      <button
        type="button"
        onClick={handleScroll}
        className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1.5"
      >
        أو اشترِ الأقسام بشكل منفصل
        <ArrowDown className="w-3.5 h-3.5" />
      </button>

      {priceSet && (
        <SectionalBuyDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode="bundle"
          course={course}
          enrollment={enrollment ?? null}
        />
      )}
    </div>
  );
}
