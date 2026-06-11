# Audit — ZainCash Merchant-API Auto Wallet Top-Up (pre-implementation)

> **SUPERSEDED (2026-06-10).** The feature this audit preceded shipped in
> `a048a31` (merged `491de84`): `app/api/payments/zaincash/topup/{init,intent,callback}`
> + checkout bridge. The §7 idempotency risk was addressed in the shipped
> callback. Live docs: `docs/ZAINCASH_TOPUP_TESTING.md` (batch C on prod still
> open) and `docs/ZAINCASH_DEBUG_LEARNINGS.md`. Historical record only —
> line numbers and "current state" claims below are pre-implementation.

**Type:** Read-only audit. No code was changed.
**Date:** 2026-05-30.
**Author:** agent (Claude), reviewed by Ali.

## Purpose & scope

This precedes a **web-only ZainCash redirect + JWT flow that automatically tops up
the internal wallet**, replacing the manual bank-transfer / receipt-approval
bottleneck. Wallet remains the funding source for all enrollments. Mobile gets
nothing (Apple/Play billing). This document maps the existing code the feature
will touch or mirror, and flags the highest-priority risk (idempotency) up front.

> **TL;DR — the single most important finding.** The eventual webhook will
> **credit money** (the wallet) on every fire. The existing ZainCash flow only
> ever **completes an enrollment**, which it makes idempotent by checking
> `status === "completed"` inside its transaction. There is **no idempotency key
> anywhere that ties a ZainCash transaction to a wallet credit.** A naive port
> will double-credit wallets on a re-fired webhook. See §7.

---

## 0. Critical framing — two different "ZainCash" things

There is a naming trap in the docs. Be precise:

- **Existing ZainCash code = "pay-per-course direct".** It charges ZainCash for a
  *single course* and writes a **completed enrollment** on success. It **never
  touches the wallet.** Files: `lib/payments/zaincash.ts`,
  `app/api/payments/zaincash/init/route.ts`,
  `app/api/payments/zaincash/webhook/route.ts`.

- **The new feature = "ZainCash → wallet top-up".** ZainCash credits the
  **wallet balance**; enrollment happens later, separately, paid from wallet.
  **This code does not exist yet.**

⚠️ **`docs/PHASE_4_ZAINCASH_DEFERRED.md:5` is wrong / misleading.** It states
"ZainCash → wallet, already shipped and tested." It has **not** been shipped —
there is no ZainCash→wallet path in the repo. What shipped is ZainCash→enrollment.
The new feature should not assume any wallet top-up plumbing exists for ZainCash.

⚠️ **`docs/MOBILE_API_MIGRATION.md:20,128,451` mark the existing ZainCash routes
as "Frozen … will be removed in a separate task"** and list "Remove all ZainCash
code" as planned cleanup. The new feature **reverses that decision** for the
top-up use case. Decide explicitly (see Open Questions): are we reusing/renaming
`lib/payments/zaincash.ts`, or building a fresh top-up route alongside the
soon-to-be-removed course-payment route? The `ZainCash` class itself
(`lib/payments/zaincash.ts`) is reusable as-is — it is the *course-enrollment
init/webhook handlers* that are the part being removed.

---

## 1. Existing ZainCash code

### What exists

| File | Role | Status |
|---|---|---|
| `lib/payments/zaincash.ts` | `ZainCash` class: JWT sign/verify + 3 merchant API calls. Singleton `zaincash` exported (`:252`). | **Live, reusable.** |
| `app/api/payments/zaincash/init/route.ts` | `POST` — creates a ZainCash transaction for a **course purchase**, writes a `pending` enrollment + `payment_transactions` audit row. | **Live (course flow). Slated for removal.** |
| `app/api/payments/zaincash/webhook/route.ts` | `GET ?token=` — ZainCash redirect callback; verifies JWT, completes enrollment, records instructor earning. | **Live (course flow). Slated for removal.** |
| `components/paymentSelector.tsx` | Buyer UI offering wallet / zaincash / areeba on the course page. | Live. |
| `components/EnrollButton.tsx` | Calls `POST /api/payments/${method}/init` then `window.location.href = redirectUrl` (`:124-138`). | Live. |
| `app/api/payments/error/page.tsx` + `PaymentErrorContent.tsx` | Generic payment-error page. | Live (see §1 bug). |

