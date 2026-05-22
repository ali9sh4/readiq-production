# Rubik (Readiq) — Web Repo — Claude / agent guide

Production codebase. Read this before making changes.

The public brand is **Rubik (روبيك)**; "Readiq" is the internal codename — both appear in code.

## Doc maintenance

When the user says "update", "update the docs", or when a session ends after
code shipped, you MUST read and follow docs/maintenance/update.md in full
before finishing. Do not summarise it — execute it step by step.

## Sibling repo — the mobile app

The React Native app lives in a **separate repo: `readiq-production-mobile`** (Expo, view-only reader-app).
It consumes this repo's `app/api/*` endpoints, read-only. It never writes enrollment or access data.

**When you change anything under `app/api/`, you are changing the mobile app's contract.**
The contract is documented in `docs/MOBILE_API_MIGRATION.md` — update that doc in the same commit
as any `/api/*` change, so the mobile repo always has a current spec to read.

## Source of truth for project state

`docs/MOBILE_PROJECT_STATE.md` — current status, shipped phases, decisions, the sectional invariants.
Read it at the start of any non-trivial task. Keep it current — a stale board causes wrong assumptions.

## Stack

- Next.js **15** (App Router) on React 19, dev uses Turbopack
- TypeScript (strict), path alias `@/*` → repo root
- Firebase: client SDK + `firebase-admin`
- Mux (`@mux/mux-node`, `@mux/mux-player-react`) — signed playback + thumbnails
- Cloudflare R2 via `@aws-sdk/client-s3` for file/image uploads
- Upstash Redis for rate limiting (`@upstash/ratelimit`)
- Zod for validation, react-hook-form for forms, Tailwind v4, shadcn/ui (Radix)
- ZainCash for payments; internal wallet credits course enrollments

## Commands

```bash
npm run dev      # next dev --turbopack
npm run build    # next build
npm run lint     # next lint
npm start        # next start (after build)
```

No test suite and no CI. Verify changes manually.
Run `npx tsc --noEmit` (or `npm run typecheck`) and `npm run lint` before declaring work done.

## Layout

- `app/` — App Router. Routes, server actions in `app/actions/*`, REST API in `app/api/*`.
- `components/` — UI. `ui/` is shadcn primitives. Mux player wrappers: `SignedMuxPlayer.tsx`, `SignedMuxThumbnail.tsx`.
  Sectional UI under `components/sectional/`.
- `lib/` — server-side + shared helpers:
  - `lib/mux/` — `mux.ts` (client), `playbackToken.ts`, `thumbnailToken.ts` (signing)
  - `lib/auth/verifyBearerToken.ts` — bearer auth for `/api/*` (mobile)
  - `lib/api/response.ts` — standard JSON response shape
  - `lib/sectional/` — sectional purchasing helpers (pricing, grouping, access, displayPrice, localizeError)
  - `lib/courses/` — incl. `assertCourseMutationAllowed.ts` (the sectional lock helper)
  - `lib/packages/` — course-packages helpers (access predicate, validation, constants)
  - `lib/payments/zaincash.ts`, `lib/R2/`, `lib/services/`, `lib/purchaseProtection/`
- `firebase/client.ts`, `firebase/service.ts` — client + admin SDK init
- `context/authContext.tsx` — client auth state
- `hooks/` — `useMuxPlaybackToken`, `useVideoProtection`, `useVideoUpload`
- `validation/` — top-level zod schemas (also some under `lib/validation/`)
- `middleware.ts` — page-route auth gate (see below)
- `docs/` — mobile API plan + state, manual cleanup notes
- `types/types.ts` — shared types

## Auth model

- Firebase ID token stored in cookie `firebaseAuthToken` (HTTP-only, set by `/api/refresh-token` flow).
- `middleware.ts` verifies the cookie via Google JWKS for **page** routes only. Matcher: `/admin-dashboard/*`, `/login`, `/register`, `/forget-password`, `/course-upload/*`, `/user_dashboard/*`.
- It sets request headers `x-user-id`, `x-user-email`, `x-user-admin` for downstream handlers.
- **`/api/*` is intentionally NOT in the middleware matcher.** Mobile clients send `Authorization: Bearer <id token>` and each API handler verifies with `lib/auth/verifyBearerToken.ts`. Adding `/api/:path*` to the matcher will break mobile + ZainCash callbacks. Don't.

## Mux / signed playback (shipped, stable)

- All playback URLs and thumbnails are signed. Use `lib/mux/playbackToken.ts` and `lib/mux/thumbnailToken.ts`; client uses `SignedMuxPlayer` / `SignedMuxThumbnail` and `useMuxPlaybackToken`.
- Never expose `MUX_SIGNING_PRIVATE_KEY` or `MUX_TOKEN_SECRET` to the client. Token minting is server-side only.
- The Mux playback-token route enforces sectional access — see below.

