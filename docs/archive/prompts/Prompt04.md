# Phase 3 — Server-Side Sectional Purchase (Sectional Purchasing)

> Save as `docs/prompts/NNN-sectional-phase-3-server-purchase.md`
> Phase 3 of 7. Phases 1, 2, and 2.5 are shipped and verified end-to-end on real data.
> **Ship this phase to main before starting Phase 4.** No UI changes. ZainCash flow handled in Phase 4. Instructor UI in Phase 5. Buyer UI in Phase 6.

---

## Where things stand (do not re-discover)

Already in the codebase from previous phases:

- `Course.purchaseMode?: 'full' | 'sectional'` (missing = `'full'`)
- `Course.fullCoursePrice?: number`
- `Course.sections?: CourseSection[]` with `{ sectionId, title, order, price?, salePrice?, isLocked? }`
- `CourseVideo.sectionId?: string` (stamped on every video that had a section label, via Phase 1 backfill)
- `Enrollment.accessScope?: 'full' | 'sectional'` (missing = `'full'`; this is the **single** access discriminator — `isFullAccess` was removed in Phase 2.5)
- `Enrollment.ownedSectionIds?: string[]`
- Mux playback-token route enforces section ownership for `purchaseMode === 'sectional'` courses.
- One course has populated `sections[]` from backfill: `anVKnYHlsyx8nTvwsZdt`. No course has `purchaseMode` set in production.
- Existing `purchaseCourseWithWallet` in `app/actions/wallet_actions.ts` handles the legacy full-course purchase. Phase 3 does not modify it.

The seven locked rules from earlier phases live in the `sectional-invariants`
skill (`.claude/skills/sectional-invariants/SKILL.md`) — the single source of
truth.

---

## Goal of Phase 3

Land the server-side machinery to:

- Sell individual sections via wallet.
- Sell the bundle via wallet on a sectional course.
- Compute "buy up to here" pricing with smart-subtract.
- Compute bundle break-even offers.
- Enforce sold-section locks at the mutation layer.
- Reject double-charges defensively.

**No UI.** No instructor pricing UI, no buyer CTAs. Phase 3's deliverable is callable from `curl` or a server action; Phases 5–6 wire up the UI on top.

After Phase 3 ships, you can hand-craft an HTTP request (or call a server action from a temporary debug page) and verify: money moves correctly, enrollment updates correctly, locks fire correctly, the Mux gate sees the new `ownedSectionIds` and grants playback.

---

## Tasks

### 1. New file: `app/actions/sectional_wallet_actions.ts`

Two main exported functions plus helpers. Match the style, error handling, idempotency, and logging conventions of `purchaseCourseWithWallet` in `app/actions/wallet_actions.ts`. Do not duplicate primitives; reuse helpers (wallet read/write, transaction record write, instructor earning credit) by exporting them from the existing file if necessary.

#### `purchaseSectionsWithWallet`

```ts
export async function purchaseSectionsWithWallet(
  uid: string,
  courseId: string,
  sectionIds: string[],
  protectionKey: string,
): Promise<PurchaseResult>
```

Behavior (one Firestore transaction, atomic):

1. **Validate inputs.** `sectionIds` non-empty, no duplicates within the request, all strings.
2. **Idempotency check.** If a `wallet_transactions` row exists for `(userId, protectionKey)`, short-circuit and return the prior result. Same pattern as existing wallet code.
3. **Load course.** Reject if `course.purchaseMode !== 'sectional'`. Error code: `COURSE_NOT_SECTIONAL`.
4. **Validate every sectionId** belongs to `course.sections[]`. Reject with `INVALID_SECTION_ID` listing the offending IDs.
5. **Load existing enrollment** (if any). Three cases:
   - **No enrollment** → will create.
   - **Enrollment exists, `accessScope === 'sectional'`** → will merge.
   - **Enrollment exists, `accessScope !== 'sectional'`** (i.e. `'full'` or unset = legacy full access) → **reject with `ALREADY_FULL_ACCESS`**. This is the defensive double-charge prevention. Do not silently grant.
