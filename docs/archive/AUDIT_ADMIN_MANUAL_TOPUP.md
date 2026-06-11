# Audit — Admin "Add Balance Manually" (direct wallet credit)

> **SUPERSEDED (2026-06-10).** Shipped in `24c0a24` as
> `app/admin-dashboard/manual-topup/` (+ `app/actions/wallet_actions.ts`).
> Historical record only — line numbers below are pre-implementation.

**Date:** 2026-05-31
**Goal:** Let an admin credit a user's wallet directly (email + amount → balance credited immediately, no receipt, no review queue). Separate from, and leaving untouched, the existing receipt-approval flow.
**Status:** READ-ONLY AUDIT. No feature code written yet. Implementation plan at the end is for review.

---

## 1. How balance is credited today

There is **no shared "credit wallet by N" helper.** The increment logic is written inline, and **duplicated**, in two places:

| Path | File:line | Gate | What it writes |
|------|-----------|------|----------------|
| Receipt approval | `app/actions/wallet_actions.ts:288-365` (`approveTopupRequest`) | A `topup_requests` doc must exist with `status === "pending"`; admin custom-claim check | wallet balance, `totalTopups`, request → `approved`, a `wallet_transactions` row |
| ZainCash callback | `app/api/payments/zaincash/topup/callback/route.ts:92-178` | A `topup_requests` doc (id = ZainCash txn id) with `status !== "approved"`; HMAC-signed token | same four writes |

Both run inside `db.runTransaction(...)` and do the increment the **same way**:

```ts
const wallet = walletDoc.data() as Wallet;
const newBalance = wallet.balance + amount;          // read-modify-write (NOT increment)
transaction.update(walletRef, {
  balance: newBalance,                               // ← the actual balance write
  totalTopups: FieldValue.increment(amount),         // ← totals use FieldValue.increment
  updatedAt: new Date().toISOString(),
});
```

**Single source of truth for "credit by N":** the `transaction.update(walletRef, { balance: ... })` block above. It is the same shape in both paths but is not factored out — so a third caller (manual admin) either duplicates it a third time or we extract a helper (see §6).

**Atomicity:** `balance` is read-modify-write, which is safe **only because it runs inside a Firestore transaction** (optimistic concurrency — a concurrent write to the same wallet doc forces a retry). `totalTopups` uses `FieldValue.increment`. Do not replicate the balance write outside a transaction.

### Wallet doc shape (`types/wallets.ts:45-55`)

- Collection: **`wallets`**, document id = **`userId` (the Firebase Auth uid)**. No separate lookup needed once you have the uid.
- `balance: number` — Iraqi dinar (IQD / د.ع), whole-dinar integers in practice (min top-up 1,000, max 5,000,000 enforced on the user flow). No sub-units/decimals are used.
- Other fields: `totalTopups`, `totalSpent`, `dailyLimit` (5,000,000), `userName`, `userId`, `createdAt`, `updatedAt` (ISO strings).
- **Ledger is a separate top-level collection `wallet_transactions`** (NOT a subcollection, NOT an array on the wallet). Auto-id docs with a `userId` field; queried by `where("userId","==",...)`. Shape at `types/wallets.ts:58-75`.
- Wallet may not exist yet — both paths handle the missing-wallet case (approval throws "المحفظة غير موجودة"; the ZainCash callback provisions one defensively).

---

## 2. Email → UID resolution

- Wallet doc id **is** the uid, so the whole problem reduces to email → uid.
- Auth is **Google-only**; email lives both on the Firebase Auth record and on `users/{uid}`.
- **`adminAuth.getUserByEmail(email)` is the clean path and is NOT currently used anywhere** in the repo (grep: no matches). It returns the `UserRecord` whose `.uid` is exactly the wallet doc id. No Firestore query needed.
- There is **no existing `users where email ==` query** for resolving accounts (the only `email ==`-style code is in `instructor_payout_actions.ts`, unrelated — it reads an email field off already-fetched docs).