## Sectional course purchasing (shipped, web)

A course can be sold as a full bundle OR section-by-section. The system holds
together only because of seven non-negotiable invariants — getting one wrong is
a money or access bug.

**The invariants and their consequences live in the `sectional-invariants`
skill** (`.claude/skills/sectional-invariants/`) — the single source of truth.
Read it before touching `app/actions/sectional_*`, `lib/sectional/*`,
`lib/courses/assertCourseMutationAllowed.ts`, the Mux playback-token route,
enrollment logic, or any access/lock predicate.

Wallet-only — ZainCash sectional is deferred (`docs/PHASE_4_ZAINCASH_DEFERRED.md`).
Purchase actions: `app/actions/sectional_wallet_actions.ts`. Lock helper: `lib/courses/assertCourseMutationAllowed.ts`.

## Course packages (shipped, web)

A package bundles multiple courses (any instructor) at one discounted price; a
buyer gets full access to every included course. Admin-created only. Unlike
standalone/sectional sales, a package sale credits the **platform wallet only**
(`wallets/__platform__`) — instructors are settled out of band against a
per-instructor payout tally.

Canonical doc: `docs/COURSE_PACKAGES.md`. Purchase: `app/actions/package_wallet_actions.ts`.
Admin CRUD + payout ledger: `app/actions/package_admin_actions.ts`. Helpers: `lib/packages/`.

## Mobile API surface

- `app/api/*` is a parallel REST surface for the separate React Native app.
  See `docs/MOBILE_API_MIGRATION.md`, `docs/MOBILE_API_TESTING.md`, `docs/MOBILE_PROJECT_STATE.md`.
- Use `lib/api/response.ts` for response shape and `lib/auth/verifyBearerToken.ts` for auth.
  Don't read cookies in `/api/*` handlers.
- The mobile app is **view-only** — it never purchases in-app. `POST /api/enrollments` rejects
  sectional courses with `COURSE_NOT_SECTIONAL`. Do not add mobile-side purchase endpoints.

## Env vars (names only — values live in `.env.local`, gitignored)

- Firebase admin service-account vars (`FIREBASE_ADMIN_EMAIL`, etc.)
- Mux: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY`
- R2: `R2_*` (account id, bucket, keys)
- ZainCash: `ZAINCASH_BASE_URL`, `ZAINCASH_MERCHANT_ID`, `ZAINCASH_MSISDN`, `ZAINCASH_SECRET_KEY`
- App: `NEXT_PUBLIC_APP_URL`, `NODE_ENV`

## Conventions

- Server Components by default; add `'use client'` only when needed.
- Server Actions live under `app/actions/*`. Mutations from forms prefer actions; mobile uses `app/api/*`.
- Validate input with zod at the boundary (action / route handler). Trust internal calls.
- Standard API response shape via `lib/api/response.ts` — don't hand-roll JSON.
- Path imports use `@/...` (e.g. `@/lib/mux/playbackToken`).
- RTL/Arabic content is supported — watch for direction-sensitive UI.
- Server-action failures return a stable `error` code + message; client localizes via `lib/sectional/localizeError.ts` for sectional flows.

## Gotchas / don'ts

- **`next.config.ts` has `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true`** ("lenient mode"). The build will not catch type/lint errors — run `npm run lint` and `npx tsc --noEmit` manually before declaring work done. A few pre-existing `.next/types/*` errors (sync-enrollments missing default export, Next 15 async-params) are known and unrelated to new work.
- Server Action body limit is bumped to 100mb (for video uploads). Don't lower it without checking upload flows.
- Don't add `/api/:path*` to the middleware matcher (see Auth model above).
- Don't bypass `SignedMuxPlayer` / `SignedMuxThumbnail` with raw Mux URLs.
- Don't commit `.env.local`, service-account JSON, or anything that hardcodes secrets. Never paste secrets/JWTs into chat — describe shape only.
- Don't add new routes under `pages/` — App Router only.
- Image domains are pinned in `next.config.ts` — add new hosts there before using `<Image>` with them.
- Vercel Hobby plan: runtime logs are retained only 1 hour. For production debugging, reproduce live while watching logs.

## Docs to skim when relevant

- `docs/MOBILE_API_MIGRATION.md` — mobile REST contract (keep current with any `/api/*` change)
- `docs/MOBILE_PROJECT_STATE.md` — project status board
- `docs/MANUAL_CLEANUP_DO_NOT_AUTOMATE.md` — items that must stay manual
- `docs/PHASE_4_ZAINCASH_DEFERRED.md` — why ZainCash sectional is deferred
- `docs/COURSE_PACKAGES.md` — course-packages model, invariants, scaling limits
