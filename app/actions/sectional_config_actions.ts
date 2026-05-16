// Sectional config server action (Phase 5a).
//
// Single entry point for the instructor UI to set:
//   - `purchaseMode` ('full' vs 'sectional')
//   - `fullCoursePrice` (bundle price for sectional courses)
//   - `sections[]` (per-section pricing metadata)
//
// All three fields are independently optional — the editor can save just
// one of them. Whatever is provided is composed into a Firestore update,
// passed through `assertCourseMutationAllowed`, and written in a single
// `update()` call.
//
// Lock-on-sale invariants live in `lib/courses/assertCourseMutationAllowed.ts`
// (section deletion, price-cut, reorder of sold sections; purchaseMode
// flip after a sale). This action does not re-implement them — it just
// makes sure the proposed shape is what the helper expects.
//
// Does NOT touch `course.videos[]`. Videos already carry `sectionId` from
// the Phase 1 backfill. Renaming a section's `title` does not require
// touching videos because the FK is `sectionId`, not the title string.
"use server";

import { adminAuth, db } from "@/firebase/service";
import { revalidatePath } from "next/cache";
import {
  assertCourseMutationAllowed,
  CourseMutationLockedError,
} from "@/lib/courses/assertCourseMutationAllowed";
import { mintSectionId } from "@/lib/sectional/sectionId";
import { SectionalConfigSchema } from "@/validation/sectional";
import type { Course, CourseSection, CourseVideo } from "@/types/types";

// ===== Result shape =====

export type SectionalConfigErrorCode =
  | "AUTH_FAILED"
  | "FORBIDDEN"
  | "COURSE_NOT_FOUND"
  | "INVALID_INPUT"
  | "INVALID_SECTION_ID"
  | "VIDEO_NOT_FOUND"
  | "SECTION_LOCKED"
  | "COURSE_PURCHASE_MODE_LOCKED"
  | "INTERNAL_ERROR";

export type SectionalConfigSuccess = {
  success: true;
  course: Course;
};

export type SectionalConfigFailure = {
  success: false;
  error: SectionalConfigErrorCode;
  message: string;
  details?: unknown;
};

export type SectionalConfigResult =
  | SectionalConfigSuccess
  | SectionalConfigFailure;

function fail(
  error: SectionalConfigErrorCode,
  message: string,
  details?: unknown
): SectionalConfigFailure {
  return { success: false, error, message, details };
}

// Convert Firestore Timestamps to ISO strings on the returned course so the
// client can consume it directly. Same shape the page components use.
function serializeCourse(id: string, raw: FirebaseFirestore.DocumentData): Course {
  const toIso = (v: unknown) => {
    if (
      v &&
      typeof v === "object" &&
      typeof (v as { toDate?: () => Date }).toDate === "function"
    ) {
      return (v as { toDate: () => Date }).toDate().toISOString();
    }
    return v ?? null;
  };
  return {
    ...(raw as Course),
    id,
    createdAt: toIso(raw.createdAt) as Course["createdAt"],
    updatedAt: toIso(raw.updatedAt) as Course["updatedAt"],
    videos: Array.isArray(raw.videos)
      ? raw.videos.map((v: Record<string, unknown>) => ({
          ...v,
          uploadedAt: toIso(v.uploadedAt),
        }))
      : [],
    files: Array.isArray(raw.files)
      ? raw.files.map((f: Record<string, unknown>) => ({
          ...f,
          uploadedAt: toIso(f.uploadedAt),
        }))
      : [],
  } as Course;
}

// ===== Main entry point =====

export type SectionalConfigInput = {
  purchaseMode?: "full" | "sectional";
  fullCoursePrice?: number;
  sections?: Array<{
    sectionId?: string;
    title: string;
    order: number;
    price?: number;
    salePrice?: number;
  }>;
};

