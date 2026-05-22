# Phase 1 — Schema & SectionId Backfill (Sectional Purchasing)

> Save as `docs/prompts/NNN-sectional-phase-1-schema.md`
> Phase 1 of 7. Read `docs/prompts/NNN-sectional-purchasing-discovery.md` first for full context.
> **Ship this phase to main before starting Phase 2.** No behavior changes — only schema, types, and a backfill.

---

## Goal of Phase 1

Land the data model for sectional purchasing **without changing any user-visible behavior.** Every existing course, enrollment, purchase, and access check must work identically after this phase. The flag is added, the fields exist, the backfill mints stable section IDs — but `purchaseMode` defaults to `'full'` everywhere, so the new code paths stay dormant until later phases activate them.

---

## Locked Decisions (Do Not Relitigate)

These were settled in product + discovery rounds. Implement as specified.

- **One course type, not two.** `purchaseMode: 'full' | 'sectional'` is a flag on the Course doc. Default `'full'`.
- **Sections are a typed embedded array on Course**, not a subcollection. Each section has a stable `sectionId`.
- **Enrollment doc stays the same shape** (`enrollments/{uid_courseId}`) — extended with `accessScope` and `ownedSectionIds[]`. No new collection.
- **Existing `CourseVideo.section` free-text string is preserved** for back-compat. A new `sectionId` field is added alongside it.
- **Existing enrollments are implicitly full-access.** Missing `accessScope` means `'full'`. No migration of the enrollments collection required.

---

## Tasks

### 1. Update TypeScript types

In `types/types.ts` (and wherever Course/Section/Enrollment types live):

**Course** — add:
```ts
purchaseMode?: 'full' | 'sectional'   // missing = 'full'
fullCoursePrice?: number              // bundle price when sectional; falls back to existing `price` if absent
sections?: CourseSection[]
```

**New type `CourseSection`:**
```ts
{
  sectionId: string         // stable, e.g. `sec_${nanoid(10)}`
  title: string             // mirrors the legacy free-text label
  order: number             // explicit ordering, no more hardcoded Arabic-string list
  price?: number            // section price for sectional mode
  salePrice?: number        // optional sale price
  isLocked?: boolean        // true once any user has paid for this section (set by future phases, not this one)
}
```

**CourseVideo** — add:
```ts
sectionId?: string   // FK into Course.sections[]; section: string stays for back-compat
```

**Enrollment** — add:
```ts
accessScope?: 'full' | 'sectional'   // missing = 'full' (legacy)
ownedSectionIds?: string[]            // populated by future phases
```

Update Zod schemas / Firestore converters wherever they exist for these types. Keep all new fields optional so existing docs validate.

### 2. Write the sectionId backfill script

A one-shot Node script at `scripts/backfill-section-ids.ts`. Requirements:

- Read every course in `courses/`.
- For each course, scan `videos[].section` (the free-text string).
- Collect the distinct section labels **in their existing order of first appearance** in the videos array. Trim whitespace, normalize.
- For each distinct label, mint a `sectionId` (`sec_${nanoid(10)}`) and build the `Course.sections[]` array with `{ sectionId, title: label, order: index }`. Do not set `price`, `salePrice`, or `isLocked`.
- Walk `videos[]` again and set each video's `sectionId` based on its `section` string.
- Videos with no `section` string get no `sectionId` (leave the field unset). They remain accessible under the existing full-course flow.
- Write back atomically per course in a single Firestore update.
- **Idempotent**: if `Course.sections[]` already exists for a course, skip it.
- **Dry-run mode** behind a `--dry-run` flag. Default to dry-run. Require `--commit` to actually write.
- Print a per-course summary: course title, distinct labels found, section IDs minted, videos updated.
- Print an end-of-run summary: total courses processed, total skipped (already migrated), total sections minted, total videos updated.

Use Firebase Admin SDK with whatever service-account pattern this repo already uses for other scripts. Match existing script conventions.

### 3. Do NOT touch in this phase

- `app/api/mux/playback-token/route.ts` — Phase 2.
- `purchaseCourseWithWallet` or any wallet code — Phase 3.
- ZainCash init/webhook — Phase 4.
- `CoursePlayer.tsx`, `CourseDashboard.tsx`, course-upload UI — Phases 5–6.
- Firestore security rules — Phase 2.
- `checkUserEnrollments` signature — leave alone (Phase 2 adds a sibling).
- Mobile API surfaces — Phase 7.

If you find yourself needing to change one of these to make Phase 1 work, **stop and surface the issue** instead of making the change.

### 4. Verify nothing broke

- Run the existing typecheck and lint.
- Manually trace one free-course enrollment and one paid-course enrollment in your head against the new types: both flows must still compile and behave identically. Note any place where an optional new field could be read as truthy by accident.
- Confirm the backfill script in `--dry-run` mode produces sensible output on the current production data shape (use a sample of course docs if you don't have a staging dump).

---

## Deliverables

1. Type updates in `types/types.ts` (and related Zod / converter files).
2. `scripts/backfill-section-ids.ts` with dry-run default.
3. A short report at the end of the chat:
   - Files changed (paths only).
   - Anything in the existing code that would break or behave subtly differently after these type changes — including type errors surfaced in places I didn't expect.
   - Anything in the backfill where the existing data shape made you uncertain (e.g. courses with empty section strings, duplicate labels, RTL whitespace).
   - Whether `--dry-run` output looks correct on whatever sample data you tested against.

**Do not run `--commit` on production.** I will run the backfill manually after reviewing dry-run output.

---

## Out of Scope (Explicitly)

- Any UI changes.
- Any access-check changes.
- Any purchase-flow changes.
- Any Firestore rules changes.
- Migration of the `enrollments/` collection (none needed — legacy enrollments are implicitly full-access via missing `accessScope`).
- Setting `isLocked` on sections (Phase 3 introduces the sold-section lock).

If something here conflicts with what's actually in the codebase, surface it before changing course.