6. **Filter already-owned sections** out of the request — if user already owns 2 of the 3 requested IDs, only charge for the 1 they don't own. (Smart-subtract at the API boundary.) If the resulting `toBuy` set is empty, reject with `ALL_SECTIONS_ALREADY_OWNED`.
7. **Compute total price** by summing each section's `salePrice ?? price`. If any section in `toBuy` has no price set, reject with `SECTION_NOT_PRICEABLE` listing the offending IDs.
8. **Load buyer wallet.** Reject `INSUFFICIENT_BALANCE` if `wallet.balance < totalPrice`. Same shape as existing wallet error.
9. **Load instructor wallet** (course owner's wallet). Create on the fly if it doesn't exist, matching existing pattern.
10. **Inside the transaction:**
    - Debit buyer wallet by `totalPrice`. Update `totalSpent`, `balance`, `balanceBefore`/`balanceAfter`.
    - Credit instructor wallet by `totalPrice` (apply existing platform fee logic, if any, exactly as `purchaseCourseWithWallet` does — do not invent a different revenue split).
    - Write a `wallet_transactions` row with:
      - `type: 'purchase'`
      - `metadata: { courseId, courseTitle, sectionIds: toBuy, isSectionalPurchase: true, protectionKey }`
      - Mirror the description field convention (e.g. Arabic "شراء أقسام من كورس <title>" or similar — match existing tone).
    - Write a matching `wallet_transactions` row for the instructor with `type: 'earning'`.
    - Upsert `enrollments/{uid}_{courseId}`:
      - If new: set `userId`, `courseId`, `status: 'completed'`, `enrollmentType: 'paid'`, `paymentMethod: 'wallet'`, `accessScope: 'sectional'`, `ownedSectionIds: toBuy`, `totalSpent: totalPrice`, `enrolledAt: now`.
      - If existing sectional: `arrayUnion(toBuy)` into `ownedSectionIds`; increment `totalSpent` by `totalPrice`. **Do not change `accessScope`.** **Do not increment `enrollmentCount` on the course.** (More on this below.)
    - Increment `course.enrollmentCount` by **1 only if this is the user's first access to the course** (i.e. no enrollment doc existed before). Subsequent section purchases by the same user do not bump the counter. (Phase 7 will revisit this for full correctness; Phase 3's job is "don't make it worse than today.")
    - For each newly-purchased section, set `course.sections[i].isLocked = true`. Use a single update that maps over the sections array, setting `isLocked: true` for any section whose `sectionId` is in `toBuy`. Leaves price and other fields alone.
11. **Logging**: on success, `console.log('wallet-purchase-sections issued ...', { userId, courseId, sectionIds: toBuy, totalPrice, txId })`. On rejection, `console.log('wallet-purchase-sections REJECTED ...', { userId, courseId, reason, attemptedSectionIds })`.
12. **Return shape**: `{ success: true, txId, ownedSectionIds: <merged result>, charged: totalPrice }` on success; `{ success: false, error: <code>, message: <human-readable>, details?: any }` on rejection. Same error envelope as existing wallet code.

#### `purchaseBundleWithWallet`

```ts
export async function purchaseBundleWithWallet(
  uid: string,
  courseId: string,
  protectionKey: string,
): Promise<PurchaseResult>
```

The "buy the whole course" path when the course is in sectional mode. This is **distinct from** `purchaseCourseWithWallet` (which is for `purchaseMode: 'full'` courses).

Behavior:

