# Instructor earnings ledger & admin payouts

Canonical doc for the instructor-earnings system. Shipped on
`feat/instructor-payouts` (web).

## Why this exists

When an instructor's course sells, the buyer's money lands in the **platform
owner's bank account** — not in any in-app balance. The instructor's cut is
therefore a **real-world cash payable**: money the platform owes the
instructor and settles out of band (bank transfer, ZainCash, cash).

Before this feature, a sale credited the instructor's *spend wallet*
(`wallets/{uid}.balance`) with the full sale price. That was wrong twice
over: it implied the instructor had spendable platform credit, and it gave
them 100% instead of the agreed split.

This system replaces that with a proper ledger:

- A sale records an **earning** the platform owes — it does **not** touch
  the instructor's spend wallet.
- Earnings are split: the instructor gets a configurable share, the platform
  keeps the rest.
- An admin records out-of-band payments as **payout** entries.
- `outstanding = earnings − payouts` is what the platform still owes.

An instructor's spend wallet (`wallets/{uid}`) and their earnings ledger are
now **completely separate**. The wallet is only their own top-ups and
spending; it is never credited by a sale.

This deliberately mirrors the course-packages owed/paid tally
(`docs/COURSE_PACKAGES.md`) in spirit, but is a **separate system** — package
payouts are unchanged and out of scope here.

## ⚠️ ZainCash earning path — UNVERIFIED

> **The ZainCash earning write has NOT been tested end-to-end.** Standalone and
> sectional wallet purchases were both verified on the Vercel preview build;
> the ZainCash flow was not.
>
> The webhook at `app/api/payments/zaincash/webhook/route.ts` now records an
> earning entry inside its success transaction. It has **not** been confirmed
> whether the ZainCash flow also routes through `purchaseCourseWithWallet`
> (e.g. by topping up the buyer's wallet and then calling the wallet purchase
> action). **If it does, every ZainCash sale will double-count the earning** —
> once from the webhook, once from `purchaseCourseWithWallet`.
>
> **When the existing ZainCash bug is next worked on, the FIRST step must be**
> to trace whether the ZainCash path invokes `purchaseCourseWithWallet`, and
> remove the duplicate earning write if so. Do not assume the current code is
> correct until that trace is done.

## Data model

### `users/{uid}` — denormalized fields

| Field | Type | Meaning |
|---|---|---|
| `revenueSharePercent` | number | The **instructor's** % share of a sale. Default `70`. Per-instructor, editable. Affects **future sales only**. |
| `earningsTotal` | number | Running Σ of every `earning` entry's `amount`. Default `0`. |
| `payoutsTotal` | number | Running Σ of every `payout` entry's `amount`. Default `0`. |
| `lastPayoutAt` | Timestamp | Denormalized convenience for the admin list. The ledger remains authoritative. |

`outstanding` is **derived** (`earningsTotal − payoutsTotal`) and is **never
stored** — see below.

New user docs get `revenueSharePercent: 70, earningsTotal: 0,
payoutsTotal: 0` via `buildNewUserDocFields` (`lib/services/userDoc.ts`).
Legacy docs without these fields are handled defensively everywhere: a
missing rate reads as `70`, missing totals read as `0`.

### `users/{uid}/earningsLedger/{entryId}` — immutable entries

The audit trail. Entries are **never edited or deleted** once written.

Every entry:

- `kind`: `'earning' | 'payout'`
- `amount`: number, **always positive** (the instructor's share for an
  earning; the amount paid for a payout)
- `createdAt`: `FieldValue.serverTimestamp()` (admin SDK) — never an ISO
  string
- `createdBy`: uid — the buyer for an `earning`, the admin for a `payout`

**`earning` entries** additionally snapshot the split at sale time:

