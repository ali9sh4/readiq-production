// Client-side video access predicate for the player UI (Phase 6a).
//
// Mirrors the rules the Mux token route enforces server-side, in the same
// order, so the UI's lock icons match what playback would actually allow.
// The server is still authoritative — this helper only drives visual state.
//
// Rules, in priority order:
//   1. Free preview videos are always unlocked.
//   2. Free courses (price === 0) are always unlocked.
//   3. Non-enrolled users can't play anything else.
//   4. Non-sectional courses: enrolled means full unlock (legacy behavior).
//   5. Sectional courses with a non-sectional accessScope (i.e. 'full' or
//      unset) — bundle buyer or legacy enrollee, full unlock.
//   6. Sectional accessScope: unlocked iff the video's `sectionId` is in
//      `ownedSectionIds`.
//   7. Otherwise locked.

import type { Course, CourseVideo } from "@/types/types";

export type EnrollmentAccessState = {
  isEnrolled: boolean;
  accessScope?: "full" | "sectional";
  ownedSectionIds?: string[];
};

export function isVideoLockedForUser(
  video: CourseVideo,
  course: Pick<Course, "price" | "purchaseMode" | "sections">,
  enrollment: EnrollmentAccessState
): boolean {
  if (video.isFreePreview === true) return false;
  if (course.price === 0) return false;
  if (!enrollment.isEnrolled) return true;
  if (course.purchaseMode !== "sectional") return false;
  if (enrollment.accessScope !== "sectional") return false;

  const owned = enrollment.ownedSectionIds;
  if (
    typeof video.sectionId === "string" &&
    Array.isArray(owned) &&
    owned.includes(video.sectionId)
  ) {
    return false;
  }
  return true;
}