1. Validate, idempotency check (same patterns).
2. Reject if `course.purchaseMode !== 'sectional'`. (For `purchaseMode: 'full'`, the existing `purchaseCourseWithWallet` is the correct entry point.) Error code: `COURSE_NOT_SECTIONAL`.
3. Reject if `course.fullCoursePrice` is unset or `<= 0`. Error: `BUNDLE_PRICE_NOT_SET`.
4. Load existing enrollment:
   - No enrollment → create.
   - Existing sectional → **upgrade**: charge `fullCoursePrice - enrollment.totalSpent` if positive, else `0` (free upgrade). This is the break-even outcome — the user has already spent enough.
     - If `0`, still write a `wallet_transactions` row with `amount: 0`, `type: 'purchase'`, `metadata: { upgradeFromSectional: true }` for audit clarity.
   - Existing full or legacy (`accessScope !== 'sectional'`) → reject `ALREADY_FULL_ACCESS`. Same defensive rule.
5. Same atomic transaction pattern as `purchaseSectionsWithWallet`.
6. Enrollment update: set `accessScope: 'full'`. **Clear `ownedSectionIds`** (set to `FieldValue.delete()` — they're now redundant; the user has full access via `accessScope`). Increment `totalSpent` by the charge amount.
7. Lock every section: set `isLocked: true` on every entry of `course.sections[]` (the bundle counts as "selling" each section). Lock `course.purchaseMode` as well — see Task 2.
8. `enrollmentCount` increment: same rule as above — only on first access to the course.
9. Logging and return shape: same conventions.

#### Pure helper: `computeSmartSubtractPrice`

```ts
export function computeSmartSubtractPrice(
  course: Course,
  targetSectionId: string,
  ownedSectionIds: string[],
): { sectionIdsToCharge: string[]; totalPrice: number } | { error: string }
```

Cumulative "buy up to here" math:

- Find the target section's `order` in `course.sections[]`.
- Compute the set of section IDs with `order <= target.order`.
- Subtract anything already in `ownedSectionIds`.
- Sum `salePrice ?? price` over the remaining sections.
- Return `{ sectionIdsToCharge, totalPrice }`.
- If any section in the to-charge set has no price → return `{ error: 'SECTION_NOT_PRICEABLE' }`.
- If the to-charge set is empty (user already owns everything up to target) → return `{ sectionIdsToCharge: [], totalPrice: 0 }` (Phase 6 will use this to disable the CTA).

This is a pure function with no I/O. Easy to unit-test mentally. Phase 6's UI will call it client-side using the course doc; Phase 3 just needs it to exist and be correct.

#### Pure helper: `computeBundleBreakEven`

```ts
export function computeBundleBreakEven(
  course: Course,
  enrollmentTotalSpent: number,
  proposedSectionPurchasePrice: number,
): { offerBundle: false } | { offerBundle: true; bundleDelta: number; savingsVsSectional: number }
```

The upsell-trigger logic:

- If `course.fullCoursePrice` is unset → `{ offerBundle: false }`.
- Compute `projectedSpent = enrollmentTotalSpent + proposedSectionPurchasePrice`.
- If `projectedSpent >= course.fullCoursePrice` → offer the bundle. `bundleDelta = max(0, course.fullCoursePrice - enrollmentTotalSpent)`. `savingsVsSectional = proposedSectionPurchasePrice - bundleDelta`.
- Else → `{ offerBundle: false }`.

Pure function, no I/O. Phase 6's checkout sheet swaps the CTA when this returns `offerBundle: true`.

### 2. Lock-on-first-sale guardrails

Find every server-side path that mutates a Course doc (course-update server actions, admin moderation handlers, instructor save handlers). For each, add a precondition check before applying the update:

#### Section-level lock

If the update would:
- Remove a section that has `isLocked: true`
- Lower a section's `price` or `salePrice` **below** what's currently set on a locked section
- Change a section's `sectionId` (renaming the stable identifier)
- Change a section's `order` such that it conflicts with cumulative-access expectations (this one is subtle — see below)

→ Reject with a structured error: `{ code: 'SECTION_LOCKED', sectionId, reason: <which mutation was attempted> }`.

Permitted mutations on a locked section:
- Edit `title`
- Edit `description` (if you add one later)
- **Raise** `price` or `salePrice` (instructor can charge more for new buyers)
- Add new videos to the section
- Move existing videos *into* the section
- **Reorder** a locked section's `order` field: allowed **only** if no other locked section's relative order to it changes. Concretely: locked sections preserve their relative ordering among themselves. New unlocked sections can be inserted anywhere. (Practical rule: sort sections by `order`, locked sections must remain in the same relative sequence before and after the edit.)

#### Course-level lock

If `course.purchaseMode` is set to `'sectional'` **and** at least one section has `isLocked: true` **or** at least one enrollment exists for the course with `accessScope: 'full'` (bundle buyer) → reject any attempt to change `course.purchaseMode`. Error: `COURSE_PURCHASE_MODE_LOCKED`.

If `course.purchaseMode` is set to `'full'` and any non-test enrollment exists with `status: 'completed'` → also reject any attempt to flip to `'sectional'`. Error: `COURSE_PURCHASE_MODE_LOCKED`. (We have not yet defined the migration policy for flipping full → sectional with existing students. Phase 5 will revisit; Phase 3 defaults to "no flipping once enrolled." The legacy-grandfather rule in the gate still protects existing students if the lock is ever bypassed manually.)

#### Where to enforce

Survey the codebase for course-mutation entry points. Likely candidates:
- A `updateCourse` server action.
- The `CourseDashboard` save flow's API handler.
- Admin course-edit endpoints.
- The course-upload `edit/[courseId]` page actions.

Implement the lock as a single reusable function (`assertCourseMutationAllowed(currentCourse, proposedUpdate)`) called from each entry point. **Do not duplicate the check.** If a path mutates the course without going through your assertion, list it in the report and surface it — don't silently expand scope to refactor it.

### 3. Two log improvements (carry-over from Phase 2.5 report)

In `app/api/mux/playback-token/route.ts`:

- Add an explicit `console.log('mux-playback DENIED ... reason=not_enrolled_no_doc')` when the enrollment doc doesn't exist.
- Add `console.log('mux-playback DENIED ... reason=not_enrolled_status_pending')` (or `_${actualStatus}`) when the doc exists but `status !== 'completed'`. The current `NOT_ENROLLED` error code returned to the client stays the same — just add the structured log line.

Do not change the HTTP response or error codes — those are part of the API contract.

### 4. Do NOT touch in this phase

- ZainCash init/webhook (Phase 4 handles sectional ZainCash purchases).
- Any UI: `CoursePlayer`, `CourseDashboard`, `course-upload/*` pages (Phases 5–6).
- Mobile API surfaces (Phase 7).
- `purchaseCourseWithWallet` (the legacy full-course path stays untouched and continues serving `purchaseMode: 'full'` courses).
- `checkUserEnrollments` signature (still untouched).
- Certificates, progress %, completion (Phase 7).

If anything in scope here requires touching one of the above, **surface it; don't silently expand.**

### 5. Verification — write the test plan, don't execute it

After the code lands, write a manual test plan in the report covering:

1. **Per-section purchase, new enrollment**: user with no prior enrollment buys section A. Verify: wallet debited, instructor credited, enrollment created with `accessScope: 'sectional'` and `ownedSectionIds: [A]`, `course.sections[A].isLocked === true`, course `enrollmentCount` incremented by 1.
2. **Per-section purchase, existing sectional enrollment**: same user buys section B. Verify: `ownedSectionIds: [A, B]`, `totalSpent` increased correctly, `enrollmentCount` **not** incremented again.
3. **Smart-subtract at purchase boundary**: same user requests `[A, B, C]`. Verify: only C is charged, only C added to `ownedSectionIds`, transaction metadata shows `sectionIds: [C]`.
4. **All-owned rejection**: same user requests `[A, B]` (already owned both). Verify: rejection with `ALL_SECTIONS_ALREADY_OWNED`. No wallet movement. No enrollment change.
5. **Defensive double-charge prevention**: a different user with `accessScope: 'full'` (or legacy unset) attempts a per-section purchase. Verify: rejection with `ALREADY_FULL_ACCESS`. No wallet movement.
6. **Bundle purchase, fresh user**: buys bundle on a sectional course. Verify: `accessScope: 'full'`, `ownedSectionIds` is unset (deleted), every section in `course.sections[]` has `isLocked: true`, `course.purchaseMode` can no longer be flipped.
7. **Bundle upgrade from sectional**: user with `totalSpent` already at 80% of `fullCoursePrice` buys the bundle. Verify: charged only the delta, `accessScope` flips to `'full'`, `ownedSectionIds` cleared.
8. **Bundle free-upgrade**: user whose `totalSpent` already exceeds `fullCoursePrice` calls bundle purchase. Verify: charged 0, transaction row written with `amount: 0`, `accessScope` flips to `'full'`.
9. **Insufficient balance**: empty-wallet user attempts a section purchase. Verify: rejection with `INSUFFICIENT_BALANCE`. No partial state.
10. **Section lock — delete attempt**: instructor tries to delete a section with `isLocked: true`. Verify: rejection with `SECTION_LOCKED`.
11. **Section lock — price decrease**: instructor tries to lower the price of a locked section. Verify: rejection.
12. **Section lock — price increase**: instructor raises the price of a locked section. Verify: **success.**
13. **Mode-flip lock**: instructor tries to flip a sectional course (with any sold section) back to `purchaseMode: 'full'`. Verify: rejection with `COURSE_PURCHASE_MODE_LOCKED`.
14. **Mux gate still works**: after a successful section purchase, log in as the buyer and play a video in the purchased section. Verify: terminal log shows `reason=sectional_owned_section`. Play a video in an unowned section. Verify: `reason=sectional_section_not_owned`.
15. **Mux NOT_ENROLLED logging**: as an unenrolled user, attempt to play a video. Verify: terminal log shows `reason=not_enrolled_no_doc`.
16. **Mux pending-status logging**: hand-craft an enrollment with `status: 'pending'`. Attempt to play. Verify: log shows `reason=not_enrolled_status_pending`.
17. **Idempotency**: replay a successful purchase call with the same `protectionKey`. Verify: short-circuit, no second debit, returns the original result.

### 6. Deliverables

1. `app/actions/sectional_wallet_actions.ts` with both purchase functions and both pure helpers exported.
2. A new file or extension to an existing file with the `assertCourseMutationAllowed` lock function, wired into every course-mutation entry point.
3. The two `console.log` additions in the Mux playback-token route.
4. The manual test plan in the report.
5. Report at the end of the chat:
   - Files changed (paths only).
   - Confirm none of the seven locked rules from the top of this prompt were violated.
   - Confirm `purchaseCourseWithWallet` is untouched and still serves `purchaseMode: 'full'` courses.
   - Any place you found a course-mutation entry point that didn't fit the `assertCourseMutationAllowed` pattern cleanly. Flag it; don't silently refactor.
   - Any error code names you'd rename for clarity (mine are first-draft).
   - Whether the `enrollmentCount` increment rule ("only on first access to course") is feasible with the existing transaction structure, or whether it needs Phase 7 to fully resolve.
   - **Anything in `purchaseCourseWithWallet`'s existing helpers you had to expose / re-export to avoid duplication.** Be explicit — a private helper becoming exported is a meaningful change.

---

## Constraints

- One atomic Firestore transaction per purchase. Money movement, ledger writes, enrollment upsert, course-section lock-marker — all in one transaction. Partial states are unacceptable.
- Idempotency via `protectionKey` is mandatory on every entry point. Phase 4's webhook will rely on this.
- No new external dependencies.
- Match existing code style and error envelope.
- Server-only code (Admin SDK). No client-side imports.
- If something in scope conflicts with the existing wallet code's assumptions, surface it before changing course.

After Phase 3 ships, **do not run the full test plan from Phases 1–2 again** — those are already verified. Phase 3's own test plan (16 cases) is the bar to clear before moving to Phase 4.