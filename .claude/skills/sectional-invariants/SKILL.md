---
name: sectional-invariants
description: >-
  Use whenever working on code that touches courses, course enrollment, course
  access, video locking, the Mux playback gate, or anything under the sectional
  purchasing system (purchaseMode, accessScope, sections, ownedSectionIds,
  fullCoursePrice). This skill defines seven non-negotiable invariants for
  sectional course purchasing. Read it before changing sectional_* files, the
  playback-token route, enrollment logic, or any access/lock predicate. Getting
  one of these wrong produces a money or access bug.
---

# Sectional Purchasing Invariants

Rubik courses can be sold two ways: as a full bundle, or section-by-section.
The system that supports this is correct only because seven invariants hold
everywhere. A change that violates any one of them is not a style issue — it
is a bug that either lets someone access content they did not pay for, or
charges them wrongly, or strands a paying user.

Read this before touching: anything in `app/actions/sectional_*`,
`lib/sectional/*`, `lib/courses/assertCourseMutationAllowed.ts`,
`lib/courses/videoAccess.ts` (the shared per-video access predicate),
`app/api/mux/playback-token/route.ts`, enrollment creation/reading, or any
video lock / access predicate on web or mobile.

## The seven invariants

1. **`course.purchaseMode === 'sectional'` is the only activator.** Sectional
   logic runs if and only if `purchaseMode` is exactly `'sectional'`. The mere
   presence of a `sections[]` array is NOT a signal. A course with `sections[]`
   but `purchaseMode` unset or `'full'` is a normal full-course — treat it as
   one.

2. **`enrollment.accessScope` is the single source of truth for access.** Not
   the enrollment's existence, not its `status`, not a boolean. When deciding
   what a user can access, consult `accessScope`.

3. **Unset `accessScope` means grandfathered full access.** Enrollments created
   before sectional purchasing existed have no `accessScope`. They get full
   access to the whole course. Never overwrite or "migrate" an unset
   `accessScope` — unset is a meaningful value.

4. **A bundle buyer writes `accessScope: 'full'`. A per-section buyer writes
   `accessScope: 'sectional'`** and merges the purchased section IDs into
   `ownedSectionIds[]`. These are the only two write patterns.

5. **The server rejects a per-section purchase if `accessScope !== 'sectional'`.**
   A user who already has full access (bundle buyer, or grandfathered) must not
   be able to buy an individual section — there is nothing to sell them. The
   rejection is `ALREADY_FULL_ACCESS`.

6. **A sold section is immutable.** Once any user owns a `sectionId`, that
   section's ID, its existence, and its minimum price are frozen. `purchaseMode`
   itself locks at the first sale OR the first enrollment of any kind. The lock
   helper `lib/courses/assertCourseMutationAllowed.ts` enforces this — route
   mutations through it; do not bypass it.

7. **The server-side gate is the real access gate — its predicate is
   `evaluateVideoAccess()` in `lib/courses/videoAccess.ts`.** The Mux
   playback-token route wraps it for playback (`allowFreePreview: true`);
   study surfaces call it directly (`allowFreePreview: false`). Editing "the
   gate" means editing the helper, not the route. Any client-side lock (web
   or mobile) is UX only — it exists to *predict* what the server will allow.
   A client lock that is more restrictive than the server strands the user;
   one that is more permissive lies to them. Client locks must mirror the
   server gate, not diverge from it.

## Practical consequences

- **Full-course purchase actions must reject sectional courses (invariant 1, the
  money side).** `purchaseMode === 'sectional'` gates the *access* logic — it
  must ALSO gate the *sale*. The legacy full-course path
  (`purchaseCourseWithWallet` in `app/actions/wallet_actions.ts`, and
  `POST /api/enrollments`) charges `course.price` / `salePrice` and writes an
  enrollment with **no `accessScope`** — which invariant 3 grants as full
  access. On a sectional course `course.price` is typically unset, so without a
  guard the buyer gets the whole course for **0 IQD** (audit finding M1, a P0).
  Both paths now reject with `COURSE_NOT_SECTIONAL`; keep it that way and add the
  same guard to any new full-course purchase/enrollment entry point. (Also reject
  `coursePrice <= 0` on a non-free full course — an unpriced course must never be
  purchasable.)

- **Deciding if a video is locked** — evaluate top to bottom, first match wins:

  ```
  if video.isFreePreview            -> UNLOCKED   # checked first, before any sectional logic
  if enrollment.accessExpiresAt has passed
                                    -> LOCKED     # time-limited access (2026-07): ACCESS_EXPIRED.
                                                  # Unset = lifetime. Only occurs on full-mode
                                                  # courses (sectional × time-limited are mutually
                                                  # exclusive). Helper: isAccessExpired() in
                                                  # lib/courses/accessDuration.ts
  if course.purchaseMode !== 'sectional'
      if userEnrolled               -> UNLOCKED
      else                          -> LOCKED
  # course IS sectional from here on:
  if not userEnrolled               -> LOCKED
  if enrollment.accessScope is unset or 'full'
                                    -> UNLOCKED   # bundle buyer / grandfathered
  # accessScope === 'sectional':
  if video.sectionId is unset       -> UNLOCKED   # untagged video, server grants it
  if video.sectionId in enrollment.ownedSectionIds
                                    -> UNLOCKED
  else                              -> LOCKED
  ```

- **Untagged videos on a sectional course**: a video with no `sectionId` on a
  sectional course is granted by the server's playback gate
  (`sectional_untagged_video`). Client lock predicates must match — do not lock
  an untagged video the server would allow.

- **Changing a course's mode or sections**: always route through
  `assertCourseMutationAllowed`. It enforces invariant 6. Never write
  `purchaseMode`, delete a section, or lower a section price directly without
  passing the lock check.

- **Reading enrollment for access decisions**: never collapse it to a boolean.
  `accessScope` + `ownedSectionIds` is the unit of access. A user who owns 2 of
  3 sections is neither "enrolled" nor "not enrolled" in the old binary sense.

## If a change seems to require violating an invariant

Stop and surface it. The invariants are load-bearing. If a task genuinely
cannot be done without breaking one, that is a signal the task needs rethinking
or explicit human sign-off — not a signal to break the invariant quietly.