export async function updateCourseSectionalConfig(
  token: string,
  courseId: string,
  update: SectionalConfigInput
): Promise<SectionalConfigResult> {
  // 1. Auth.
  let userId: string;
  let isAdmin: boolean;
  try {
    const verified = await adminAuth.verifyIdToken(token);
    userId = verified.uid;
    isAdmin = verified.admin === true;
  } catch {
    return fail("AUTH_FAILED", "Authentication failed");
  }

  // 2. Input validation.
  const parsed = SectionalConfigSchema.safeParse(update);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid sectional config payload", {
      issues: parsed.error.issues,
    });
  }
  const cleanUpdate = parsed.data;

  // 3. Load course + ownership check.
  const courseRef = db.collection("courses").doc(courseId);
  const courseSnap = await courseRef.get();
  if (!courseSnap.exists) {
    return fail("COURSE_NOT_FOUND", "Course not found");
  }
  const courseData = courseSnap.data() as Course | undefined;
  const isOwner = courseData?.createdBy === userId;
  if (!isOwner && !isAdmin) {
    return fail("FORBIDDEN", "You do not have permission to edit this course");
  }

  // 4. Compose the proposed update.
  //
  // Only include fields the caller actually provided. Each branch is
  // independent — partial updates are supported.
  const proposedUpdate: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (cleanUpdate.purchaseMode !== undefined) {
    proposedUpdate.purchaseMode = cleanUpdate.purchaseMode;
  }
  if (cleanUpdate.fullCoursePrice !== undefined) {
    proposedUpdate.fullCoursePrice = cleanUpdate.fullCoursePrice;
  }
  if (cleanUpdate.sections !== undefined) {
    const currentSections: CourseSection[] = Array.isArray(courseData?.sections)
      ? (courseData!.sections as CourseSection[])
      : [];
    const currentById = new Map(currentSections.map((s) => [s.sectionId, s]));

    const nextSections: CourseSection[] = cleanUpdate.sections.map((s) => {
      const sectionId = s.sectionId ?? mintSectionId();
      const current = currentById.get(sectionId);
      // Preserve isLocked from the current doc — instructor cannot clear it
      // by sending isLocked:false. The lock helper enforces the substantive
      // restrictions (price-cut, reorder, delete); this stops accidental
      // clobbering of the flag itself.
      const next: CourseSection = {
        sectionId,
        title: s.title,
        order: s.order,
      };
      if (s.price !== undefined) next.price = s.price;
      if (s.salePrice !== undefined) next.salePrice = s.salePrice;
      if (current?.isLocked === true) next.isLocked = true;
      return next;
    });

    proposedUpdate.sections = nextSections;
  }

  // 5. Lock guard.
  try {
    await assertCourseMutationAllowed(
      {
        id: courseId,
        sections: courseData?.sections,
        purchaseMode: courseData?.purchaseMode,
      },
      proposedUpdate
    );
  } catch (lockErr) {
    if (lockErr instanceof CourseMutationLockedError) {
      console.log(
        `sectional-config REJECTED courseId=${courseId} by=${userId} reason=${lockErr.code}${
          lockErr.sectionId ? ` sectionId=${lockErr.sectionId}` : ""
        }`
      );
      return fail(lockErr.code, lockErr.message, {
        sectionId: lockErr.sectionId,
        reason: lockErr.reason,
      });
    }
    throw lockErr;
  }

  // 6. Persist.
  try {
    await courseRef.update(proposedUpdate);
  } catch (err) {
    console.error("sectional-config write failed", err);
    return fail("INTERNAL_ERROR", "Failed to save sectional config");
  }

  // 7. Re-read so the caller gets the canonical post-write state.
  const freshSnap = await courseRef.get();
  const freshCourse = serializeCourse(courseId, freshSnap.data() ?? {});

  revalidatePath(`/course/${courseId}`);
  revalidatePath(`/course-upload/edit/${courseId}`);

  console.log(
    `sectional-config updated courseId=${courseId} by=${userId} fields=${Object.keys(
      proposedUpdate
    )
      .filter((k) => k !== "updatedAt")
      .join(",")}`
  );

  return { success: true, course: freshCourse };
}

