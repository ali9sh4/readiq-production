// Per-section "Buy this" / "Buy up to here" CTAs (Phase 6b).
//
// Rendered inline next to each section header in both `CoursePreview`'s
// curriculum block and `CoursePlayer`'s SectionsContent. Both consumers
// share the same visibility rules:
//   - Hidden entirely on non-sectional courses.
//   - Hidden on sections the user already owns.
//   - Hidden when `enrollment.accessScope` is anything other than
//     'sectional' (bundle / legacy enrollee already has full access).
//   - "Buy up to here" hidden when the target is the first section
//     (cumulative for section[0] === single).
//   - Both hidden, with a notice, when the section has no price set yet
//     (instructor flipped to sectional but didn't price this section).
//
// Renders nothing when no CTA applies — safe to drop in unconditionally.

"use client";

import React, { useState } from "react";
import { ShoppingCart, ListChecks, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionalBuyDialog, {
  type SectionalBuyMode,
} from "./SectionalBuyDialog";
import type { Course, CourseSection, Enrollment } from "@/types/types";

type Props = {
  course: Course;
  section: CourseSection;
  enrollment?: Enrollment | null;
  // Position of this section in the sorted list. Drives "cumulative is
  // hidden for the first section" rule. Parent computes this once when
  // mapping the section list.
  positionInOrder: number;
};

function isOwned(
  section: CourseSection,
  enrollment: Enrollment | null | undefined
): boolean {
  if (!enrollment) return false;
  if (enrollment.accessScope !== "sectional") {
    // Full / unset access scope: every section is effectively "owned"
    // from the buyer's POV — no need to show CTAs.
    return enrollment.status === "completed";
  }
  return (enrollment.ownedSectionIds ?? []).includes(section.sectionId);
}

function hasPrice(section: CourseSection): boolean {
  const effective = section.salePrice ?? section.price;
  return typeof effective === "number" && effective > 0;
}

export default function SectionalBuyButtons({
  course,
  section,
  enrollment,
  positionInOrder,
}: Props) {
  const [dialogMode, setDialogMode] = useState<SectionalBuyMode | null>(null);

  if (course.purchaseMode !== "sectional") return null;
  if (isOwned(section, enrollment)) return null;

  // Bundle / unset scope users with a completed enrollment already have
  // full access and shouldn't see per-section CTAs.
  if (
    enrollment?.status === "completed" &&
    enrollment.accessScope !== "sectional"
  ) {
    return null;
  }

  if (!hasPrice(section)) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <AlertCircle className="w-3.5 h-3.5" />
        السعر غير محدد بعد
      </div>
    );
  }

  const showCumulative = positionInOrder > 0;
  const effectivePrice = (section.salePrice ?? section.price) as number;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 justify-end">
        <span className="text-xs sm:text-sm font-bold text-blue-700 mr-2 inline-flex items-center gap-1">
          <Lock className="w-3.5 h-3.5" />
          {effectivePrice.toLocaleString("en-US")} د.ع
        </span>
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-8 px-3 gap-1.5 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setDialogMode("single");
          }}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          شراء هذا القسم
        </Button>
        {showCumulative && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-3 gap-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setDialogMode("cumulative");
            }}
          >
            <ListChecks className="w-3.5 h-3.5" />
            شراء حتى هنا
          </Button>
        )}
      </div>

      {dialogMode && (
        <SectionalBuyDialog
          open={dialogMode !== null}
          onOpenChange={(o) => !o && setDialogMode(null)}
          mode={dialogMode}
          course={course}
          targetSectionId={section.sectionId}
          enrollment={enrollment ?? null}
        />
      )}
    </>
  );
}
