# ZainCash → Wallet Top-up — Test Plan (batches A–E)

Branch: `feat/zaincash-wallet-topup`. Manual verification (no CI / no test suite).
These exercise the §7 idempotency guarantee end-to-end.

## What was built (map)

| Piece | Path |
|---|---|
| Init (POST, bearer) | `app/api/payments/zaincash/topup/init/route.ts` |
| Callback (GET, `?token=`) | `app/api/payments/zaincash/topup/callback/route.ts` |
| Intent fetch (GET, bearer) | `app/api/payments/zaincash/topup/intent/route.ts` |
| Bridge page | `app/wallet/topup/complete/` |
| Shared helpers / bounds | `lib/payments/zaincashTopup.ts` |
| Signing class (reused, hardened) | `lib/payments/zaincash.ts` (`createTopupTransaction`, constant-time verify) |
| Checkout UI | `EnrollButton.tsx`, `SectionalBuyDialog.tsx`, `PackageCheckoutDialog.tsx` |

Frozen routes (`/api/payments/zaincash/{init,webhook}`) were **not** touched.

## Prereqs

```bash
export BASE="http://localhost:3000"          # or the staging/prod URL
export TOKEN="<a valid Firebase ID token>"    # from a logged-in test user
```
- `.env.local` must have `ZAINCASH_MERCHANT_ID`, `ZAINCASH_SECRET_KEY`,
  `ZAINCASH_MSISDN`, `ZAINCASH_BASE_URL` (test host), and ideally
  `ZAINCASH_CALLBACK_BASE_URL` (pin to the host you're testing on).
- The callback authenticates via a ZainCash-signed JWT. For batches B/C/D you
  mint one locally with the **same** `ZAINCASH_SECRET_KEY` (staging only — this
  is exactly what ZainCash does on the redirect). The callback also calls
  `/transaction/get` to reconcile; for a synthetic txn id that call fails and
  the handler falls back to the token status (intended).

**Helper — mint a callback token** (`gen-token.mjs`):
```js
import crypto from "crypto";
const secret = process.env.ZAINCASH_SECRET_KEY;
const [, , id, status] = process.argv; // node gen-token.mjs <txnId> <status>
const now = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const header = b64({ alg: "HS256", typ: "JWT" });
const payload = b64({ id, status, iat: now, exp: now + 3600 });
const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
console.log(`${header}.${payload}.${sig}`);
```
Run: `ZAINCASH_SECRET_KEY=$(grep ZAINCASH_SECRET_KEY .env.local | cut -d= -f2) node gen-token.mjs <txnId> success`

---

## Batch A — init returns a pay URL + creates a pending doc

**Success:**
```bash
curl -sS -X POST "$BASE/api/payments/zaincash/topup/init" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amount":5000,"intent":{"kind":"none"}}' | jq
```
Expect `{"success":true,"data":{"transactionId":"<zc id>","payUrl":"…/transaction/pay?id=<zc id>"}}`.
Then in Firestore, `topup_requests/<zc id>` exists with `status:"awaiting_payment"`,
`source:"zaincash"`, `amount:5000`, `intent.kind:"none"`, `transactionId == <zc id>`.

**Failures:**
```bash
# below min (1,000) → 400 VALIDATION_ERROR
curl -sS -X POST "$BASE/api/payments/zaincash/topup/init" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"amount":500}' | jq
# no auth → 401
curl -sS -X POST "$BASE/api/payments/zaincash/topup/init" -H "Content-Type: application/json" \
  -d '{"amount":5000}' | jq
# over daily limit (request > remaining dailyLimit) → 400 DAILY_LIMIT_EXCEEDED
curl -sS -X POST "$BASE/api/payments/zaincash/topup/init" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"amount":6000000}' | jq
```

---

## Batch B — callback success credits the wallet exactly once

1. Note the wallet balance: `curl -sS "$BASE/api/wallet" -H "Authorization: Bearer $TOKEN" | jq .data.balance`
2. Init (Batch A) → capture `TXN`.
3. `TOK=$(node gen-token.mjs $TXN success)`
4. Fire the callback (follow redirects off, inspect Location):
```bash
curl -sS -i "$BASE/api/payments/zaincash/topup/callback?token=$TOK" | grep -i location
```
Expect a 307 redirect to `/wallet/topup/complete?txn=$TXN`.

**Assert:** wallet balance increased by the doc's amount; `topup_requests/$TXN.status == "approved"`;
exactly **one** `wallet_transactions` row with `metadata.zaincashTxnId == $TXN`, `type:"topup"`.

**Failure check:** a tampered token → redirect to `/payments/error?message=invalid_token`:
```bash
curl -sS -i "$BASE/api/payments/zaincash/topup/callback?token=${TOK}x" | grep -i location
```

---

## Batch C — callback fired TWICE credits ONCE (the idempotency guarantee)

Using the same `$TXN`/`$TOK` from Batch B (already credited once), fire again:
```bash
curl -sS -i "$BASE/api/payments/zaincash/topup/callback?token=$TOK" | grep -i location
```
**Assert:** redirect still goes to `/wallet/topup/complete?txn=$TXN` (success UX), but:
- wallet balance is **unchanged** from after Batch B,
- still exactly **one** `wallet_transactions` row for `$TXN`,
- `status` stays `approved`.

This is the core §7 fix: the in-transaction `status === "approved"` gate makes the
credit exactly-once regardless of how many times the callback fires.

---

## Batch D — failed writes no credit; pending reconciles, no credit

**Failed:** fresh init → `TXN2`; `TOKF=$(node gen-token.mjs $TXN2 failed)`
```bash
curl -sS -i "$BASE/api/payments/zaincash/topup/callback?token=$TOKF" | grep -i location
```
Expect redirect `/payments/error?message=topup_failed`; balance unchanged;
`topup_requests/$TXN2.status == "rejected"`; no `wallet_transactions` row.

**Pending:** fresh init → `TXN3`; `TOKP=$(node gen-token.mjs $TXN3 pending)`
```bash
curl -sS -i "$BASE/api/payments/zaincash/topup/callback?token=$TOKP" | grep -i location
```
Expect redirect `/wallet/topup/complete?txn=$TXN3&state=pending`; balance unchanged;
`status` stays `awaiting_payment`; no credit. (On a real ZainCash txn, the callback's
`/transaction/get` reconcile is what flips a genuine success; with a synthetic id it
falls back to the token's `pending`.)

**Abandoned-doc sweep:** leave `TXN3` (awaiting_payment) for >30 min, then run a new
init for the same user → `TXN3` flips to `expired` (swept) and stops counting toward
the daily limit. Confirm it never blocked a manual top-up at any point
(`createTopupRequest` only sees `status:"pending"`).

---

## Batch E — insufficient balance → top-up → enrollment completes (course / sections / bundle / package)

This is the checkout-bridge integration. Mostly UI, but the engine is curl-able:
init with an enrollment intent, credit via callback, then confirm the **bridge page**
finishes the purchase via the existing wallet action.

```bash
# Course intent (substitute a real paid courseId the user does NOT own):
curl -sS -X POST "$BASE/api/payments/zaincash/topup/init" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":10000,"intent":{"kind":"course","courseId":"<COURSE_ID>"}}' | jq
# → capture TXN, then: TOK=$(node gen-token.mjs $TXN success); fire callback (Batch B).
# Then load the bridge as the user would:
#   $BASE/wallet/topup/complete?txn=$TXN
# It fetches the intent and calls purchaseCourseWithWallet → enrollment completed.
```
Repeat with each intent shape and assert via the UI / Firestore `enrollments`:
- `{"kind":"sections","courseId":"<id>","sectionIds":["s1","s2"]}` →
  `purchaseSectionsWithWallet`; enrollment `accessScope:"sectional"`, `ownedSectionIds` set, those sections `isLocked`.
- `{"kind":"bundle","courseId":"<id>"}` → `purchaseBundleWithWallet`; `accessScope:"full"`.
- `{"kind":"package","packageId":"<id>"}` → `purchasePackageWithWallet`; N enrollments, `wallets/platform-wallet` credited, `package_sales` row.

**Idempotency of the bridge:** refresh `/wallet/topup/complete?txn=$TXN`. Because the
protection key is derived from `$TXN` (stable), the existing wallet action's
`(userId, protectionKey)` dedupe returns the original success — **no second charge**.

**End-to-end UI path (the real one):** on a paid course with balance < price, open the
purchase dialog → "ZainCash" → it tops up the shortfall and redirects to ZainCash; after
paying you land on the bridge, which completes the enrollment and forwards to the course.
Sectional dialog → "ادفع الفرق عبر زين كاش"; package dialog (insufficient) → same.

---

## Regression sanity (don't break what works)

- Manual top-up still works: `createTopupRequest` / `POST /api/wallet/topup/request`
  create `status:"pending"`, `source:"manual"` docs; admin `approveTopupRequest` credits.
- A ZainCash `awaiting_payment` doc does **not** appear in the admin pending queue
  (`getPendingTopupRequests` filters `status == "pending"`).
- Wallet-only purchase (sufficient balance) is unchanged on all three surfaces.
- The frozen `/api/payments/zaincash/{init,webhook}` routes are untouched.
