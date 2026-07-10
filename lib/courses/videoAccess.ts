// Shared per-video access gate — §8.1 of docs/RUBIK_STUDY_FEATURES.md
// (Phase 3 slice 3). Extracted VERBATIM from
// app/api/mux/playback-token/route.ts so playback, study, and any future
// grounded-chat surface evaluate the SAME predicate and cannot drift.
// Check order is load-bearing and mirrors the route's documented gate:
//   course exists → owner/admin bypass → public visibility (non-privileged)
//   → video exists → playbackId ready → free-preview (callers opt in)
//   → completed enrollment → sectional section-ownership.
//
// This module makes NO logging and NO HTTP decisions — callers map the
// structured result onto their own response shape and log lines (the
// playback route preserves its historical `mux-playback DENIED/DIAG/issued`
// grep patterns; production debugging depends on them).

import { db } from "@/firebase/service";
import { isCoursePubliclyVisible } from "@/lib/courses/visibility";
import { isAccessExpired } from "@/lib/courses/accessDuration";

// Grant reasons string-match the playback route's historical log values —
// do not rename casually.
export type VideoAccessGrantReason =
  | "owner"
  | "admin"
  | "free-preview"
  | "enrolled"
  | "sectional_legacy_full"
  | "sectional_bundle"
  | "sectional_owned_section"
  | "sectional_untagged_video";

export interface VideoAccessGrant {
  allowed: true;
  reason: VideoAccessGrantReason;
  playbackId: string;
}

export type VideoAccessDenialCode =
  | "COURSE_NOT_FOUND"
  | "VIDEO_NOT_FOUND"
  | "VIDEO_NOT_READY"
  | "NOT_ENROLLED"
  | "ACCESS_EXPIRED"
  | "SECTION_NOT_OWNED";

export interface VideoAccessDenial {
  allowed: false;
  code: VideoAccessDenialCode;
  httpStatus: 403 | 404 | 409;
  message: string;
  /**
   * Structured log detail for the denials the playback route logs today:
   * "not_enrolled_no_doc" | "not_enrolled_status_<status>" |
   * "sectional_section_not_owned". Absent for the 404/409 codes, which the
   * route has never logged.
   */
  logReason?: string;
  /** The unowned section, for SECTION_NOT_OWNED deny logs. */
  sectionId?: string;
}

export type VideoAccessResult = VideoAccessGrant | VideoAccessDenial;

function deny(
  code: VideoAccessDenialCode,
  httpStatus: 403 | 404 | 409,
  message: string,
  extra?: Pick<VideoAccessDenial, "logReason" | "sectionId">
): VideoAccessDenial {
  return { allowed: false, code, httpStatus, message, ...extra };
}

function grant(
  reason: VideoAccessGrantReason,
  playbackId: string
): VideoAccessGrant {
  return { allowed: true, reason, playbackId };
}

export interface EvaluateVideoAccessParams {
  userId: string;
  isAdmin: boolean;
  courseId: string;
  videoId: string;
  /**
   * Whether `video.isFreePreview === true` grants access. The playback
   * route passes true (previews play for any authenticated user). The
   * study deck passes false — owner decision 2026-07-04
   * (docs/AUDIT_STUDY_DECK.md §3): practice requires genuine enrollment.
   * With false the check simply falls through to the enrollment branch,
   * so enrolled students still pass on free-preview lessons they own.
   */
  allowFreePreview: boolean;
}

