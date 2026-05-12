# Phase 2 — Access Gate (Sectional Purchasing)

> Save as `docs/prompts/NNN-sectional-phase-2-access-gate.md`
> Phase 2 of 7. Phase 1 (schema + backfill) shipped and verified on production.
> **Ship this phase to main before starting Phase 3.** Behavior changes only for courses manually flipped to `purchaseMode: 'sectional'` (zero today).

---

## Goal of Phase 2

Make the access check correct for sectional courses **without shipping any purchase UI.** After this phase:

- A user with `enrollment.ownedSectionIds: ['sec_xyz']` on a sectional course can play videos in `sec_xyz` and is denied playback for every other video in that course.
- A user with `enrollment.isFullAccess: true` (legacy or future bundle buyers) still plays everything.
- A user with no enrollment doc still gets the same denial they get today.
- Courses with `purchaseMode` unset or `'full'` behave **identically to today.** This is the safety net — Phase 2 must not regress the existing catalog.

The gate becomes the source of truth. Phases 3+ build the purchase flow on top of a check that's already correct, so a bug in the purchase code can never accidentally grant access — the gate would catch it.

---

## Phase 1 recap — what's already in the codebase

Already landed in `types/types.ts`:
- `Course.purchaseMode?: 'full' | 'sectional'` (missing = `'full'`)
- `Course.fullCoursePrice?: number`
- `Course.sections?: CourseSection[]` with `{ sectionId, title, order }`
- `CourseVideo.sectionId?: string` (FK into `Course.sections[]`)
- `Enrollment.accessScope?: 'full' | 'sectional'` (missing = `'full'`)
- `Enrollment.ownedSectionIds?: string[]`

Already run on production:
- Backfill stamped `sectionId`s on every video that had a section label. One course currently has populated `sections[]` (`anVKnYHlsyx8nTvwsZdt` — "From Diagnosis to Extraction"). No course has `purchaseMode` set yet.

---

## Locked Discriminator Rule (Re-Read Before Writing Code)

**Sectional mode is determined by `course.purchaseMode === 'sectional'` and nothing else.**

- The presence of `course.sections[]` is **not** a signal of sectional mode. After backfill, many existing courses have populated `sections[]` while still being full-course-only. Reading `sections.length > 0` as "is sectional" silently flips your whole catalog into sectional mode and lets free videos become locked.
- The presence of `enrollment.ownedSectionIds` is **not** a signal either. Future code may write empty arrays.
- Only `course.purchaseMode === 'sectional'` activates sectional gating. Everywhere else, fall through to the existing full-course logic.

This rule is non-negotiable. Phase 2 will be reviewed against it.

---

## Tasks

### 1. Add `getEnrollmentDetails(uid, courseIds)` sibling

In `app/actions/enrollment_action.ts` (alongside the existing `checkUserEnrollments`):

```ts
export async function getEnrollmentDetails(
  uid: string,
  courseIds: string[]
): Promise<Record<string, Enrollment | null>>
```

Returns the full `Enrollment` doc per courseId, or `null` if not enrolled. Uses the same `enrollments/{uid}_{courseId}` lookup pattern as `checkUserEnrollments`. Reads with Admin SDK (server-side only — same context as the existing function).

- **Do NOT modify `checkUserEnrollments`'s signature.** Every existing caller stays untouched.
- New function used in this phase by exactly two places: the Mux playback-token route and the course page (for rendering, Phase 6 will use it more).

### 2. Update the Mux playback-token route — the load-bearing change

`app/api/mux/playback-token/route.ts`

Current behavior (lines 60–77 area): grants a signed playback URL if the user is the course owner, an admin, the video has `isFreePreview: true`, or `enrollments/{uid_courseId}.status === 'completed'`.

New behavior:

