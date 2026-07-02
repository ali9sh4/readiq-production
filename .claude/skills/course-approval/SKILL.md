---
name: course-approval
description: >-
  Use whenever working on course visibility, publishing, or admin approval —
  app/admin-dashboard/* (approveCourse, resetCourseStatus, the dashboard tabs),
  lib/courses/visibility.ts (isCoursePubliclyVisible), publishCourse/unpublishCourse
  in app/actions/basic_info_actions.ts, course creation initial state in
  app/course-upload/action.ts, the course_deletion lifecycle, or any catalog/API/
  playback predicate that decides whether a course is shown. Read before changing
  any isApproved/isRejected/status/isDeleted gate or admin access control.
  Canonical doc: docs/COURSE_APPROVAL_PUBLISHING.md.
---

# Course Approval, Publishing & Admin Dashboard

Full reference: **`docs/COURSE_APPROVAL_PUBLISHING.md`**. This skill is the
load-bearing summary — read the doc before non-trivial changes.

## The one rule that matters: the dual gate

A course is publicly visible only when **two orthogonal gates** both hold, and it
isn't deleted:

```
status === "published"   (instructor-controlled, via publishCourse)
  AND isApproved === true (admin-only, via approveCourse)
  AND isRejected !== true
  AND isDeleted !== true
```

Canonical predicate: `lib/courses/visibility.ts` → `isCoursePubliclyVisible`.

- **Instructor** owns `status`. They can publish immediately — **no approval
  needed to publish** — it just stays invisible until approved.
- **Admin** owns `isApproved` / `isRejected`. Approval is independent of `status`.
- Rejecting a published course hides it **without** changing `status`.
- "Pending" is not a stored state — it's just `!isApproved && !isRejected`, true
  from creation. There is no "submit for review" step; new courses show in the
  admin pending queue immediately (including drafts).

## Don't break these

1. **Never gate visibility on `isApproved` alone or `status` alone.** Both, plus
   `!isRejected` and `!isDeleted`. Prefer reusing `isCoursePubliclyVisible`.
2. **Two visibility code paths exist** — the catalog uses `getCourses()` filters
   in `data/courses.ts`; API/playback use `isCoursePubliclyVisible`. Change one,
   change both, or they drift.
3. **Admin mutations re-verify the `.admin` claim server-side** (`verifyIdToken`),
   never trust the client. Middleware gates the `/admin-dashboard/*` page route;
   the layout has no guard.
4. **Admin status comes only from `FIREBASE_ADMIN_EMAIL`** matched at token
   refresh — there is no promotion UI.
5. **Approval/publish mutations run through `assertCourseMutationAllowed`** — a
   sectional course with enrollments may be locked. See the `sectional-invariants`
   skill.
6. **Deletion is soft-then-permanent.** `softDeleteCourse` → `isDeleted`,
   `status: "archived"`. `restoreDeletedCourse` (admin) → back to `draft` (must
   re-publish, still needs approval). `permanentlyDeleteCourse` (admin, requires
   prior soft-delete) cascades Mux assets, R2 files, enrollments, favorites.

## Key files
- `lib/courses/visibility.ts` — the predicate
- `app/admin-dashboard/action.ts` — approveCourse / resetCourseStatus / getCourseStats
- `app/admin-dashboard/page.tsx` — dashboard UI (pending/approved/rejected/topups/deleted)
- `app/actions/basic_info_actions.ts` — publishCourse / unpublishCourse
- `app/course-upload/action.ts` — creation initial state + updateCourseStatus
- `app/actions/course_deletion_action.ts` — soft/restore/permanent delete
- `app/api/mux/playback-token/route.ts` — per-video access gate
- `middleware.ts` + `context/actions.ts` — admin gating + claim source
</content>
