"use client";

import { useState } from "react";
import { Lock, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Course, CourseVideo, Enrollment } from "@/types/types";
import { getLockReason } from "@/lib/sectional/access";
import SectionalBuyDialog from "@/components/sectional/SectionalBuyDialog";

export default function SectionalLock({
  course,
  currentVideo,
  canAccessVideo,
  videoError,
  isEnrolled,
  accessScope,
  ownedSectionIds,
  enrollment,
}: {
  course: Course;
  currentVideo: CourseVideo | undefined;
  canAccessVideo: boolean;
  videoError: string | null;
  isEnrolled: boolean;
  accessScope?: "full" | "sectional";
  ownedSectionIds?: string[];
  enrollment: Enrollment | null;
}) {
  // Phase 6b: open state for the sectional buy dialog invoked from the
  // locked-content placeholder. Mode is fixed to 'single' here — the
  // dialog's break-even row lets the user upgrade to bundle in place, and
  // the bulk buy-up-to-here affordance lives in the sidebar section chip.
  const [lockedDialogMode, setLockedDialogMode] = useState<"single" | null>(
    null,
  );

  return (
    <>
      {/* Locked Content */}
      {!videoError &&
        currentVideo &&
        !canAccessVideo &&
        (() => {
          // Phase 6b: switch on the granular lock reason so we can render
          // the right copy + CTA. `sectional-not-owned` gets a "Buy this
          // section" button that opens SectionalBuyDialog; the dialog
          // handles bundle break-even upsell internally.
          const reason = getLockReason(currentVideo, course, {
            isEnrolled,
            accessScope,
            ownedSectionIds,
          });

          const headline =
            reason === "sectional-not-owned"
              ? "هذا القسم غير مشترى بعد"
              : "محتوى مقفل";
          const body =
            reason === "sectional-not-owned"
              ? "اشترِ هذا القسم لمتابعة المشاهدة."
              : reason === "not-enrolled"
                ? "قم بالتسجيل في الدورة للوصول إلى هذا المحتوى"
                : "هذا الفيديو غير متاح حالياً";

          // Section title (when known) helps the user confirm what
          // they're about to buy. Fall back to "هذا القسم" if missing.
          const sectionTitle =
            (course.sections ?? []).find(
              (s) => s.sectionId === currentVideo.sectionId,
            )?.title ?? "هذا القسم";

          return (
            <div className="aspect-video w-full flex flex-col items-center justify-center text-center p-4 lg:p-6 bg-surface">
              <span className="mb-4 flex items-center justify-center w-14 h-14 rounded-full bg-brand-yellow-50 border border-brand-yellow-200">
                <Lock className="w-6 h-6 text-navy-900" />
              </span>
              <h3 className="text-lg lg:text-xl font-extrabold mb-2 text-navy-950">
                {headline}
              </h3>
              {reason === "sectional-not-owned" && (
                <p className="text-sm font-bold text-navy-900 mb-1">
                  {sectionTitle}
                </p>
              )}
              <p className="text-sm lg:text-base text-gray-600 mb-4">{body}</p>
              {reason === "not-enrolled" && (
                <Link href={`/courses/${course.id}`}>
                  <Button size="sm">التسجيل في الدورة</Button>
                </Link>
              )}
              {reason === "sectional-not-owned" && currentVideo.sectionId && (
                <Button
                  onClick={() => setLockedDialogMode("single")}
                  className="gap-2"
                  size="sm"
                >
                  <ShoppingCart className="w-4 h-4" />
                  شراء هذا القسم
                </Button>
              )}
            </div>
          );
        })()}

      {/* Phase 6b: dialog mount for the locked-content CTA. Open state
          survives across lock-reason re-renders; closes on success
          via the dialog's internal flow. */}
      {currentVideo?.sectionId && (
        <SectionalBuyDialog
          open={lockedDialogMode !== null}
          onOpenChange={(o) => !o && setLockedDialogMode(null)}
          mode={lockedDialogMode ?? "single"}
          course={course}
          targetSectionId={currentVideo.sectionId}
          enrollment={enrollment}
        />
      )}
    </>
  );
}