### The flow that exists (course-payment, NOT top-up)

`lib/payments/zaincash.ts` — full v1 JWT redirect flow:

- **Signing** (`generateToken`, `:41-66`): hand-rolled **HS256 JWT** — `base64url`
  header/payload, `crypto.createHmac("sha256", secretKey)` signature. `exp = now +
  4h` (`:49`). Not using a JWT library.
- **Verify** (`verifyToken`, `:71-100`): re-computes HMAC, compares with `!==`
  (`:86` — *not* constant-time; minor, see §7), checks `exp`.
- **`createTransaction`** (`:105-203`): `POST {baseUrl}/transaction/init` with
  form-encoded `token`, `merchantId`, `lang=ar`. Enforces **min 250 IQD** (`:114`).
  `redirectUrl` is hard-coded to `${NEXT_PUBLIC_APP_URL}/api/payments/zaincash/webhook`
  (`:125`). Returns `{ id, url }` where `url = {baseUrl}/transaction/pay?id=...`.
- **`getTransactionStatus`** (`:208-249`): `POST {baseUrl}/transaction/get` —
  server-side verification used by the webhook to double-check the callback status.
- Verification is **real** (signing + server re-check). Not init-only.

### Env vars it expects (`lib/payments/zaincash.ts:11-14`)

