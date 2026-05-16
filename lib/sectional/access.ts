// Client-side video access predicate for the player UI (Phase 6a/6b).
//
// Mirrors the rules the Mux token route enforces server-side, in the same
// order, so the UI's lock icons match what playback would actually allow.
// The server is still authoritative — this helper only drives visual state.
//
// `getLockReason` returns a granular outcome; `isVideoLockedForUser` is a
// thin boolean wrapper. UI surfaces that need to vary their copy / CTA on
// *why* a video is locked (the player's locked-content placeholder)
// consume `getLockReason`; surfaces that only need a yes/no consume the
// boolean.

import type { Course, CourseVideo } from "@/types/types";

export type EnrollmentAccessState = {
  isEnrolled: boolean;
  accessScope?: "full" | "sectional";
  ownedSectionIds?: string[];
};

export type LockReason =
  | "unlocked"
  | "free-preview"
  | "free-course"
  | "not-enrolled"
  | "sectional-not-owned";

export function getLockReason(
  video: CourseVideo,
  course: Pick<Course, "price" | "purchaseMode" | "sections">,
  enrollment: EnrollmentAccessState
): LockReason {
  if (video.isFreePreview === true) return "free-preview";
  if (course.price === 0) return "free-course";
  if (!enrollment.isEnrolled) return "not-enrolled";
  if (course.purchaseMode !== "sectional") return "unlocked";
  if (enrollment.accessScope !== "sectional") return "unlocked";

  const owned = enrollment.ownedSectionIds;
  if (
    typeof video.sectionId === "string" &&
    Array.isArray(owned) &&
    owned.includes(video.sectionId)
  ) {
    return "unlocked";
  }
  return "sectional-not-owned";
}

export function isVideoLockedForUser(
  video: CourseVideo,
  course: Pick<Course, "price" | "purchaseMode" | "sections">,
  enrollment: EnrollmentAccessState
): boolean {
  const reason = getLockReason(video, course, enrollment);
  return (
    reason === "not-enrolled" || reason === "sectional-not-owned"
  );
}