- `grossAmount` — the full money the buyer paid for this transaction
- `revenueSharePercent` — the % used for **this** sale (e.g. `70`)
- `instructorShareAmount` — `round(gross × pct / 100)` → equals `amount`
- `platformShareAmount` — `gross − instructorShareAmount`
- `courseId`, `enrollmentId`
- `sectionIds?` — present for per-section purchases (one entry covers the
  whole purchase event, which may span several sections)
- `source` — `'wallet' | 'zaincash' | 'backfill'`

**`payout` entries** additionally carry:

- `method` — `'bank_transfer' | 'zaincash' | 'cash'`
- `note?` — free text
- `settledBy` — the admin uid who recorded it

## The revenue-split + snapshot rule

A sale's gross amount is split by the instructor's **current**
`revenueSharePercent`:

```
instructorShareAmount = round(gross × revenueSharePercent / 100)
platformShareAmount   = gross − instructorShareAmount
```

The instructor share is rounded to a whole dinar; the platform takes the
remainder, so the two **always sum back to gross exactly**.

**The split is snapshotted onto every `earning` entry.** The entry stores
the `revenueSharePercent` that was used, the gross, and both shares. When an
instructor's rate is renegotiated later, **past entries never change** —
they keep the deal that was true at sale time. Only future sales use the new
rate.

The split is computed inside the **same Firestore transaction** as the
enrollment write and the buyer's wallet debit, so an earning can never exist
without its sale, or vice versa. The instructor's `users/{uid}` doc is read
inside that transaction to snapshot the rate atomically.

Pure split math: `lib/earnings/split.ts`. Transactional write helper:
`lib/earnings/recordEarning.ts`.

## The derived-outstanding rule

`outstanding` is **always** computed as `earningsTotal − payoutsTotal`. It is
**never written to Firestore**. There is no `outstanding` field.

This is the single most important invariant. Storing `outstanding` would
create a number that can drift out of sync with the two totals that define
it. Deriving it means it is correct by construction.

`outstanding` may go **negative** — that is an overpayment / advance to the
instructor. It is allowed and is surfaced in the UI as a credit (with a
warning); it is automatically worked off by the instructor's future
earnings.

## Why there is no "zero out" button

A payout is **only ever an additive recorded event**. Recording a payout
appends a `payout` entry and increments `payoutsTotal` — nothing else.

There is deliberately **no** operation that sets `outstanding`,
`earningsTotal`, or `payoutsTotal` to zero, and no "mark as fully paid"
button. If the platform pays an instructor everything they are owed, the
admin records a payout for that exact amount and `outstanding` becomes `0`
**by derivation**. "Settled" is a computed state, not a stored flag.

This keeps the ledger honest: every dinar of `payoutsTotal` is backed by a
real, dated, immutable `payout` entry naming the admin who recorded it. A
zero button would let money "disappear" with no audit trail.

## Where earnings are written (sale paths)

A sale records an earning in **four** code paths — all routed through
`recordEarningInTransaction`:

| Path | File |
|---|---|
| Standalone full-course wallet purchase | `app/actions/wallet_actions.ts` → `purchaseCourseWithWallet` |
| Sectional per-section wallet purchase | `app/actions/sectional_wallet_actions.ts` → `purchaseSectionsWithWallet` |
| Sectional bundle wallet purchase | `app/actions/sectional_wallet_actions.ts` → `purchaseBundleWithWallet` |
| ZainCash standalone card payment | `app/api/payments/zaincash/webhook/route.ts` |

`POST /api/enrollments` (mobile) delegates to `purchaseCourseWithWallet`, so
it is covered by the first row.

Free enrollments and zero-charge bundle upgrades record **no** earning —
nothing was sold, nothing is owed.

The **old** instructor-crediting code (a credit to
`wallets/{instructorId}.balance` / `.totalEarnings` plus a
`type:"earning"` `wallet_transactions` row) was **removed** from the three
wallet purchase actions. The ZainCash webhook previously credited the
instructor *nothing at all* — it now records an earning like the others.

## The settle flow (admin)

Page: `/admin-dashboard/instructor-payouts` (admin-only; the
`/admin-dashboard/*` route is gated by middleware and every server action
re-verifies admin rights server-side).

