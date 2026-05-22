> **SUPERSEDED — archived 2026-05-22.** Point-in-time test log. Phase 3
> shipped and the debug-route harness (`app/api/debug/`) has been removed from
> the repo. Kept for historical reference only.

# Phase 3 — Manual Test Results

**Date:** 2026-05-14
**Tester:** Ali (dev environment, localhost)
**Phase 3 code:** committed to `main`
**Test harness:** `app/api/debug/buy-section`, `app/api/debug/buy-bundle`, `app/api/debug/_mint.ts`, `scripts/test-purchase.mjs` (all in `app/api/debug/` and `scripts/`, deletable in one shot before production). Method documented in `docs/PHASE_3_PURCHASE_TEST_HARNESS.md`.

---

## Summary

**Run: 5 cases. Skipped: 12.**

The 5 cases run cover the load-bearing positive path end-to-end — fresh per-section purchase, additive purchase to an existing sectional enrollment, smart-subtract pricing at the API boundary, rejection when all requested sections are already owned — plus the idempotency replay short-circuit (case 17).

The remaining cases are deferred to a later checkpoint or to Phase 6 (when the UI lands and tests can run through the buyer flow). The decision was: the load-bearing math is proven; the remaining cases are belt-and-suspenders rejections and bundle paths that share primitives with the verified section path. Case 17 was pulled forward and run because Phase 4's ZainCash webhook replays through these same entry points and relies on the idempotency short-circuit — that dependency is now verified, not assumed. Phase 4 can proceed.

**A real bug was surfaced and fixed before tests ran**: `app/actions/sectional_wallet_actions.ts` had `"use server"` but exported two synchronous pure helpers (`computeSmartSubtractPrice`, `computeBundleBreakEven`). Next.js rejected the module on first import. Fix: helpers + result types extracted to `lib/sectional/pricing.ts`. This would have failed `npm run build` the moment Phase 6 imported the actions file.

---

## Test Course

`courses/anVKnYHlsyx8nTvwsZdt` — "From Diagnosis to Extraction"

**Setup state for Phase 3 testing:**
```
purchaseMode: "sectional"
fullCoursePrice: 15000           (int64)
sections[0]: sec_xXpqKOXosA  "القسم 1"  order:0  price:5000 (int64)
sections[1]: sec_kZGOXyM87Q  "القسم 2"  order:1  price:7000 (int64)
sections[2]: sec_VTL78Plnrw  "القسم 3"  order:2  price:6000 (int64)
createdBy: vn5QjYVbvJS7s2fJZ25tPXWX7Lw2 (course owner)
enrollmentCount (pre-test): 5
```

Test buyer: `hMs5sODkoMRTS4H0X9rc474XPeD2`, wallet seeded with 50000 IQD.
Five pre-existing enrollments on the course are all fake test accounts.

---

## Cases Run

### ✅ Case 1 — Fresh per-section purchase

**Request:** `sectionIds: ["sec_xXpqKOXosA"]`, no prior enrollment
**Response:**
```
success: true, charged: 5000, newBalance: 45000,
ownedSectionIds: ["sec_xXpqKOXosA"], accessScope: "sectional"
```
**Firestore state verified:**
- Buyer wallet debited 5000
- Instructor wallet credited 5000
- Enrollment doc created with `accessScope: "sectional"`, `ownedSectionIds: ["sec_xXpqKOXosA"]` (array), `totalSpent: 5000`, `status: "completed"`
- `sections[0].isLocked: true`, sections[1] and [2] unaffected
- `enrollmentCount: 6` (incremented by 1 — first access)
- Two new `wallet_transactions` rows (purchase + earning) with matching `protectionKey`

**txId:** `25N5o7SdX3X0PpIYF0gz`
**protectionKey:** `test_case_1_1778785783624`

### ✅ Case 2 — Additive purchase, existing sectional enrollment