// ===== Video-to-section assignment (Phase 5c) =====
//
// Re-points a single video at a different section (or unassigns it).
// Mutates only `course.videos[]` — no section/purchaseMode changes. The
// lock helper short-circuits when the proposed update has neither a
// `sections` array nor a `purchaseMode` key, so this call is safe to run
// against locked courses; we still invoke it for future-proofing.

export type UpdateVideoSectionAssignmentResult =
  | { success: true }
  | { success: false; error: SectionalConfigErrorCode; message: string };

export async function updateVideoSectionAssignment(
  token: string,
  courseId: string,
  videoId: string,
  newSectionId: string | null
): Promise<UpdateVideoSectionAssignmentResult> {
  // 1. Auth.
  let userId: string;
  let isAdmin: boolean;
  try {
    const verified = await adminAuth.verifyIdToken(token);
    userId = verified.uid;
    isAdmin = verified.admin === true;
  } catch {
    return {
      success: false,
      error: "AUTH_FAILED",
      message: "Authentication failed",
    };
  }

  // 2. Load + ownership check.
  const courseRef = db.collection("courses").doc(courseId);
  const courseSnap = await courseRef.get();
  if (!courseSnap.exists) {
    return {
      success: false,
      error: "COURSE_NOT_FOUND",
      message: "Course not found",
    };
  }
  const courseData = courseSnap.data() as Course | undefined;
  const isOwner = courseData?.createdBy === userId;
  if (!isOwner && !isAdmin) {
    return {
      success: false,
      error: "FORBIDDEN",
      message: "You do not have permission to edit this course",
    };
  }

  // 3. Validate target section exists (when assigning, not when clearing).
  if (newSectionId !== null) {
    const sections = Array.isArray(courseData?.sections)
      ? (courseData!.sections as CourseSection[])
      : [];
    if (!sections.some((s) => s.sectionId === newSectionId)) {
      return {
        success: false,
        error: "INVALID_SECTION_ID",
        message: "القسم المحدد غير موجود في هذه الدورة",
      };
    }
  }

  // 4. Find the video.
  const existingVideos: CourseVideo[] = Array.isArray(courseData?.videos)
    ? (courseData!.videos as CourseVideo[])
    : [];
  if (!existingVideos.some((v) => v.videoId === videoId)) {
    return {
      success: false,
      error: "VIDEO_NOT_FOUND",
      message: "الفيديو غير موجود",
    };
  }

  const updatedVideos = existingVideos.map((v) => {
    if (v.videoId !== videoId) return v;
    if (newSectionId === null) {
      // Drop the field entirely on clear (writing the array back without
      // the key is equivalent to FieldValue.delete() for array elements).
      const { sectionId: _drop, ...rest } = v;
      return rest as CourseVideo;
    }
    return { ...v, sectionId: newSectionId };
  });

  const proposedUpdate = {
    videos: updatedVideos,
    updatedAt: new Date().toISOString(),
  };

  // 5. Lock helper guard. No-op today for video-only mutations (no
  // `sections` array, no `purchaseMode`), but keep the call so a future
  // rule that touches videos picks it up automatically.
  try {
    await assertCourseMutationAllowed(
      {
        id: courseId,
        sections: courseData?.sections,
        purchaseMode: courseData?.purchaseMode,
      },
      proposedUpdate
    );
  } catch (lockErr) {
    if (lockErr instanceof CourseMutationLockedError) {
      return {
        success: false,
        error: lockErr.code,
        message: lockErr.message,
      };
    }
    throw lockErr;
  }

  // 6. Persist.
  try {
    await courseRef.update(proposedUpdate);
  } catch (err) {
    console.error("video-section-assignment write failed", err);
    return {
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to update video section",
    };
  }

  revalidatePath(`/course/${courseId}`);
  revalidatePath(`/course-upload/edit/${courseId}`);

  console.log(
    `video-section-assignment courseId=${courseId} videoId=${videoId} newSectionId=${
      newSectionId ?? "null"
    } by=${userId}`
  );

  return { success: true };
}