1. The table lists every instructor: name/email, `revenueSharePercent`,
   `earningsTotal`, `payoutsTotal`, derived `outstanding`, last payout date.
2. "تفاصيل" opens the instructor detail: totals, the editable revenue-share
   rate, and the full chronological ledger.
3. **Record Payout:**
   - The amount field is prefilled with the current `outstanding` but is
     **editable** — partial payouts are supported, so the amount is not
     capped at outstanding.
   - Admin picks a `method` and an optional `note`.
   - A confirm step shows the live preview: *"outstanding is now X,
     recording a Y payout, Z will remain"*.
   - On confirm, `recordInstructorPayout` runs a transaction that
     **re-reads** the instructor's totals — that re-read is the
     authoritative number — writes the `payout` entry, increments
     `payoutsTotal`, and returns the live before/after numbers, which the UI
     shows back to the admin.
   - The confirm button is disabled while the write is in flight to prevent
     double-writes.

Recording a payout is **bookkeeping only**. It documents that an
out-of-band cash transfer already happened; it does **not** move any money.

## Per-instructor rate changes

An admin can edit an instructor's `revenueSharePercent` from the detail view
(`updateInstructorRevenueShare`). The launch deal is **70%**; it is expected
to be renegotiated per-instructor.

A rate change affects **future sales only**. It updates `users/{uid}` and
nothing else — no past `earning` entry is touched, because each entry
snapshotted its own rate. An instructor whose rate changes from 70% to 75%
keeps every historical entry at 70% and gets 75% on the next sale onward.

## The manual migration step

The migration is **separate, optional, and not auto-run**.

### Backfilling earnings (scripted)

`scripts/backfill-instructor-earnings.mjs` reconstructs an `earning` entry
for every pre-existing **paid** enrollment.

```bash
# dry run — prints what it would write, changes nothing
node --env-file=.env.local scripts/backfill-instructor-earnings.mjs

# commit the writes
node --env-file=.env.local scripts/backfill-instructor-earnings.mjs --apply
```

- **Idempotent** — an enrollment that already has an `earning` entry is
  skipped, so it is safe to re-run and never double-counts sales the live
  code already recorded.
- Every backfilled entry snapshots `revenueSharePercent` as **70** (the only
  deal in effect for all sales so far) and recomputes the split.
- `createdAt` is set to a Firestore `Timestamp` built from the original
  enrollment date so the ledger reads chronologically. (Live sale code uses
  `serverTimestamp()`; a backfill must preserve the real sale date instead —
  the field is still a Timestamp, never an ISO string.) Entries also carry
  `source: 'backfill'` and a `backfilledAt` server timestamp.

### Recording past payouts (manual — by the owner)

The script does **NOT** create `payout` entries for money already paid to
instructors out of band — it has no record of those transfers.

After running the backfill, the platform owner must, for each instructor
already paid, **record those payments by hand** on
`/admin-dashboard/instructor-payouts` using the Record Payout flow (one
entry per real transfer, with the method and a note). Only then will each
instructor's `outstanding` reflect reality.

## Files

- `lib/earnings/split.ts` — pure revenue-split math
- `lib/earnings/recordEarning.ts` — transactional earning-write helper
- `lib/earnings/validation.ts` — zod schemas for the admin actions
- `app/actions/instructor_payout_actions.ts` — admin + instructor server actions
- `app/admin-dashboard/instructor-payouts/` — admin payout page + detail dialog
- `app/user_dashboard/earnings/` — instructor self-view
- `components/earnings/LedgerTable.tsx` — shared ledger table
- `scripts/backfill-instructor-earnings.mjs` — migration script
- `types/types.ts` — `EarningLedgerEntry`, `PayoutMethod`, `UserEarningsFields`
- `lib/services/userDoc.ts` — new-user defaults + `DEFAULT_REVENUE_SHARE_PERCENT`