**Edge cases:**
- **Not found:** `getUserByEmail` throws `auth/user-not-found`. Catch it and return a clean Arabic error (e.g. "لا يوجد حساب بهذا البريد الإلكتروني") — do not leak the raw error.
- **Multiple matches:** impossible. Firebase Auth enforces one account per email, and with Google-only sign-in there is exactly one provider. `getUserByEmail` returns a single record or throws. (If we instead queried Firestore `users`, duplicates would be theoretically possible from bad writes — another reason to use Auth as the source of truth.)
- **Case / whitespace:** normalize input with `email.trim().toLowerCase()` before the lookup. Firebase stores emails lowercased and `getUserByEmail` is case-insensitive, but trimming guards against copy-paste whitespace and keeps the stored audit value clean.

---

## 3. Admin gate — exact pattern to reuse

**Server-action gate** (the one that actually protects the data — reuse this verbatim), from `approveTopupRequest`/`rejectTopupRequest`/`getPendingTopupRequests`:

```ts
const verifiedToken = await adminAuth.verifyIdToken(token);
const adminUser = await adminAuth.getUser(verifiedToken.uid);
const isAdmin =
  adminUser.customClaims?.admin ||
  process.env.FIREBASE_ADMIN_EMAIL === adminUser.email;
if (!isAdmin) {
  return { success: false, error: "غير مصرح" };
}
```

**Page gate (defense in depth):** `middleware.ts:64-67` already redirects any `/admin-dashboard/*` request to `/` when the verified token's `payload.admin` claim is missing. So an admin page under `/admin-dashboard` is protected at the edge. **But server actions are callable as RPC regardless of which page invoked them**, so the action MUST do its own `isAdmin` check (above) — never rely on the middleware/page alone.

---

## 4. Admin dashboard surface & convention

- Admin pages live under **`app/admin-dashboard/*`** (e.g. `topup-approvals/page.tsx`, `instructor-payouts/`, `packages/`). The dashboard home `app/admin-dashboard/page.tsx` has nav `<Button asChild><Link href="/admin-dashboard/...">` links (lines 226-235).
- Convention for an admin form → server action (seen in `topup-approvals/page.tsx`):
  1. `"use client"` page, `const { user } = useAuth()`.
  2. `const token = await user.getIdToken()`.
  3. `const result = await someServerAction(token, {...})` imported from `@/app/actions/*`.
  4. Branch on `result.success` / `result.error`; show `alert(...)`; manage a `processingId`/`loading` state.
  5. shadcn `Card` / `Input` / `Label` / `Button` primitives.
- **Cleanest placement:** a new page `app/admin-dashboard/manual-topup/page.tsx` with a small form (email, amount, optional note), plus a nav button on the dashboard home next to "مستحقات المدربين" / "حزم الدورات". A new page keeps it isolated from the receipt-approval list and is consistent with how `instructor-payouts` and `packages` are each their own route.

---

## 5. Audit trail — making manual top-ups distinguishable

The `wallet_transactions` row is where provenance lives. Today:

- **Receipt approval** writes `metadata: { topupRequestId }` and **no `source` field** (`wallet_actions.ts:349-358`).
- **ZainCash** writes `metadata: { topupRequestId, source: "zaincash", zaincashTxnId }` (`callback/route.ts:159-175`) — i.e. there is already an emerging `metadata.source` convention, but the `WalletTransaction.metadata` type (`types/wallets.ts:66-72`) does **not yet declare `source`** (the callback writes it untyped). Worth adding to the type.

