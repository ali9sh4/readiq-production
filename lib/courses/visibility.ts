/**
 * Public-catalog visibility predicate. Mirrors the filter used by the home
 * page (`app/page.tsx`) and the public catalog endpoint (`/api/courses`).
 *
 * A course is visible to unauthenticated and unenrolled users when:
 *   - status === "published"
 *   - isApproved === true
 *   - isRejected !== true
 *   - isDeleted !== true
 */
export function isCoursePubliclyVisible(c: Record<string, unknown>): boolean {
  return (
    c.status === "published" &&
    c.isApproved === true &&
    c.isRejected !== true &&
    c.isDeleted !== true
  );
}
