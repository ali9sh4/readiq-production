# Web App — Project State / Changelog

Running log of notable web-app (this repo) changes. The mobile board lives in
`docs/MOBILE_PROJECT_STATE.md`; this file is for the Next.js web app.

---

## 2026-06-29 — Navigation slowness + jarring skeleton fix (Symptom 1)

Branch: `perf/nav-and-route-loading`. Implements **only** Symptom 1 from
`docs/NAV_AND_COURSE_EDITOR_AUDIT.md`. Symptoms 2 (cover-photo delete bounce)
and 3 (small-screen create-course guard) are intentionally untouched — separate
branches/sessions.

### Step 1 — `NavigationButton` no longer feels laggy
- `components/NavigationButton.tsx`: removed the fixed `setTimeout(..., 1000)`
  fake spinner (it was decoupled from real navigation). The component is now a
  styled, **prefetching** `next/link` instead of `router.push`, and the pending
  spinner is driven by `useLinkStatus` (Next 15.3+) so it reflects the actual
  App Router transition. Old implementation preserved in a trailing comment.
- `app/user_dashboard/createdCourses/page.tsx` and `app/course-upload/page.tsx`:
  dropped the redundant `<Button asChild>` wrapper around `NavigationButton`
  (was nested buttons); the single styled link-button carries the classes.

### Step 2 — route-level loading skeletons (kills the jarring snap)
- Added `app/course-upload/loading.tsx` and `app/admin-dashboard/loading.tsx`
  (segments previously had no `loading.tsx`). Both approximate the destination
  layout (header band + card grid) rather than a bare centered spinner.
- Added `app/user_dashboard/createdCourses/loading.tsx` so that slow grid route
  shows a content-shaped skeleton instead of the global centered spinner in
  `app/user_dashboard/loading.tsx` (left in place for the other sub-routes).

### Step 3 — stop the multi-second blocking stall
- `data/auth-server.ts`: wrapped `getCurrentUser` in React `cache()` to dedupe
  its two Firebase-Auth round-trips across layout + page in one request. Auth
  semantics unchanged (still `verifyIdToken` then `getUser`; the two are a real
  dependency so they remain sequential).
- `components/instructorCourse.tsx`: the independent `searchParams` and
  `cookies()` awaits now resolve concurrently via `Promise.all`. The
  `getCurrentUser → getCourses` dependency chain stays sequential.
- `components/CoursesGridSkeleton.tsx` (new): shared grid skeleton used as a
  `<Suspense>` fallback. Both course-listing pages now wrap `<InstructorCourse>`
  in `<Suspense>`, so the page shell paints immediately and the Firestore-backed
  course list streams in.

### Verification
- `npx tsc --noEmit`: no new errors (only pre-existing `admin/sync-enrollments`
  non-default-export and `[courseId]` non-Promise-`params` errors, unrelated).
- `npm run build`: compiled successfully, 54/54 pages generated.
- Manual route-load check (prod server): `/`, `/login`, `/register` → 200;
  protected routes (`/course-upload`, `/user_dashboard/*`, `/admin-dashboard`)
  → 307 redirect to `/` (expected, no auth cookie); no 500s.

### Flagged / intentionally untouched
- `app/user_dashboard/layout.tsx:147` hydration gate (`if (!auth.isClient)`)
  was **left as-is**. It is a client hydration gate, not the auth gate (auth is
  enforced by middleware), but removing it from a `"use client"` layout risks a
  hydration-mismatch flash and is outside the low-risk envelope of this change.
  Noted for a future pass per audit Symptom 1 root cause #5.
- Admin dashboard's client-side full-collection `onSnapshot` load (audit root
  cause #6) is out of scope here; the new `loading.tsx` only covers the
  navigation/RSC phase, not the post-mount client data load.
- Protected files (`authContext.tsx`, `middleware.ts`, auth form/actions) were
  not modified.
