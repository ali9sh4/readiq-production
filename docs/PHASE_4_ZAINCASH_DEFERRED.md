# Phase 4 — ZainCash Sectional Purchase (Deferred)

**Status:** Deferred indefinitely. **Decided:** 2026-05-15.

Sectional courses launch as **wallet-only** purchases. Users top up their wallet, then buy sections from their wallet balance. There is no ZainCash → *section* flow (one would carry section state across the init → redirect → callback hops).

> **Correction (2026-05-30).** An earlier version of this line claimed "ZainCash → wallet, already shipped and tested." That was inaccurate — at the time, the only ZainCash code was the **frozen pay-per-course** path (`/api/payments/zaincash/{init,webhook}`), which credits an *enrollment* directly and never touches the wallet. A true **ZainCash → wallet auto top-up** was first built on branch `feat/zaincash-wallet-topup` under `/api/payments/zaincash/topup/{init,callback}` (see that feature's commit). It tops up the wallet; the wallet still pays for every enrollment, including sections. The "no ZainCash → section" decision below still stands — the top-up funds the wallet, and the wallet buys the section in a second, already-tested step (the checkout bridge does this automatically).

This document captures enough context that a future engineer — including future-me — can pick the work up cold if and when one of the triggers below fires.

---

## Why deferred

Wallet-only sectional purchasing is functionally complete (Phase 3 shipped; 5/17 cases in the test harness pass; the remaining cases either depend on Phase 5/6 UI or test edge paths that don't block launch). Adding ZainCash for sectional means carrying a `sectionIds[]` list and a "this is a section purchase, not a course purchase" discriminator across **three** HTTP hops (init → ZainCash redirect → webhook callback), plus duplicating the `ALREADY_FULL_ACCESS` / `ALL_SECTIONS_ALREADY_OWNED` rejection logic at webhook time (state can drift between init and callback). That's meaningful complexity. Meanwhile, ZainCash already exists as the wallet top-up path — so every user who *wants* to pay with ZainCash for a section can still do so in two clicks (top up first, then buy). The marginal UX gain from a one-step ZainCash → section flow does not justify the implementation + test cost right now.

## What Phase 4 was going to do

Original scope:

- **`app/api/payments/zaincash/init/route.ts`** — extend to accept `sectionIds: string[]` (plus an `isBundle: boolean` discriminator) in the init payload. Stash both on the pending enrollment / pending transaction row so the webhook can read them later. The current init handler assumes a single whole-course price.
- **`app/api/payments/zaincash/webhook/route.ts`** — on success, read `sectionIds` (or `isBundle`) from the pending row and call into `purchaseSectionsWithWallet` / `purchaseBundleWithWallet` from `app/actions/sectional_wallet_actions.ts` to finalize. Reuse the `protectionKey` idempotency that Case 17 of the Phase 3 test harness proved works — the webhook may fire more than once, and the wallet path must short-circuit replays.
- **Bundle path** — the same shape applies to `purchaseBundleWithWallet`. The webhook needs an `isBundle` flag to pick the right server action.
- **Error handling** — on webhook failure (e.g. `ALREADY_FULL_ACCESS` because the user bought via wallet between init and callback), the pending row stays pending and the user can retry. Do not mark it failed silently; surface it back via the return URL.
- **UI suppression** — the buyer-side payment selector (`components/paymentSelector.tsx`) currently lists wallet + ZainCash + areeba. For sectional courses, only wallet should appear until this phase ships. Phase 6 must enforce that. See "Risk of deferral" below.

## Why the existing ZainCash flow can't be reused as-is

The current ZainCash flow (`app/api/payments/zaincash/init/route.ts` + `webhook/route.ts` + `lib/payments/zaincash.ts`) was written for a single transaction model: one course, one price, write one completed enrollment with `accessScope: "full"`. Sectional purchases need:

1. **A list of sectionIds carried across the init → callback → webhook trip.** Three hops, stored on the pending row. ZainCash's redirect URL is not a safe place for this — it's user-visible and tamperable.
2. **A discriminator between "buy bundle" vs "buy these sections" on the pending row.** Same merchant call shape, different downstream finalizer.
3. **The same `ALREADY_FULL_ACCESS` / `ALL_SECTIONS_ALREADY_OWNED` rejection logic at webhook time, not just init time.** State can drift between init and webhook — the user could have bought elsewhere in that window. The Phase 3 wallet path already does this re-check inside the transaction (see `sectional_wallet_actions.ts:193-208`). The webhook must respect those errors and refund / no-op cleanly.

## What's already in place that helps when we resume

- The wallet path's atomic transaction (`purchaseSectionsWithWallet` and `purchaseBundleWithWallet` in `app/actions/sectional_wallet_actions.ts`) is fully tested and idempotent. The webhook only needs to compose with it, not reimplement it.
- `protectionKey`-based idempotency on `wallet_transactions` rows is verified by Phase 3 Case 17 — replays return the cached result.
- The `assertCourseMutationAllowed` lock in `lib/courses/assertCourseMutationAllowed.ts` already prevents sold-section mutation (rename, delete, price-cut, reorder) regardless of which payment path triggered the sale. ZainCash sales will inherit this protection automatically.
- `Enrollment.accessScope` and `Enrollment.ownedSectionIds` exist in `types/types.ts` and are already populated by the wallet path. ZainCash just needs to follow the same shape.

## Estimated complexity when we resume

Three to five days, dominated by webhook testing. The code itself is not technically hard — it's two route handlers plus pending-row schema changes. What slows it down is verifying webhook behavior end-to-end, which requires either a test ZainCash environment (if Zain provides one) or careful manual simulation against staging with real callbacks. Edge cases to verify:

- Webhook fires twice in quick succession (idempotency).
- User bought via wallet between init and callback (the `ALREADY_FULL_ACCESS` / `ALL_SECTIONS_ALREADY_OWNED` path).
- Section was deleted between init and callback (the `INVALID_SECTION_ID` path — should not happen because of the lock, but defensive).
- User's wallet was drained between init and callback — irrelevant for ZainCash (different funding source) but a useful sanity check that the two paths don't share state in surprising ways.
- Course was unpublished between init and callback.

## When to resume

Triggers — any one of these fires, resume the phase:

- Real users report wallet top-up is too friction-heavy for one-off section purchases (watch support tickets after Phase 6 launches).
- Marketing wants a "Buy now" CTA that goes straight to ZainCash without a wallet step.
- A specific instructor or partnership requires it (e.g. a one-off campaign with a public-facing "Pay 5,000 IQD for this lesson" link).

Until one of these fires, defer.

## Risk of deferral

**None for the section gate.** The wallet path is sealed by `assertCourseMutationAllowed` and the `accessScope` / `ownedSectionIds` enrollment shape. No defensive code is bypassed by skipping ZainCash.

**One UX concern for Phase 6.** The existing `components/paymentSelector.tsx` lists `wallet`, `zaincash`, and `areeba` (the latter disabled). On a full-mode course, that's correct. On a sectional course, only `wallet` should appear — selecting ZainCash would route through `app/api/payments/zaincash/init/route.ts`, which today does not know about sections and will incorrectly try to write a full-course enrollment. Phase 6 **must** suppress the ZainCash option for sectional courses, either by:

- Passing `course.purchaseMode` into `PaymentSelector` and filtering the methods list, or
- Replacing the `PaymentSelector` call entirely for sectional courses with a wallet-only purchase widget.

This is a Phase 6 requirement, not a Phase 4 requirement. Phase 4-when-resumed will then put ZainCash back into the selector for sectional courses.