- `ZAINCASH_MERCHANT_ID`
- `ZAINCASH_SECRET_KEY`  ← note: NOT `ZAINCASH_SECRET` (the audit brief's name); the code uses `_KEY`
- `ZAINCASH_MSISDN`
- `ZAINCASH_BASE_URL` (defaults to `https://test.zaincash.iq` if unset, `:14`)
- `NEXT_PUBLIC_APP_URL` (for `redirectUrl`, `:125`)

Credentials are validated lazily (`validateCredentials`, `:30-36`) — the
constructor no longer throws (`:23-26`), so an unconfigured deploy fails only when
a payment is actually attempted.

### Dead / problematic bits

- **Noisy `console.log` of credential presence** (`:16-21`) and full token/response
  payloads (`:128,151-154`) — fine for test, should be quieted for prod.
- **Redirect-target bug (existing, latent):** the webhook redirects to
  `new URL("/payments/error?...")` (`webhook/route.ts:12,23,68,202`) but the error
  page lives at **`/api/payments/error`** (`app/api/payments/error/page.tsx`).
  `/payments/error` is a **404** — there is no `app/payments/` route (confirmed:
  `app/payments/**` does not exist). The success redirect `/course/${courseId}`
  (`:151`) *is* valid (`app/course/[courseId]/page.tsx` exists). **The new top-up
  flow must use correct, existing redirect targets** — don't copy this mistake.

---

## 2. Wallet system

### Doc & shape

- **Type:** `types/wallets.ts:18-28` (`Wallet`).
- **Collection:** `wallets`, **doc id = `userId`** (one wallet per user). A special
  platform wallet lives at `wallets/platform-wallet`
  (`lib/packages/constants.ts` → `PLATFORM_WALLET_ID`, used in
  `package_wallet_actions.ts:273`).
- **Balance:** a single integer field `balance` (IQD, whole units — no minor-unit /
  cents representation). Aggregates: `totalTopups`, `totalSpent`, optional
  `totalEarnings`, `dailyLimit` (default `5_000_000`).
- **Auto-provision:** a missing wallet is created on first read/use in at least
  four places (`wallet_actions.ts:47-60`, `api/wallet/route.ts:13-30`,
  `api/wallet/topup/request/route.ts:76-91`). The top-up webhook must use the
  **same** auto-provision pattern or fail cleanly if absent.

### CREDIT paths (balance goes up)

| Path | Function | File:line | Atomic? | Idempotent? |
|---|---|---|---|---|
| Manual bank-transfer approval (admin) | `approveTopupRequest` | `wallet_actions.ts:287-364` | ✅ `runTransaction` (`:307`) | ✅ via `status !== "pending"` re-check **inside** txn (`:317`) |
| Package sale → **platform** wallet | `purchasePackageWithWallet` | `package_wallet_actions.ts:344-368` | ✅ (same txn as buyer debit) | ✅ via `package_sales (buyerId, protectionKey)` (`:118-131,466`) |

> There is **no user-facing wallet credit other than admin top-up approval.** This
> is exactly the bottleneck the feature removes. The new ZainCash top-up adds the
> **first automated, externally-triggered** wallet credit — hence the idempotency
> emphasis in §7.

### DEBIT paths (balance goes down)

| Path | Function | File:line | Atomic? | Idempotency key |
|---|---|---|---|---|
| Standalone course purchase | `purchaseCourseWithWallet` | `wallet_actions.ts:104-285` (txn `:170-273`) | ✅ | `wallet_transactions (userId, protectionKey)` pre-check `:114-133`; row written `:261` |
| Sectional per-section | `purchaseSectionsWithWallet` | `sectional_wallet_actions.ts:109-424` (txn `:253-391`) | ✅ | `(userId, protectionKey, type:"purchase")` `:83-98`; row `:320` |
| Sectional whole-bundle | `purchaseBundleWithWallet` | `sectional_wallet_actions.ts:428-686` | ✅ | same helper `:446-457`; row `:607` |
| Package purchase (buyer side) | `purchasePackageWithWallet` | `package_wallet_actions.ts:338-342` | ✅ | `package_sales (buyerId, protectionKey)` (namespaced `package_purchase_*`, `:171`) |

All debits read the wallet inside the transaction, check
`balance < price → throw`, and write `balance`, `totalSpent` (FieldValue.increment)
atomically with the enrollment + ledger row. This pattern is solid and is the
template the credit side should match.

---

## 3. Manual bank-transfer / receipt-upload flow (the pattern to mirror)

This is the flow the ZainCash top-up replaces, and the credit step is the exact
shape the webhook should reuse.

### Full path

1. **User submits a top-up request.** Two entry points write to the same
   `topup_requests` collection:
   - Web server action `createTopupRequest` (`wallet_actions.ts:19-102`): rate-limited
     (`:11-16`, 10/h), bounds **1,000–5,000,000** (`:38-44`), one-pending-at-a-time
     guard (`:63-74`), 7-day expiry (`:77-78`). No receipt file — sender name only.
   - Mobile route `POST /api/wallet/topup/request`
     (`api/wallet/topup/request/route.ts:29-195`): bearer auth, stricter bounds
     **1,000–wallet.dailyLimit** with **daily aggregation** (`:108-141`), requires a
     pre-uploaded R2 receipt key (`:34-67`), one-pending guard (`:127-133`).
   - Receipt upload is a separate presigned-PUT step:
     `POST /api/wallet/topup/upload-receipt` (`api/wallet/topup/upload-receipt/route.ts`)
     → key `topup-receipts/{uid}/{ts}_{rand}.{ext}`.
2. **Admin reviews** pending requests (`getPendingTopupRequests`,
   `wallet_actions.ts:410-465`).
3. **Admin approves → wallet credited.** `approveTopupRequest`
   (`wallet_actions.ts:287-364`). **Or** rejects (`rejectTopupRequest`, `:367-407`).

### The credit step — read this carefully (`wallet_actions.ts:307-358`)

```
runTransaction:
  topupDoc = txn.get(topupRef)                         // :308
  if topupData.status !== "pending" → throw            // :317  ← the double-credit guard
  walletDoc = txn.get(walletRef)                        // :321
  newBalance = wallet.balance + topupData.amount        // :328
  txn.update(walletRef, { balance, totalTopups += amount, updatedAt })  // :331-335
  txn.update(topupRef, { status:"approved", processedBy, processedAt }) // :338-344
  txn.set(wallet_transactions/<auto>, { type:"topup", amount, balanceBefore, balanceAfter, metadata:{topupRequestId} })  // :347-357
```

**How it prevents double-credit on re-approval:** the `status !== "pending"` check
runs **inside** the transaction (`:317`). The status doc *is* the idempotency
token. Two concurrent approvals: one wins, flips status to `approved`; the other
re-reads `approved` and throws. This is correct **because the trigger is a single
human click on a uniquely-identified request doc.**

⚠️ **Why this does not transfer 1:1 to a webhook.** The guard relies on a
**pre-existing request doc** identified by `topupRequestId`. A ZainCash webhook
arrives with a **ZainCash transaction id / orderId**, not a `topupRequestId`.
Unless the init step pre-creates a request doc keyed deterministically to the
ZainCash transaction (so the webhook can find and gate on it), the webhook has
nothing to do the `status !== "pending"` check against. See §7.

---

## 4. Transaction / payment data model

| Collection | Written by | Shape / key fields | Status enum |
|---|---|---|---|
| `wallet_transactions` | every debit + `approveTopupRequest` + package credit | `WalletTransaction` (`types/wallets.ts:31-48`): `userId, type, amount(+/-), balanceBefore, balanceAfter, description, metadata, createdAt, protectionKey?`. Auto-id docs. | `type ∈ topup \| purchase \| refund \| earning \| bonus \| penalty \| package_revenue` (`:3-13`) |
| `topup_requests` | `createTopupRequest`, `POST /api/wallet/topup/request` | `TopupRequest` (`types/wallets.ts:51-70`): `userId, userEmail, userName, amount, status, senderName?, processedBy?, processedAt?, rejectionReason?, adminNotes?, createdAt, expiresAt, updatedAt`; mobile adds `paymentMethod, receiptKey, receiptUrl, receiptContentType, note?`. **Has an unused `transactionId?` field** (`:58`). | `TopupStatus ∈ pending \| approved \| rejected \| expired` (`:15`) |
| `payment_transactions` | ZainCash **course** init/webhook only | ad-hoc (no TS type): `userId, courseId, paymentMethod, paymentId, amount, status, createdAt` (`init/route.ts:122-130`); webhook flips `status` (`webhook/route.ts:135-146`). | `initiated \| completed \| failed` (string literals) |
| `enrollments` | all purchase paths + ZainCash webhook | doc id `${userId}_${courseId}`. ZainCash course flow sets `paymentId` (= ZainCash txn id) and `transactionId` on completion (`webhook/route.ts:110-114`). | `pending \| completed \| failed` |
| `package_sales` | `purchasePackageWithWallet` | idempotency + payout source; `(buyerId, protectionKey)`. | — |

### orderId-style refs

- ZainCash **course** init builds `orderId = zc_${courseId}_${userId}_${Date.now()}`
  (`init/route.ts:84`) and passes it to `createTransaction`. But the **webhook keys
  off the ZainCash transaction id** (`paymentId`), not `orderId`
  (`webhook/route.ts:59-63`). `orderId` is effectively write-only in the current
  flow.
- Wallet debits use `protectionKey` (`lib/purchaseProtection/protectionKey.ts`):
  `${action}_${userId}_${courseId}_${timestamp}` — **client-generated**
  (`EnrollButton.tsx:69-73`). For a webhook-driven credit the equivalent must be a
  **server-/ZainCash-derived deterministic id** (the ZainCash transaction id),
  *not* a client timestamp.

> **Reuse note:** `topup_requests.transactionId` (`types/wallets.ts:58`) already
> exists and is unused — it is the natural place to stamp the ZainCash transaction
> id and the natural field to enforce uniqueness on for top-up idempotency.

---

## 5. API route structure (`/api/*`, Next 15 App Router)

### Conventions observed

- **File:** `app/api/<path>/route.ts`; export named `GET`/`POST` `(req: NextRequest)`.
- **Two auth patterns coexist:**
  1. **Mobile/standard (preferred):** `verifyBearerToken(req)`
     (`lib/auth/verifyBearerToken.ts`) reads `Authorization: Bearer <idToken>`,
     calls `adminAuth.verifyIdToken(token, /*checkRevoked*/ true)`. Returns
     `{ userId, email, isAdmin, token }`. Used by every `/api/wallet/*` route.
  2. **Legacy ZainCash:** token passed **in the JSON body** and verified with
     `adminAuth.verifyIdToken(token)` (no revoke check) — `init/route.ts:7,17-22`.
     The **webhook has no user auth at all** (`webhook/route.ts`) — it
     authenticates the *caller* implicitly via the **HMAC-signed JWT** in `?token=`
     (only ZainCash, holding the shared `ZAINCASH_SECRET_KEY`, can mint a valid one)
     plus the server-side `getTransactionStatus` re-check (`:41`).
- **Responses:** standard envelope via `lib/api/response.ts` — `ok(data)` →
  `{success:true,data}`, `fail(code,message,status)` → `{success:false,error:{code,message}}`,
  `handleApiError(err)` maps `AuthError`→401, `ZodError`→400, else 500. **ZainCash
  routes predate this and hand-roll `NextResponse.json` / `NextResponse.redirect`.**
- **Query params:** `req.nextUrl.searchParams.get(...)` (`webhook/route.ts:8`);
  validated bodies via Zod (`api/wallet/*` use `lib/validation/api/*`).
- **GET vs POST:** export both as needed in one `route.ts`. A redirect callback is
  a `GET` (browser navigation); an init is a `POST`.
- **Middleware:** `/api/*` is **intentionally excluded** from the matcher
  (`middleware.ts:82-101`). API routes self-authenticate. **Do not add `/api/:path*`
  to the matcher** — it breaks mobile + ZainCash callbacks (CLAUDE.md, middleware
  comment).

### Where the new routes fit

- **`POST /api/payments/zaincash/init`** — already exists for *course* purchase.
  For top-up you need a **distinct** init. Options (decide in §Open Questions):
  - `POST /api/payments/zaincash/topup/init` (cleanest — keeps course/top-up separate), or
  - a `purpose: "topup"` discriminator on a unified init.
  Auth: use `verifyBearerToken` (header) to match current `/api/*` convention,
  **not** the legacy in-body token. Body: `{ amount }`. It must: validate bounds
  (mirror `createTopupRequest` 1,000–5,000,000 + daily aggregation), **pre-create a
  pending top-up doc keyed to the ZainCash transaction id** (§7), call
  `zaincash.createTransaction(amount, orderId, "Wallet Topup")`, and set
  `redirectUrl` to the top-up callback (below). Return `{ redirectUrl }`.
- **`GET /api/payments/zaincash/callback?token=...`** (the brief's name; existing
  flow calls it `/webhook`) — verify JWT (`zaincash.verifyToken`), re-check with
  `getTransactionStatus`, then **credit the wallet inside a transaction that gates
  on the pending top-up doc's status** (mirror `approveTopupRequest` §3). No user
  auth — the signed token is the auth. Redirect to a **real** success/error page
  (NOT `/payments/error` — that 404s; see §1).

---

## 6. Secrets / env

- **Storage:** `.env.local` (gitignored — `.gitignore:34` `.env*`; only `.env.local`
  present, no `.env.example`). Production values live in **Vercel env**. Names are
  documented in `CLAUDE.md` ("Env vars" section).
- **Existing ZainCash secrets** (`lib/payments/zaincash.ts:11-14`):
  `ZAINCASH_MERCHANT_ID`, `ZAINCASH_SECRET_KEY`, `ZAINCASH_MSISDN`,
  `ZAINCASH_BASE_URL`. ⚠️ **The brief names `ZAINCASH_SECRET` / `ZAINCASH_MERCHANT_ID`
  / `ZAINCASH_MSISDN` — but the code already uses `ZAINCASH_SECRET_KEY` (with
  `_KEY`).** Reuse the existing names; do **not** introduce a second `ZAINCASH_SECRET`.
- **Client exposure check — clean.** Grep for `ZAINCASH_` finds it **only** in
  `lib/payments/zaincash.ts` (server) + docs. **No `NEXT_PUBLIC_ZAINCASH*`
  anywhere.** `paymentSelector.tsx` only references a static `/ZainCashLogo.png`
  image — no secret. `next.config.ts` has no `NEXT_PUBLIC_*` ZainCash entries.
  ✅ The new feature must keep all ZainCash secrets server-only — never prefix with
  `NEXT_PUBLIC_`. `NEXT_PUBLIC_APP_URL` (already public, used for `redirectUrl`) is
  the only public var involved and is fine.

---

## 7. Idempotency risk assessment ⚠️ HIGHEST PRIORITY

**Question:** Is the current wallet-credit path safe to call exactly-once under a
webhook that may fire more than once?

**Answer: No — not as-is. The existing automated credit path (`approveTopupRequest`)
is safe only because its trigger is a unique human click on a pre-identified doc.
A webhook has no such doc unless we create one, and there is currently no mechanism
tying a ZainCash transaction id to a wallet credit.**

### What is safe today

- `approveTopupRequest` (`wallet_actions.ts:307-358`) is **internally idempotent**:
  the `status !== "pending"` re-check inside the transaction (`:317`) means
  re-running approval on the *same `topupRequestId`* cannot double-credit.
- All wallet **debits** are idempotent via `protectionKey` rows
  (`wallet_actions.ts:114-133`, `sectional_wallet_actions.ts:83-98`,
  `package_wallet_actions.ts:118-131`).
- The existing ZainCash **course** webhook is idempotent at the **enrollment**
  level (`status === "completed"` early-return inside txn,
  `webhook/route.ts:89-92`) — but that gates an enrollment, not a balance mutation,
  so a replay is a no-op on money. **A wallet credit has no such natural "already
  done" sentinel unless we add one.**

### What is missing for safe ZainCash crediting

1. **A deterministic idempotency key = the ZainCash transaction id (or `orderId`),
   not a client `protectionKey`/timestamp.** A replayed webhook carries the *same*
   ZainCash transaction id; that is the dedupe anchor.
2. **A pre-created pending doc the webhook can gate on.** Mirror the manual flow:
   the **init** step writes a `topup_requests` (or new `zaincash_topups`) doc with
   `status:"pending"` and `transactionId = <zaincash txn id>` (the unused
   `types/wallets.ts:58` field). The **callback** then runs the exact
   `approveTopupRequest`-shaped transaction: `txn.get(doc)` →
   `if status !== "pending" throw/no-op` → credit wallet + flip to `approved` +
   write `wallet_transactions` row — **all atomic.**
3. **Uniqueness enforcement on `transactionId`.** Either use the ZainCash txn id as
   the **doc id** of the pending doc (so a duplicate create is impossible), or query
   `where transactionId == X` inside the transaction before crediting. Doc-id-as-key
   is strongly preferred — it makes the create itself idempotent and removes a query.
4. **Graceful "already processed" response.** On replay, the callback finds
   `status:"approved"` and must redirect to success (idempotent UX), **not** to an
   error page (contrast the course webhook, which redirects a replay to
   `enrollment_not_found`, `webhook/route.ts:65-69` — acceptable for enrollment,
   wrong for money where the user should still land on "topped up").
5. **Trust the server status, not just the callback token.** Keep the
   `getTransactionStatus` re-check (`webhook/route.ts:41`) — only credit on a
   server-confirmed `success`/`completed`.

### Secondary hardening (lower priority)

- `verifyToken` HMAC compare uses `!==` (`zaincash.ts:86`) — **not constant-time.**
  Use `crypto.timingSafeEqual`. Low real-world risk (the attacker would need to
  forge a JWT without the secret) but trivial to fix.
- Reduce credential/token `console.log` noise (`zaincash.ts:16-21,128,151-154`)
  before this handles real money in prod (Vercel logs retained 1h, but still).
- Amount must be **re-validated server-side at callback** against the pending doc's
  stored amount — never trust an amount echoed in the redirect token.

**Bottom line:** the building blocks (atomic credit, status-gated transaction,
auto-provision) all exist and are battle-tested in `approveTopupRequest`. The work
is to **bind a ZainCash-transaction-keyed pending doc to that credit transaction**
so the webhook's at-least-once delivery becomes exactly-once crediting. Do not skip
this.

---

## 8. Mobile leak check (cross-repo, informational)

- The mobile app (`readiq-production-mobile`) is **view-only** and consumes
  `/api/*` read endpoints (`GET /api/wallet`, `/api/wallet/transactions`,
  `/api/wallet/topup/history`) plus the **manual** receipt top-up
  (`upload-receipt`, `request`). It has **no ZainCash UI** and no in-app purchase
  (CLAUDE.md "Mobile API surface"; `docs/MOBILE_API_MIGRATION.md`).
- The existing ZainCash UI is **web-only**: `components/paymentSelector.tsx` /
  `EnrollButton.tsx` render in web React, calling `POST /api/payments/.../init`
  then a browser `window.location.href` redirect (`EnrollButton.tsx:124-138`) — a
  full-page redirect that has no mobile equivalent.
- **Confirmation for the proposed flow:** keeping ZainCash top-up entirely behind
  `/api/payments/zaincash/*` + a web-only init button **does not leak to mobile**,
  provided:
  1. No new top-up fields are added to the mobile-consumed read endpoints in a way
     that implies in-app payment.
  2. `docs/MOBILE_API_MIGRATION.md` is updated **in the same commit** as any
     `/api/*` change (CLAUDE.md contract rule) — even though the top-up init is
     web-targeted, it lives under `/api/*`, so the contract doc must note it exists
     and is **not** for mobile.
  3. The mobile app continues to rely on Apple/Play billing for any future paid
     flows — the ZainCash top-up must never be surfaced in a mobile build (App
     Store / Play policy on external payment).
- ✅ No existing payment/top-up *UI* in the web client is consumed by mobile. The
  proposed flow stays web-only.

---

## Open questions for Ali

1. **v1 JWT vs v2 OAuth2.** The current code is **v1 HMAC-JWT redirect**
   (`zaincash.ts`). Is the new top-up staying on v1, or does ZainCash now require
   the v2 OAuth2 merchant API? (Affects whether `lib/payments/zaincash.ts` is
   reused verbatim or rewritten.)
2. **Reuse vs replace.** `docs/MOBILE_API_MIGRATION.md` says "remove all ZainCash
   code." Do we (a) keep & repurpose `lib/payments/zaincash.ts` for top-up and
   delete only the *course* init/webhook, or (b) build a fresh top-up module? And
   should `PHASE_4_ZAINCASH_DEFERRED.md:5`'s incorrect "already shipped" line be
   corrected now?
3. **Route shape.** Separate `/api/payments/zaincash/topup/{init,callback}`, or a
   `purpose` discriminator on the existing route? (Recommendation: separate routes —
   cleaner, and the course route is being removed anyway.)
4. **Idempotency doc.** Reuse `topup_requests` (stamping the unused
   `transactionId`, §4/§7) or a new `zaincash_topups` collection with **doc id =
   ZainCash transaction id**? (Recommendation: doc-id-as-key makes create
   idempotent.)
5. **Env var names.** Confirm we reuse `ZAINCASH_SECRET_KEY` / `ZAINCASH_MERCHANT_ID`
   / `ZAINCASH_MSISDN` / `ZAINCASH_BASE_URL` (existing) rather than the brief's
   `ZAINCASH_SECRET`. Any **separate prod merchant credentials** vs the current
   `test.zaincash.iq` default (`zaincash.ts:14`)?
6. **Min / max amount + daily limit.** ZainCash min is **250 IQD** (`zaincash.ts:114`);
   manual top-up min is **1,000** and max **5,000,000** (`wallet_actions.ts:38-44`).
   Which bounds apply to ZainCash top-up, and does the **daily aggregation** limit
   (`api/wallet/topup/request/route.ts:108-141`) apply?
7. **`serviceType` naming.** The course flow passes the course title
   (`init/route.ts:88`). What `serviceType` string should a top-up send (shows on
   the user's ZainCash receipt)? e.g. `"Rubik Wallet Top-up"` / Arabic equivalent.
8. **redirectUrl host: preview vs prod.** `redirectUrl` is built from
   `NEXT_PUBLIC_APP_URL` (`zaincash.ts:125`). On Vercel **preview** deploys this may
   be a per-deploy URL ZainCash won't have whitelisted. Pin a fixed prod callback
   host, or block top-up on preview? Does ZainCash whitelist callback domains?
9. **Auto-credit vs admin-in-the-loop transition.** Does the manual receipt flow
   stay as a fallback (cash/bank transfer for users without ZainCash), or is it
   retired? If both coexist, the one-pending-request guard must account for both
   sources.
10. **Refund / failed-payment policy.** On `failed`/`cancelled`, the course flow
    just marks the enrollment failed. For top-up, confirm the desired UX (leave doc
    `pending`→expire? mark `rejected`? allow immediate retry?).