```
1. Owner / admin / isFreePreview → grant (unchanged)
2. Load the enrollment doc via getEnrollmentDetails
3. If no enrollment → deny (unchanged)
4. If enrollment.status !== 'completed' → deny (unchanged)
5. Load the course doc (you already need it for the video record — reuse, don't re-fetch)
6. If course.purchaseMode !== 'sectional' → grant (legacy full-course path, unchanged behavior)
7. course.purchaseMode === 'sectional' branch:
   a. If enrollment.isFullAccess === true → grant (bundle buyer)
   b. Find the video being requested in course.videos[]; read its sectionId
   c. If video has no sectionId → grant (untagged videos remain accessible per Phase 1 spec)
   d. If enrollment.ownedSectionIds?.includes(video.sectionId) → grant
   e. Otherwise → deny
```

Critical implementation notes:

- **Update the access-reason log.** Whatever the route currently logs as a denial reason ("not enrolled", "course not free", etc.), add the new reasons: `'sectional_section_not_owned'`, `'sectional_video_missing_section_id'` (the latter for diagnostics, even though it currently grants). When this gate misfires in production you will want these logs.
- **Do not duplicate the course fetch.** The route already loads the course to find the video. Reuse that read for `purchaseMode` and `sections[]`.
- **Default to `'full'` when `purchaseMode` is undefined.** Treat the absent value as `'full'` explicitly in code; do not let `=== 'sectional'` checks pass for `undefined` by accident.
- **`isFullAccess` may be undefined on legacy enrollments.** Treat undefined as the legacy meaning: the existing `status === 'completed'` check already covered full-course access pre-sectional. For a course with `purchaseMode: 'sectional'`, undefined `isFullAccess` means "this enrollment was created before sectional existed, or via the future per-section purchase path." The discriminator is: "did this user buy the bundle?" — represented by `isFullAccess === true`. Anything else, fall through to the `ownedSectionIds` check.

  **Edge case to handle now**: a course that gets flipped from `'full'` to `'sectional'` after enrollments exist. Those legacy enrollments don't have `isFullAccess: true` (Phase 1 didn't backfill it). For Phase 2's correctness, treat enrollments where `accessScope` is unset/`'full'` AND `status === 'completed'` as full-access regardless of `isFullAccess`. In other words: legacy enrollments = full access. Phase 5 will introduce the mode-switch policy that prevents this ambiguity going forward; Phase 2's job is to not break existing students.

### 3. Update the course page's enrollment check

`app/course/[courseId]/page.tsx`

The page currently calls `checkUserEnrollments(uid, [courseId])` and renders `CoursePlayer` if true, `CoursePreview` if false. Phase 2's job here is minimal:

