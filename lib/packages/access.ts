import type { Course, Enrollment } from "@/types/types";

// Does `enrollment` grant the user FULL access to `course`?
//
// This is the eligibility predicate for package purchases: a package is
// purchasable only if the buyer does NOT already have full access to any
// included course (a full or free enrollment blocks; partial section
// ownership does not).
//
// It mirrors the sectional access invariants exactly:
//   - No enrollment, or not `completed`           -> not full access.
//   - Standalone course (`purchaseMode` unset/'full'): any completed
//     enrollment IS full access. This also covers free enrollments
//     (`enrollmentType: 'free'`) — they block, as specified.
//   - Sectional course: full access means `accessScope` unset
//     (grandfathered) OR explicitly 'full'. A per-section buyer
//     (`accessScope: 'sectional'`) does NOT have full access, so a
//     partial owner can still buy the package — it upgrades them.
//
// `accessScope` is the single source of truth; never collapse the
// enrollment to a boolean elsewhere.
export function hasFullAccess(
  course: Pick<Course, "purchaseMode">,
  enrollment: Pick<Enrollment, "status" | "accessScope"> | null | undefined
): boolean {
  if (!enrollment || enrollment.status !== "completed") return false;
  if (course.purchaseMode !== "sectional") return true;
  return enrollment.accessScope == null || enrollment.accessScope === "full";
}

// Does the buyer own SOME (but not all) sections of a sectional course —
// i.e. would a package purchase upgrade an existing partial enrollment to
// full access? Used to drive the concrete partial-ownership disclosure in
// the checkout dialog. False for standalone courses and for buyers with no
// enrollment or already-full access.
export function isPartialSectionalOwner(
  course: Pick<Course, "purchaseMode">,
  enrollment: Pick<Enrollment, "status" | "accessScope"> | null | undefined
): boolean {
  if (!enrollment || enrollment.status !== "completed") return false;
  if (course.purchaseMode !== "sectional") return false;
  return enrollment.accessScope === "sectional";
}