export async function evaluateVideoAccess(
  params: EvaluateVideoAccessParams
): Promise<VideoAccessResult> {
  const { userId, isAdmin, courseId, videoId, allowFreePreview } = params;

  const courseSnap = await db.collection("courses").doc(courseId).get();
  if (!courseSnap.exists) {
    return deny("COURSE_NOT_FOUND", 404, "Course not found");
  }

  const course = courseSnap.data()!;
  const isOwner = course.createdBy === userId;
  const isPrivileged = isOwner || isAdmin;

  // Visibility gate applies to the student / free-preview path only.
  // Owners must be able to preview their own drafts; admins must be able
  // to review pending / unapproved courses. Both still require the course
  // doc to exist (the check above), so this does not leak unrelated course
  // state to non-privileged callers.
  if (!isPrivileged && !isCoursePubliclyVisible(course)) {
    return deny("COURSE_NOT_FOUND", 404, "Course not found");
  }

  const videos = Array.isArray(course.videos)
    ? (course.videos as Array<Record<string, unknown>>)
    : [];
  const video = videos.find((v) => v?.videoId === videoId);
  if (!video) {
    return deny("VIDEO_NOT_FOUND", 404, "Video not found in course");
  }

  const playbackId =
    typeof video.playbackId === "string" && video.playbackId.length > 0
      ? video.playbackId
      : null;
  if (!playbackId) {
    return deny(
      "VIDEO_NOT_READY",
      409,
      "Video upload has not finished processing"
    );
  }

  if (isPrivileged) {
    // Owner takes precedence over admin in the issued-token log, as before.
    return grant(isOwner ? "owner" : "admin", playbackId);
  }

  if (allowFreePreview && video.isFreePreview === true) {
    return grant("free-preview", playbackId);
  }

  // Everything else must hold a completed enrollment; for courses with
  // `purchaseMode === 'sectional'` we additionally verify the *specific*
  // section the video belongs to is owned, unless the enrollment has
  // `accessScope` unset (legacy) or set to 'full' (bundle buyer) — both
  // grant the whole course.
  //
  // Discriminator rule (sectional Phase 2, locked): sectional logic
  // activates *only* when `course.purchaseMode === 'sectional'`. The
  // presence of `course.sections[]` does NOT mean sectional — reading the
  // array's length as the discriminator would silently lock the catalog.
  const enrollmentSnap = await db
    .collection("enrollments")
    .doc(`${userId}_${courseId}`)
    .get();

  const enrollment = enrollmentSnap.exists ? enrollmentSnap.data() : null;
  const isEnrolled = enrollment?.status === "completed";

  if (!isEnrolled) {
    // Two distinct denial reasons share the NOT_ENROLLED code (the API
    // contract stays stable) but carry different structured log details so
    // production can tell "user never enrolled" from "purchase in flight,
    // enrollment doc exists but not yet completed".
    const logReason = !enrollmentSnap.exists
      ? "not_enrolled_no_doc"
      : `not_enrolled_status_${
          typeof enrollment?.status === "string" ? enrollment.status : "unknown"
        }`;
    return deny(
      "NOT_ENROLLED",
      403,
      "You must be enrolled in this course to play this video",
      { logReason }
    );
  }

  // Time-limited access: a purchase on a course with `accessDurationDays`
  // snapshots `accessExpiresAt` onto the enrollment. Unset = lifetime
  // (every pre-feature enrollment — mirrors the unset-accessScope
  // convention). Enforcement is lazy: compare here at read time; nothing
  // ever mutates the enrollment at expiry, and a renewal purchase
  // re-stamps the same doc. Checked after the enrollment gate and before
  // the sectional branch (sectional × time-limited are mutually
  // exclusive, so an expired stamp can only exist on a full-mode course).
  //
  // NOTE for future exam surfaces: final-exam eligibility is "a completed
  // enrollment exists — ever", deliberately NOT gated on expiry (owner
  // decision 2026-07-10). Exam code must not reuse this predicate's
  // ACCESS_EXPIRED denial; it needs its own was-ever-enrolled check.
  if (isAccessExpired(enrollment?.accessExpiresAt)) {
    return deny(
      "ACCESS_EXPIRED",
      403,
      "Your access to this course has expired",
      { logReason: "access_expired" }
    );
  }

  // Default `purchaseMode` to 'full' explicitly so an undefined value
  // never accidentally satisfies a `=== 'sectional'` check.
  const purchaseMode: "full" | "sectional" =
    course.purchaseMode === "sectional" ? "sectional" : "full";

  if (purchaseMode === "sectional") {
    const rawAccessScope = enrollment?.accessScope;

    if (rawAccessScope !== "sectional") {
      // Either accessScope is unset (legacy enrollment on a course later
      // flipped to sectional) or explicitly 'full' (bundle buyer). Both
      // grant the whole course; the distinction is for log diagnostics.
      return grant(
        rawAccessScope === "full" ? "sectional_bundle" : "sectional_legacy_full",
        playbackId
      );
    }

    // Genuine sectional enrollment — must own the section.
    const videoSectionId =
      typeof video.sectionId === "string" && video.sectionId.length > 0
        ? video.sectionId
        : null;

    if (videoSectionId === null) {
      // Untagged video on a sectional course — sectional Phase 1 spec keeps
      // these accessible. Callers log the DIAG line for this reason.
      return grant("sectional_untagged_video", playbackId);
    }

    const owned = Array.isArray(enrollment?.ownedSectionIds)
      ? (enrollment!.ownedSectionIds as string[])
      : [];
    if (!owned.includes(videoSectionId)) {
      return deny(
        "SECTION_NOT_OWNED",
        403,
        "You have not purchased this section of the course",
        { logReason: "sectional_section_not_owned", sectionId: videoSectionId }
      );
    }
    return grant("sectional_owned_section", playbackId);
  }

  return grant("enrolled", playbackId);
}