**Request:** `sectionIds: ["sec_kZGOXyM87Q"]`, prior enrollment owns section 1
**Response:**
```
success: true, charged: 7000, newBalance: 38000,
ownedSectionIds: ["sec_xXpqKOXosA", "sec_kZGOXyM87Q"], accessScope: "sectional"
```
**Firestore state verified:**
- `ownedSectionIds` merged correctly (both sections present, array)
- `totalSpent: 12000` (5000 + 7000)
- `sections[1].isLocked: true` added; sections[0] still locked from case 1
- `enrollmentCount: 6` — **unchanged**, confirming the "first access only" rule on `enrollmentCount` increment
- Two new ledger rows

**txId:** `LgptaWOgGCqeZ3wcWbRp`

### ✅ Case 3 — Smart-subtract at purchase boundary

**Request:** `sectionIds: ["sec_xXpqKOXosA", "sec_kZGOXyM87Q", "sec_VTL78Plnrw"]` — user already owns first two
**Response:**
```
success: true, charged: 6000 (only section 3's price, not 18000),
newBalance: 32000,
ownedSectionIds: ["sec_xXpqKOXosA", "sec_kZGOXyM87Q", "sec_VTL78Plnrw"],
accessScope: "sectional"
```
**Firestore state verified:**
- Charged only 6000 (section 3's price), not the requested-sum of 18000
- `metadata.sectionIds` on the new transaction row = `["sec_VTL78Plnrw"]` only (audit trail reflects what was actually charged, not what was requested)
- All three sections now in `ownedSectionIds`, no duplicates
- `totalSpent: 18000`
- All three sections now `isLocked: true`
- `enrollmentCount: 6` — still unchanged

**txId:** `U4TC0rIq52IFH2qDgwiO`

### ✅ Case 4 — All sections already owned (rejection)

**Request:** `sectionIds: ["sec_xXpqKOXosA", "sec_kZGOXyM87Q"]` — user owns both
**Response:**
```
success: false,
error: "ALL_SECTIONS_ALREADY_OWNED",
message: "You already own every requested section"
```
HTTP 200 (structured failure, not exception).
**Firestore state verified:**
- Buyer wallet balance unchanged (still 32000)
- Instructor wallet balance unchanged
- Enrollment doc unchanged (no mutation to `ownedSectionIds` or `totalSpent`)
- No new `wallet_transactions` rows for this `protectionKey`

Rejection fires before any state mutation — the critical money-safety property.

### ✅ Case 17 — Idempotency replay (same `protectionKey`)

**Request:** `sectionIds: ["sec_xXpqKOXosA"]`, `protectionKey` reused verbatim from case 1 (`test_case_1_1778785783624`)
**Response:**
```
success: true, txId: "25N5o7SdX3X0PpIYF0gz" (case 1's original txId),
charged: 5000, newBalance: 32000,
ownedSectionIds: ["sec_xXpqKOXosA"], accessScope: "sectional",
isDuplicate: true
```
HTTP 200.
**Firestore state verified:**
- No new `wallet_transactions` rows for this `protectionKey` — still exactly the two rows (buyer + instructor) from case 1
- Buyer wallet balance unchanged (32000 — **not** re-debited to 27000)
- Instructor wallet balance unchanged
- Enrollment doc unchanged

**What it proves:**
- `findExistingTxn` short-circuits the replay **before** the transaction block — no double charge. This is the money-safety property Phase 4's ZainCash webhook depends on (webhooks double-fire as a matter of course).
- The three-`where` equality query in `findExistingTxn` executes without throwing — the silent composite-index failure mode is ruled out. No other case exercises this query path.
- `newBalance` (32000) is a fresh wallet re-read, **not** the stale `balanceAfter` (45000) from case 1's row — the deliberate design in the `findExistingTxn` comment block holds.

**txId:** `25N5o7SdX3X0PpIYF0gz` (reused — no new transaction minted)

---

## Cases Deferred

| # | Name | Why deferred |
|---|---|---|
| 5 | `ALREADY_FULL_ACCESS` rejection on per-section attempt | Realistic trigger is a bundle buyer (cases 6–8) trying to buy a section. Will run as case 6.5 once a real bundle buyer exists. |
| 6 | Bundle purchase, fresh user | Bundle path not yet exercised. |
| 7 | Bundle upgrade from sectional (partial spent) | Tests the break-even delta math. |
| 8 | Bundle free-upgrade (`totalSpent >= fullCoursePrice`) | Tests the zero-charge audit-trail row. |
| 9 | `INSUFFICIENT_BALANCE` | Trivial rejection; will catch in production telemetry if broken. |
| 10 | Section lock — delete attempt | Lock helper, not yet exercised on a sold section. |
| 11 | Section lock — price decrease attempt | Same. |
| 12 | Section lock — price increase (should succeed) | Confirms the lock isn't *too* strict. |
| 13 | Mode-flip lock (`purchaseMode: sectional → full`) | Course-level lock, not yet exercised. |
| 14 | Mux gate still works after sectional purchase | End-to-end integration. Phase 2 gate is proven; Phase 3 just merges into `ownedSectionIds`. |
| 15 | Mux `not_enrolled_no_doc` log line | Diagnostic improvement, low risk. |
| 16 | Mux `not_enrolled_status_pending` log line | Same. |

---

## Known unverified risk

Until cases 14 and 10–13 run, the following are theoretically possible failure modes:

- **Lock guardrails** (cases 10–13): the `assertCourseMutationAllowed` helper is wired into all course-mutation paths per the Phase 3 report, but not yet exercised on a sold section. If the helper has a logic bug, an instructor could currently delete a sold section and lock buyers out of content they paid for.
- **Bundle flow** (cases 6–8): the bundle purchase path uses the same atomic-transaction pattern as the section path (which is verified), but `purchaseBundleWithWallet` has its own transaction body and its own break-even delta math (`charge = Math.max(0, fullPrice - priorSpent)`, the zero-charge ledger row). Confidence is high but the bundle-specific arithmetic is unproven.

**Resolved:** idempotency replay (case 17) is now verified — `findExistingTxn` short-circuits replays before any state mutation, no double charge. This was previously the highest-stakes deferred item.

**Recommendation:** run cases 6, 7, 14 (the three highest-information remaining cases) before opening real per-section purchases to users. Cases 10–13 can be run inline during Phase 5 (instructor UI) since that's where lock errors will surface naturally.

---

## Cleanup status

**Test artifacts still in Firestore as of this writing:**
- `courses/anVKnYHlsyx8nTvwsZdt`: `purchaseMode: "sectional"`, `fullCoursePrice: 15000`, prices on all three sections, `sections[*].isLocked: true` on all three, `enrollmentCount: 6`
- `enrollments/hMs5sODkoMRTS4H0X9rc474XPeD2_anVKnYHlsyx8nTvwsZdt`: full sectional enrollment with all three section IDs and `totalSpent: 18000`
- Six new `wallet_transactions` rows from cases 1–3 (cases 4 and 17 wrote none — both short-circuit before the transaction block)

**Debug routes still in repo:**
- `app/api/debug/buy-section/route.ts`
- `app/api/debug/buy-bundle/route.ts`
- `app/api/debug/_mint.ts`
- `scripts/test-purchase.mjs` (gitignored; lives only on dev machine)

The debug routes refuse to run when `NODE_ENV === "production"` but should still be deleted with `rm -rf app/api/debug/` before any ship. `scripts/` is gitignored so the runner won't reach a deployment.

The test course state is **not yet rolled back** — Phase 4 (ZainCash) will need a sectional course to test against and can reuse this same state. If Phase 4 doesn't start within the week, roll back: remove `purchaseMode`, `fullCoursePrice`, section prices, `isLocked` flags. Then delete the test enrollment doc.
