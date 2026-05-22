> **SUPERSEDED — archived 2026-05-22.** The debug-route test harness described
> here (`app/api/debug/`, `scripts/test-purchase.mjs`) has been deleted from
> the repo. Phase 3 shipped. Kept for historical reference only. Current
> status: `docs/MOBILE_PROJECT_STATE.md`.

# Phase 3 — Sectional Purchase Test Harness

**Method:** *Debug-route test harness* — invoking server actions out-of-band
through temporary, environment-gated HTTP endpoints, driven by an editable
fetch runner script.

Phase 3 shipped `purchaseSectionsWithWallet` and `purchaseBundleWithWallet` in
`app/actions/sectional_wallet_actions.ts` before any UI exists (UI is Phase 6).
This harness exercises those server actions manually — one editable runner,
re-run per test case, with Firestore state verified by hand after each run.

> **Temporary.** Everything under `app/api/debug/` is throwaway scaffolding.
> Delete that folder before the sectional-purchasing branch ships. See
> [Teardown](#teardown).

## Why this method

A server action is a `"use server"` TypeScript module with a `@/*` path alias
and a `firebase-admin` dependency that needs env vars. It cannot be imported
into a plain `.mjs` node script without bolting on `tsx` + `tsconfig-paths` +
env loading. Routing the call through an `app/api/*` handler reuses the Next
dev server, which already provides TS compilation, alias resolution, `.env.local`
loading, and an initialized `adminAuth`. The runner script then needs nothing
but `fetch`.

## Components

| File | Role |
|------|------|
| `app/api/debug/_mint.ts` | Shared helpers. `assertNotProduction()` returns a 403 when `NODE_ENV === "production"`; `mintIdToken(uid)` turns a bare UID into a real Firebase ID token. |
| `app/api/debug/buy-section/route.ts` | `POST` → `purchaseSectionsWithWallet`. |
| `app/api/debug/buy-bundle/route.ts` | `POST` → `purchaseBundleWithWallet`. |
| `scripts/test-purchase.mjs` | Dependency-free runner. Edit per case, `node scripts/test-purchase.mjs`. Gitignored (`/scripts/`). |

### Token minting

The purchase actions take a Firebase ID token and call
`adminAuth.verifyIdToken()`. `adminAuth.createCustomToken(uid)` alone returns a
*custom* token, which `verifyIdToken()` rejects. `mintIdToken()` exchanges the
custom token through the Identity Toolkit `signInWithCustomToken` REST endpoint
to get a real ID token. The Firebase Web API key it uses is the public client
key already hardcoded in `firebase/client.ts`.

The debug routes accept **either**:
- `{ uid, ... }` — route mints an ID token for that UID server-side, or
- `{ token, ... }` — route uses the token as-is (for the `AUTH_FAILED` case,
  pass a junk token here).

### Production guard

Every debug route calls `assertNotProduction()` first and returns a 403 when
`NODE_ENV === "production"` — belt-and-suspenders against an accidental deploy
exposing token minting.

## Prerequisites

- `npm run dev` running (`http://localhost:3000`).
- Node 18+ for global `fetch` in the runner (repo is on v22).
- Firestore seeded for the test UID before each case that needs prior state:
  - `wallets/{uid}` with a `balance`
  - `courses/{courseId}` in `purchaseMode: "sectional"` with priced `sections[]`,
    `fullCoursePrice`, and `createdBy`
  - `enrollments/{uid}_{courseId}` if the case starts from an existing enrollment
  - `signInWithCustomToken` auto-creates the *auth* user, but the purchase logic
    reads the Firestore docs above.

## Running a test case

Edit the two marked blocks at the top of `scripts/test-purchase.mjs`:

1. **`ACTION`** — `"section"` or `"bundle"`. One line switches the target route
   and server action. For `"bundle"`, `sectionIds` is ignored and not sent.
2. **`CASE`** — the payload:
   - `uid` — test user to purchase as (token minted server-side)
   - `courseId` — course under test
   - `sectionIds` — section IDs (section action only)
   - `protectionKey` — idempotency key. Change it for a fresh purchase; **reuse
     the same value to exercise the replay / `isDuplicate` path**
   - `token` — optional; set instead of `uid` to send a raw/junk token for the
     `AUTH_FAILED` case

Then:

```bash
node scripts/test-purchase.mjs
```

The runner prints the request body, the HTTP status, and the parsed
`PurchaseResult`. Verify the resulting Firestore state by hand: `wallets`
(buyer + instructor balances), `wallet_transactions` (buyer + instructor rows,
`protectionKey`), `enrollments` (`ownedSectionIds` / `accessScope` / `status`),
and `courses` (`sections[].isLocked`, `enrollmentCount`).

## Test cases

The 17-case plan lives in the Phase 3 prompt under `docs/Prompts/`. For each:
set `ACTION` + `CASE`, run, record the `PurchaseResult`, and check Firestore
against the expected end state. Cases that test idempotency reuse a prior
`protectionKey`; the `AUTH_FAILED` case uses the `token` field.

Run-by-run outcomes are recorded in `docs/PHASE_3_TEST_RESULTS.md`.

## Teardown

Before the branch merges:

```bash
rm -rf app/api/debug
rm scripts/test-purchase.mjs   # already gitignored, but remove the local copy
```

`lib/sectional/pricing.ts` is **not** part of the harness — it's a permanent
extraction of the pure pricing helpers out of the `"use server"` action file
(that file can only export async server actions). Keep it.