**Minimal tagging recommendation for manual admin credits:**
- `type: "topup"` (keep — it's still a credit; balance math and history UI already handle it).
- `metadata.source: "manual_admin"` — the discriminator. Receipt rows = absent/`undefined` source; ZainCash = `"zaincash"`; manual = `"manual_admin"`.
- `metadata.adminId: <admin uid>` — who did it.
- optional `metadata.reason: <free text>` and `description: "إيداع يدوي من الإدارة"`.
- Add `source` and `adminId`/`reason` to `WalletTransaction["metadata"]` in `types/wallets.ts` (also retro-types the ZainCash `source`).

If we also write a `topup_requests` doc (see §6 option A), set `source: "manual_admin"`, `status: "approved"`, `processedBy: <admin uid>` on it for a second, queryable audit record.

---

## 6. Reuse vs. new action

**The approval credit path cannot be reused as-is.** `approveTopupRequest(token, topupRequestId, …)` is keyed on an existing **pending `topup_requests` doc** — it reads it, asserts `status === "pending"`, and flips it to `approved`. A direct manual top-up has no such doc, so there's nothing to pass it. Reusing it would require first writing a synthetic pending request just to immediately approve it (two round-trips, and it briefly appears in the pending queue — leaky).

**Recommendation: a new dedicated server action** in the same file, mirroring `approveTopupRequest`'s atomic block but resolving the user by email and skipping the queue:

- File: **`app/actions/wallet_actions.ts`** — `export async function adminManualTopup(...)`.
- Inside one `db.runTransaction`, do the **same credit writes** as §1, plus (recommended) create an `approved` `topup_requests` doc tagged `source: "manual_admin"` so there's a durable request-level record alongside the `wallet_transactions` row.

**Optional cleanup (not required for this feature, flagged not scoped):** the balance-credit block is now duplicated in 2 places and would become 3. A `creditWalletInTransaction(transaction, { userId, amount, source, adminId? })` helper in `lib/` that all three call would collapse the duplication. Recommend doing the feature first with the inline transaction (smallest correct change), and only extracting the helper if you want the dedupe in the same PR.

---

## Proposed implementation plan (for review — not yet built)

**Files to touch**
1. `app/actions/wallet_actions.ts` — new `adminManualTopup` server action.
2. `types/wallets.ts` — extend `WalletTransaction["metadata"]` with `source?: "zaincash" | "manual_admin"`, `adminId?: string`, `reason?: string`.
3. `app/admin-dashboard/manual-topup/page.tsx` — new client form page.
4. `app/admin-dashboard/page.tsx` — add a nav `<Link>` button to the new page.

**Server action signature**
```ts
export async function adminManualTopup(
  token: string,
  data: { email: string; amount: number; reason?: string }
): Promise<{ success: true; userId: string; newBalance: number; message: string }
        | { success: false; error: string }>
```

**Flow inside the action**
1. `verifyIdToken` → `getUser` → `isAdmin` check (§3); else `{ success:false, error:"غير مصرح" }`.
2. Validate `amount`: `Number.isInteger`, `>= 1` (or reuse the 1,000 min if business wants parity), `<= 5,000,000`; reject `NaN`/≤0/non-numeric.
3. `email.trim().toLowerCase()` → `adminAuth.getUserByEmail(email)` (catch `auth/user-not-found` → clean error).
4. `db.runTransaction`: read `wallets/{uid}` (create if missing, like the ZainCash callback), `newBalance = balance + amount`, write balance + `totalTopups` increment, write a `wallet_transactions` row tagged `metadata.source="manual_admin"`, `metadata.adminId`, `metadata.reason`, and (recommended) an `approved` `topup_requests` doc with `source="manual_admin"`, `processedBy=admin uid`.
5. Return `{ success:true, userId, newBalance, message:"تم شحن المحفظة" }`.

**Form fields**
- Email (text/email input, required).
- Amount (numeric, formatted like Step4 with comma grouping; required).
- Optional note/reason (text).
- Submit → `adminManualTopup`; show resulting new balance / errors via `alert` per existing convention.

**Validation rules (client + server; server is authoritative)**
- amount: integer, > 0, ≤ 5,000,000 (and optionally ≥ 1,000 for parity with user flow).
- email: non-empty, trimmed/lowercased.
- admin-only (server-enforced).

---

## curl / test batch outline

Server actions are POST RPC, not plain REST, so the cleanest manual test is from the admin UI form, or a temporary throwaway script that imports the action. Conceptual matrix:

- **A — valid email + amount:** existing user's email, amount `5000`. Expect `success:true`, `newBalance` = old + 5000, a new `wallet_transactions` row with `metadata.source="manual_admin"` + `adminId`, and balance visible in the user's wallet/transactions UI.
- **B — nonexistent email:** `nobody@example.com`. Expect `success:false`, clean Arabic "no account" error, **no** wallet/transaction writes.
- **C — bad amount:** `0`, `-100`, `"abc"`, `5000001`. Each → `success:false` validation error, no writes.
- **D — non-admin caller:** call the action with a non-admin user's token. Expect `success:false, error:"غير مصرح"`, no writes — confirms the server gate holds even though the page is also middleware-protected.

Also verify **idempotency expectation:** unlike the receipt/ZainCash flows, a manual top-up has no natural dedupe key — submitting twice credits twice (by design, it's a deliberate admin action). Confirm the UI guards against accidental double-submit (disable button while processing), and decide whether a confirm() dialog is wanted.
