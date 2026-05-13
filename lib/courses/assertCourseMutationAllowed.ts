// Lock-on-first-sale guardrails for sectional courses (Phase 3).
//
// Two distinct locks:
//   1. SECTION_LOCKED — a section flagged `isLocked: true` (set by the
//      purchase actions when someone buys it) becomes partially immutable:
//      it cannot be deleted, renamed (sectionId), price-cut, or reordered
//      relative to other locked sections. Title / new videos / price-raises
//      are fine.
//   2. COURSE_PURCHASE_MODE_LOCKED — once a course has any sold state, its
//      `purchaseMode` is frozen. Sectional courses with any locked section
//      or any bundle-buyer enrollment cannot revert. Full courses with any
//      completed enrollment cannot flip to sectional.
//
// Called from every server-side course-mutation entry point right before
// the `.update()` call. Throws `CourseMutationLockedError` on rejection;
// callers translate it to their existing error envelope.

import { db } from "@/firebase/service";
import type { Course, CourseSection, CoursePurchaseMode } from "@/types/types";

export type CourseMutationLockCode =
  | "SECTION_LOCKED"
  | "COURSE_PURCHASE_MODE_LOCKED";

export class CourseMutationLockedError extends Error {
  readonly code: CourseMutationLockCode;
  readonly sectionId?: string;
  readonly reason: string;

  constructor(
    code: CourseMutationLockCode,
    reason: string,
    sectionId?: string
  ) {
    super(`${code}: ${reason}${sectionId ? ` (sectionId=${sectionId})` : ""}`);
    this.name = "CourseMutationLockedError";
    this.code = code;
    this.reason = reason;
    this.sectionId = sectionId;
  }
}

type CurrentCourseShape = Pick<
  Course,
  "id" | "sections" | "purchaseMode"
> & { id: string };

type ProposedUpdate = Record<string, unknown>;

export async function assertCourseMutationAllowed(
  currentCourse: CurrentCourseShape,
  proposedUpdate: ProposedUpdate
): Promise<void> {
  if (Array.isArray(proposedUpdate.sections)) {
    assertSectionMutationsAllowed(
      currentCourse.sections ?? [],
      proposedUpdate.sections as CourseSection[]
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(proposedUpdate, "purchaseMode") &&
    proposedUpdate.purchaseMode !== currentCourse.purchaseMode
  ) {
    await assertPurchaseModeFlipAllowed(
      currentCourse.id,
      currentCourse.purchaseMode,
      proposedUpdate.purchaseMode as CoursePurchaseMode | undefined
    );
  }
}

function assertSectionMutationsAllowed(
  current: CourseSection[],
  proposed: CourseSection[]
): void {
  const proposedById = new Map<string, CourseSection>();
  for (const s of proposed) {
    if (s && typeof s.sectionId === "string") {
      proposedById.set(s.sectionId, s);
    }
  }

  const lockedCurrent = current.filter((s) => s.isLocked === true);

  for (const locked of lockedCurrent) {
    const next = proposedById.get(locked.sectionId);
    if (!next) {
      throw new CourseMutationLockedError(
        "SECTION_LOCKED",
        "cannot delete a section that has been sold",
        locked.sectionId
      );
    }

    // sectionId is the map key — equality is implied. But guard against a
    // payload where the array has been re-keyed under a different id (i.e.
    // a different object claims the same sectionId with mismatched data).
    if (next.sectionId !== locked.sectionId) {
      throw new CourseMutationLockedError(
        "SECTION_LOCKED",
        "cannot rename a section's stable sectionId after a sale",
        locked.sectionId
      );
    }

    const currentPrice = locked.price ?? 0;
    const nextPrice = next.price ?? 0;
    if (next.price !== undefined && nextPrice < currentPrice) {
      throw new CourseMutationLockedError(
        "SECTION_LOCKED",
        `cannot lower price below ${currentPrice} on a locked section`,
        locked.sectionId
      );
    }

    const currentSale = locked.salePrice ?? 0;
    const nextSale = next.salePrice ?? 0;
    if (next.salePrice !== undefined && nextSale < currentSale) {
      throw new CourseMutationLockedError(
        "SECTION_LOCKED",
        `cannot lower salePrice below ${currentSale} on a locked section`,
        locked.sectionId
      );
    }
  }

  // Ordering rule: locked sections must preserve their relative order.
  // New unlocked sections can be inserted anywhere among them.
  const currentLockedOrder = lockedCurrent
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => s.sectionId);

  const proposedLockedOrder = proposed
    .filter((s) => {
      const wasLocked = lockedCurrent.some(
        (l) => l.sectionId === s.sectionId
      );
      return wasLocked;
    })
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => s.sectionId);

  if (
    currentLockedOrder.length === proposedLockedOrder.length &&
    currentLockedOrder.some((id, i) => id !== proposedLockedOrder[i])
  ) {
    throw new CourseMutationLockedError(
      "SECTION_LOCKED",
      "cannot reorder locked sections relative to each other"
    );
  }
}

async function assertPurchaseModeFlipAllowed(
  courseId: string,
  currentMode: CoursePurchaseMode | undefined,
  nextMode: CoursePurchaseMode | undefined
): Promise<void> {
  const normalizedCurrent: CoursePurchaseMode =
    currentMode === "sectional" ? "sectional" : "full";
  const normalizedNext: CoursePurchaseMode =
    nextMode === "sectional" ? "sectional" : "full";

  if (normalizedCurrent === normalizedNext) return;

  if (normalizedCurrent === "sectional") {
    // Once any sale has happened on a sectional course, freeze the mode.
    // Either: a section was sold (isLocked === true on a section in the
    // current course doc — checked by the caller before deciding to set
    // this, but we re-check from the DB to be defensive) or a bundle was
    // sold (an enrollment exists with accessScope === 'full').
    const courseSnap = await db.collection("courses").doc(courseId).get();
    const sections = (courseSnap.data()?.sections ?? []) as CourseSection[];
    const hasLockedSection = sections.some((s) => s.isLocked === true);

    if (hasLockedSection) {
      throw new CourseMutationLockedError(
        "COURSE_PURCHASE_MODE_LOCKED",
        "sectional course has at least one sold section"
      );
    }

    const bundleBuyerSnap = await db
      .collection("enrollments")
      .where("courseId", "==", courseId)
      .where("accessScope", "==", "full")
      .limit(1)
      .get();

    if (!bundleBuyerSnap.empty) {
      throw new CourseMutationLockedError(
        "COURSE_PURCHASE_MODE_LOCKED",
        "sectional course has at least one bundle buyer"
      );
    }
    return;
  }

  // normalizedCurrent === 'full', trying to flip to sectional.
  const completedSnap = await db
    .collection("enrollments")
    .where("courseId", "==", courseId)
    .where("status", "==", "completed")
    .limit(1)
    .get();

  if (!completedSnap.empty) {
    throw new CourseMutationLockedError(
      "COURSE_PURCHASE_MODE_LOCKED",
      "full-mode course has at least one completed enrollment"
    );
  }
}