- Replace the boolean check with `getEnrollmentDetails(uid, [courseId])` to obtain the full enrollment doc.
- Pass the enrollment doc (or just `ownedSectionIds: string[] | undefined` and `isFullAccess: boolean | undefined`) into `CoursePlayer` as new optional props.
- **`CoursePlayer` itself: do not change behavior in Phase 2.** Accept the new props, but don't yet render locked-section UI. That's Phase 6.
- Keep the boolean fallback for the `CoursePlayer` vs `CoursePreview` decision: if `enrollment === null`, show preview; if enrollment exists with `status === 'completed'`, show player. Sectional users see the full player; the Mux token route enforces per-video access. They'll experience denied videos as playback errors until Phase 6 makes the locks visible — that's acceptable for Phase 2 because no real user is on a sectional course yet (we'll only flip one test course manually).

### 4. Firestore security rules

`firestore.rules`

Goal: a user who owns some sections of a sectional course can still **read** the full course document (sections list, video metadata, titles) to know what they own and what they could buy. They **cannot** play locked videos — that's enforced by the Mux token route, not rules, because rules can't read across collections cheaply enough to gate per-video.

Specifically:

- Existing course-read rule: keep as-is. Course docs remain publicly readable (or whatever the current policy is) — sectional doesn't change "can I see this course exists."
- Existing enrollment rules: keep as-is. Users read their own enrollment, admins read all.
- **New consideration**: if any rule currently gates video metadata reads (e.g. lesson content fetched separately) on "user is enrolled in this course," that gate still works under sectional — the enrollment doc exists for sectional buyers too. Survey the rules file for anything that reads `course.purchaseMode` or `enrollment.ownedSectionIds` and explain why each touched rule is or isn't sufficient. If the rules don't currently gate video metadata at all (because everything routes through the Mux token endpoint), say so and confirm Phase 2 needs no rules changes.

**If the rules turn out to need no changes, that is a valid outcome.** Document it explicitly in the report. Do not invent changes for the sake of "doing rules."

### 5. Test harness — manual end-to-end verification

After the code lands, write a short test plan in the report (do not execute it — I'll run it manually):

```
1. In Firestore, flip course anVKnYHlsyx8nTvwsZdt to purchaseMode: 'sectional'.
2. Create or modify a test enrollment for a test user on that course:
   { accessScope: 'sectional', ownedSectionIds: ['sec_xXpqKOXosA'], status: 'completed', isFullAccess: false }
3. Log in as the test user, open the course.
4. Expected: video in القسم 1 plays. Video in القسم 2 or القسم 3 fails with playback error.
5. Check server logs: denial reason logged as 'sectional_section_not_owned'.
6. Flip the same enrollment: { isFullAccess: true }.
7. Expected: all videos play.
8. Flip the course back to purchaseMode: 'full' (or unset).
9. Expected: all videos play for any enrollment with status: 'completed'.
10. Test a separate course (any of the 7 with no sections[]) — confirm absolutely nothing about its behavior has changed.
```

### 6. Do NOT touch in this phase

- `purchaseCourseWithWallet`, `purchaseSectionsWithWallet` (Phase 3).
- ZainCash init/webhook (Phase 4).
- Instructor UI in `CourseDashboard` / course-upload editor (Phase 5).
- `CoursePlayer.tsx`'s locked-section rendering, "Buy section" CTAs, bundle upsell sheet (Phase 6).
- Mobile API surfaces (`/api/me/enrollments`, mobile course endpoints) (Phase 7).
- `enrollmentCount` increment logic (Phase 7).
- Certificates, progress %, completion (Phase 7).
- `checkUserEnrollments` signature (untouched forever in this project).

If something here needs changing to make Phase 2 correct, surface it — don't silently expand scope.

---

## Deliverables

1. `getEnrollmentDetails` function in `app/actions/enrollment_action.ts`.
2. Updated `app/api/mux/playback-token/route.ts` with the new gate logic and updated denial-reason logs.
3. Updated `app/course/[courseId]/page.tsx` passing enrollment details into `CoursePlayer` (new optional props; no behavior change in `CoursePlayer` itself yet).
4. Firestore rules update **if needed**, with rationale.
5. Test plan in the report.
6. Report at the end of the chat:
   - Files changed (paths only).
   - Confirm the discriminator rule (`course.purchaseMode === 'sectional'` and nothing else) is the only condition activating sectional logic.
   - Anything in the existing route that you had to refactor for correctness (e.g. existing course fetch was duplicate, an existing log was misleading, etc.).
   - Anything ambiguous about the legacy-enrollment edge case in Task 2 — your read on whether the "legacy enrollments = full access" rule is sufficient or whether Phase 5's mode-switch policy needs to land sooner.
   - Whether the Firestore rules required changes, and why.
   - Test plan ready for manual execution.

---

## Constraints

- Keep all new code paths inert for courses with `purchaseMode` unset or `'full'`. If a code review on this PR can't immediately tell that "this won't touch any existing course's behavior," the change is too invasive.
- No new dependencies.
- No data migrations.
- Match existing code style and logging patterns in the route.
- If you find a bug in the existing playback-token route while you're in there (e.g. an ownership check that's slightly wrong), **flag it in the report but do not fix it in this PR.** Scope creep is how Phase 2 gets stuck.