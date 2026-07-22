---
name: course-authorization
description: >-
  Use whenever adding or editing a server action that WRITES or READS a course by
  a caller-supplied courseId — app/course-upload/action.ts, app/actions/basic_info_actions.ts,
  app/actions/sectional_config_actions.ts, app/actions/upload_video_actions.ts —
  or a course editor/dashboard page (app/course-upload/edit/[courseId]). Read
  before adding any new course-mutation entry point. This is the OWNERSHIP axis
  (who may mutate/see a course), distinct from the visibility/publishing axis in
  the course-approval skill. Getting it wrong is a cross-tenant read or write hole
  (an instructor editing another instructor's course). Canonical diagnosis:
  docs/AUDIT_SYSTEM_HEALTH.md (Area 1); the fixes are commits 3b8a477 (writes) and
  017661f (the editor-page read).
---

# Course Authorization (ownership)

Every course-mutation server action and every course-editor page must confirm
the caller **owns the course or is an admin** — token verification alone is not
authorization.

## The canonical guard

Load the course doc, then:

```ts
const isOwner = courseData?.createdBy === verifiedToken.uid;
const isAdmin = verifiedToken.admin === true;
if (!isOwner && !isAdmin) return { /* action's own failure shape */ };
```

- **Admin is the token CLAIM (`verifiedToken.admin === true`), never the
  `FIREBASE_ADMIN_EMAIL` fallback.** Server actions and Firestore rules cannot
  see the env fallback; the admin account carries the real claim (set lazily by
  `setToken` on that email's sign-in). The twelve already-correct siblings —
  `updateCourseThumbnail`, `updateCourseBasicInfo`, `updateCoursePricing`,
  publish/unpublish, and all of `upload_video_actions.ts` — use exactly this.
- **Reuse the snapshot the function already reads** (these actions load the
  course before their `assertCourseMutationAllowed` call) — insert the guard
  after that read, before the write. No second `.get()`.
- **Return the action's own failure shape.** These files use
  `{ error: true, message }` or `{ success: false, error: true, message }` — not
  the `{ success: false, error: "Permission denied" }` string shape of
  `basic_info_actions.ts`. Match the file you're in; the client toasts
  `result.error`/`message` verbatim, so an English code in an Arabic file is a
  visible bug.

## `assertCourseMutationAllowed` is NOT an ownership check

`lib/courses/assertCourseMutationAllowed.ts` enforces only the **sold-section
lock** and the **purchase-mode-flip lock** (invariant 6 of the sectional
system). It **no-ops** for a thumbnail / files / status payload (no `sections`
or `purchaseMode` key). It provides zero protection against a non-owner. Never
treat "routes through the lock helper" as "authorized."

## Server action imported by a `'use client'` component = a public endpoint

Next.js exposes any `"use server"` action imported (transitively) by a client
component as a callable HTTP endpoint whose id ships in the bundle. So "the UI
only calls this for the owner's own course" is not a gate. This session found
four token-verified-but-unguarded actions in `app/course-upload/action.ts`
(`SaveThumbnail`, `saveCourseFilesToFirebase`, two `updateCourseStatus`,
`deleteCourseMetaDataFile`) — cross-tenant write holes. Any new course-write
action needs the guard even if "no UI calls it that way."

## Editor / dashboard PAGES need it too

A page that loads a course by id (`app/course-upload/edit/[courseId]/page.tsx`)
must gate on ownership before rendering — the middleware matcher only proves the
visitor is **logged in**, not that the course is theirs. Verify the token, load
the course, compare `createdBy`, admit admins, else redirect (`/login` for
absent/invalid token, `/` for authenticated-but-not-owner — the middleware
admin-area convention). `redirect()` must be **outside** any catch-all try/catch
(see the auth-session-lifecycle skill).

## Gotchas

- **Identity must come from the verified token, not a header.** The
  `x-user-id` request header middleware sets is client-spoofable (OPEN finding
  NEW-1); never authorize a course mutation off it.
- **`DeleteThumbnail` is inconsistent — do not copy it.** It gates owner-only
  (`createdBy !== uid`, no `|| isAdmin`), so an admin cannot delete another
  instructor's thumbnail. It's a stricter bug, not a hole; backlogged. Use the
  canonical `isOwner || isAdmin`.
- **Course creation is open to any authenticated user** (`SaveNewProperty` sets
  `createdBy = uid`), so the attacker set for any missing guard is *every*
  registered user — there is no separate "is an instructor" gate.
