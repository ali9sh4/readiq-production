# Course Packages — model & invariants

A **package** is a curated bundle of existing courses (any instructor, any
`purchaseMode`) sold together at one absolute discounted price. Admin-created
only in v1. A package buyer gets full access to every included course.

Packages are a **third, parallel purchase model**. They do not change the
standalone (`purchaseMode` unset/'full') or sectional (`purchaseMode ===
'sectional'`) paths — a package only *references* existing courses.

## Entities

| Collection | Doc | Purpose |
|---|---|---|
| `packages/{id}` | `CoursePackage` | The bundle: course list, price, per-instructor payout map, status. |
| `package_sales/{id}` | `PackageSale` | One per sale. Audit trail + source of the owed tally. Carries a payout snapshot. |
| `instructor_payouts/{id}` | `InstructorPayout` | A manual out-of-band payment the admin recorded. |
| `wallets/platform-wallet` | `Wallet` | Dedicated platform wallet. Receives every package sale. Created on first sale. |

Types live in `types/types.ts`. Shared helpers/constants in `lib/packages/`.

## Revenue model

A package sale credits the **platform wallet only** (`wallets/platform-wallet`)
— never individual instructor wallets. This is deliberate and differs from
standalone/sectional sales, which credit the instructor in-transaction.

Instructors are settled **out of band** against a per-instructor owed tally:

```
outstanding(instructor) = Σ package_sales.payouts[instructor]
                        − Σ instructor_payouts.amount
```

Each sale snapshots `package.payouts` into the `PackageSale` doc, so the
tally reflects what was agreed at sale time even though `package.payouts`
stays editable.

## Invariants

1. **`enrollment.accessScope` is the single source of truth.** Unset =
   grandfathered full access — never overwritten.
2. **A package purchase writes `accessScope: 'full'`** for every included
   course, including sectional ones. A partial sectional owner is upgraded
   to full (`ownedSectionIds` deleted) — the only allowed overwrite, and a
   grandfathered/full owner never reaches the write because eligibility
   blocks them first.
3. **Course list locks at first sale.** `coursesLocked` becomes true; the
   course list is then immutable (mirrors the sectional "sold section is
   immutable" invariant). Price and payouts stay editable.
4. **Eligibility:** a package is purchasable only if the buyer has full
   access to *none* of the included courses (`hasFullAccess` in
   `lib/packages/access.ts`). A full or free enrollment blocks; partial
   section ownership does not.
5. **Cross-package consequence (intended):** once a buyer owns one package,
   any other active package sharing even one course with it becomes
   unbuyable for that buyer — invariant 4 blocks it, because they now have
   full access to the shared course. This prevents paying twice for
   overlapping content.
6. **Idempotency:** package purchases use `generateProtectionKey` with
   `action = 'package_purchase'`, producing keys namespaced
   `package_purchase_*` that cannot collide with standalone/sectional
   `purchase_*` keys.

## Discovery

Packages are discovered in two places, both rendered by the same
`PackageUpsellBanner` component (amber styling, deliberately distinct from
the blue/purple course UI):

- **Course-page upsell banner** — on a course detail page, via
  `getPackagesForCourse`: packages that contain that course.
- **Main-catalog strip** — a labelled section above the course grid, via
  `getActivePackages`: all active packages.

The catalog strip and the `PackageCheckoutDialog` public tier (package
identity, price/savings, the included-course list) work **signed-out**:
`getActivePackages` is token-optional and skips the per-viewer eligibility
filter for anonymous visitors. Wallet balance, eligibility, the
partial-ownership disclosure, and the buy button stay signed-in only —
signed-out sees a sign-in CTA. There is deliberately no `/packages` index
route; the banner and the strip are the only discovery surfaces.

## Mobile

Zero changes. A package purchase writes only standard
`enrollments/{uid}_{courseId}` docs (`accessScope: 'full'`,
`status: 'completed'`). The mobile reader-app reads them through the
unchanged `/api/me/enrollments` and the playback gate already unlocks on
`accessScope: 'full'`. No `/api/packages`, no contract change.

## Known scaling limits

Both are deliberate and accepted at current scale (early platform, small
catalog, ~10 customers). Documented so they are not rediscovered as bugs:

- **Package discovery queries** — `getPackagesForCourse` (course-page
  banner) and `getActivePackages` (catalog strip) — query `packages` by
  `status == 'active'` only, then filter in memory: `getPackagesForCourse`
  by `courseIds`, and both by per-viewer eligibility. This avoids a
  Firestore composite index (`courseIds array-contains` + `status`), which
  would have to be created in the console (rules/indexes are not in-repo).
  At higher package volume, add that composite index and query directly.
- **Payout ledger** (`getPayoutLedger`) reads *all* of `package_sales`,
  `instructor_payouts`, and `packages` and aggregates in memory. Fine for
  hundreds of sales; at higher volume it needs pagination or a running
  per-instructor aggregate doc updated transactionally on each sale/payout.

## Build phases

1. **Schema & types** — collections, types, `lib/packages/` helpers, zod.
2. **Atomic purchase action** — `app/actions/package_wallet_actions.ts`.
3. **Admin UI** — `/admin-dashboard/packages` + `package_admin_actions.ts`.
4. **Buyer-facing** — upsell banner + checkout dialog.
