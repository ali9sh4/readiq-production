# Rubik (Readiq) — Web Repo — Claude / agent guide

Production codebase. Read this before making changes.

The public brand is **Rubik (روبيك)**; "Readiq" is the internal codename — both appear in code.

## Doc maintenance

When the user says "update", "update the docs", or when a session ends after
code shipped, you MUST read and follow docs/maintenance/update.md in full
before finishing. Do not summarise it — execute it step by step.

## Sibling repo — the mobile app

The React Native app lives in a **separate repo: `readiq-production-mobile`** (Expo, view-only reader-app). It consumes this repo's `app/api/*` endpoints, read-only, and never writes enrollment or access data.

**When you change anything under `app/api/`, you are changing the mobile app's contract.**
The contract is documented in `docs/MOBILE_API_MIGRATION.md` — update that doc in the same commit
as any `/api/*` change, so the mobile repo always has a current spec to read.

## Source of truth for project state

`docs/MOBILE_PROJECT_STATE.md` (mobile board) + `docs/PROJECT_STATE.md` (web changelog) — status, shipped phases, decisions, the sectional invariants.
Read the relevant board at the start of any non-trivial task. Keep it current — a stale board causes wrong assumptions.

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
npm run pipeline # transcription pipeline — usage/env in scripts/pipeline/run.mts header
```

## Layout

- `app/` — App Router. Server actions in `app/actions/*`, REST API in `app/api/*`. Design tokens (colors/radius/fonts) are CSS vars + `@theme` in `app/globals.css` — style with semantic utilities (`bg-primary`, `bg-success`, `text-brand-accent`, `bg-navy-*`), not raw palette classes, on migrated surfaces; see `docs/AUDIT_DESIGN_TOKENS.md` §6 + `docs/PHASE2_REPORT.md`.
- `components/` — UI. `ui/` is shadcn primitives. Mux wrappers `SignedMuxPlayer.tsx` / `SignedMuxThumbnail.tsx`. Sectional UI under `components/sectional/`; student study deck `components/study/`; instructor Q&A review `components/qa_review/`; enrolled course player `components/player/` (old `ui/CoursePlayer.tsx` path is a re-export shim).
- `lib/` — server-side + shared helpers. Notable: `mux/` (signing), `auth/verifyBearerToken.ts`, `api/response.ts`, `sectional/`, `courses/videoAccess.ts` (shared per-video access gate), `courses/assertCourseMutationAllowed.ts`, `qa/` (Q&A hashing/quarantine/counts), `packages/`, `earnings/`, `legal/`, `R2/`, `services/`, `purchaseProtection/`, `payments/zaincash.ts`.
- `firebase/client.ts` + `firebase/service.ts` — client + admin SDK init.
- `scripts/pipeline/` — operator-run content pipeline: `run.mts` (video → transcript + Q&A on disk, read-only vs Firestore/Mux), `import.mts` (Q&A → Firestore), `mcq.mts` (approved Q&A → MCQs → Firestore). Dry-run-by-default imports, Git Bash only. Ops guide: the `qa-mcq-pipeline` skill; each script's header is its normative spec.
- `context/authContext.tsx`, `hooks/` (`useMuxPlaybackToken`, `useVideoProtection`, `useVideoUpload`), `validation/`, `middleware.ts`, `types/types.ts`.

## Auth model

- Firebase ID token stored in cookie `firebaseAuthToken` (HTTP-only, set by `/api/refresh-token` flow).
- `middleware.ts` verifies the cookie via Google JWKS for **page** routes only. Matcher: `/admin-dashboard/*`, `/login`, `/register`, `/forget-password`, `/course-upload/*`, `/user_dashboard/*`, `/delete-account`.
- It sets request headers `x-user-id`, `x-user-email`, `x-user-admin` for downstream handlers.
- **`/api/*` is intentionally NOT in the middleware matcher.** Mobile clients send `Authorization: Bearer <id token>` and each API handler verifies with `lib/auth/verifyBearerToken.ts`. Adding `/api/:path*` to the matcher will break mobile + ZainCash callbacks. Don't.

## Sectional, packages, signed playback, earnings

Each of these is a load-bearing subsystem with a canonical doc. Read it before
touching the area.

- **Sectional course purchasing.** Seven non-negotiable invariants live in the `sectional-invariants` skill (`.claude/skills/sectional-invariants/`). Wallet-only — ZainCash sectional deferred (`docs/PHASE_4_ZAINCASH_DEFERRED.md`). Purchase actions: `app/actions/sectional_wallet_actions.ts`. Lock helper: `lib/courses/assertCourseMutationAllowed.ts`.
- **Course packages.** Admin-created multi-course bundles. Sale credits `wallets/platform-wallet` only; instructors are settled out of band via a per-instructor owed/paid tally. Canonical doc: `docs/COURSE_PACKAGES.md`. Purchase: `app/actions/package_wallet_actions.ts`.
- **Mux signed playback.** All playback URLs and thumbnails are signed via `lib/mux/playbackToken.ts` and `lib/mux/thumbnailToken.ts`; clients use `SignedMuxPlayer` / `SignedMuxThumbnail` / `useMuxPlaybackToken`. Never expose `MUX_SIGNING_PRIVATE_KEY` or `MUX_TOKEN_SECRET` to the client. The per-video access predicate (playback AND study) is `evaluateVideoAccess()` in `lib/courses/videoAccess.ts`; the playback-token route wraps it. Time-limited access (`accessDurationDays` / `accessExpiresAt`) stamp helpers: `lib/courses/accessDuration.ts`.
- **Instructor earnings ledger.** A sale appends an immutable earning entry to `users/{uid}/earningsLedger` with a snapshotted split and bumps `earningsTotal` — it does NOT credit the instructor spend wallet. Admin records out-of-band payouts. Canonical doc: `docs/INSTRUCTOR_PAYOUTS.md`. Helper: `lib/earnings/recordEarning.ts`.
- **Q&A + MCQ pipeline (operator-run).** Transcribe → generate Q&A → import as `pending` → instructor review → MCQ transform (approved pairs only, Firestore-sourced) → MCQ import → instructor MCQ review. Commands, env shadowing, resume markers, known transient failures, verify recipes: the `qa-mcq-pipeline` skill (`.claude/skills/qa-mcq-pipeline/`). Docs: `docs/RUBIK_STUDY_FEATURES.md`, `docs/AUDIT_MCQ_TRANSFORM.md`.
- **Instructor video upload (web only).** UpChunk → Mux direct-upload URL → poll until `ready` → only then persist the course-video record. Seven hard constraints (committed-bytes progress, fixed 8 MB chunks, abandon-and-restart on disconnect, new URL per retry, etc.) live in the `upload-resilience` skill (`.claude/skills/upload-resilience/`). Canonical doc: `docs/VIDEO_UPLOAD_PIPELINE.md`. Code: `hooks/useVideoUpload.ts`, `components/video_uploader.tsx`, `app/actions/upload_video_actions.ts`. Build-pass ≠ verified — exercise a real upload.
- **Uploads in general (file / image / receipt).** Four upload paths over three backends (Mux / R2 / Firebase Storage). Backend choice, the golden rules (bytes bypass the server, persist-only-after-success, server-side validation, the iPad auth-redirect landmine, image-optimization cost), and the presigned-direct-to-R2 target for course files live in the `upload-architecture` skill (`.claude/skills/upload-architecture/`). Canonical doc: `docs/UPLOAD_ARCHITECTURE.md`. NB: `uploadCourseFileToR2` currently streams whole files through a server action — documented anti-pattern to migrate off.

## Mobile API surface

- `app/api/*` is a parallel REST surface for the separate React Native app. See `docs/MOBILE_API_MIGRATION.md`, `docs/MOBILE_API_TESTING.md`, `docs/MOBILE_PROJECT_STATE.md`.
- Use `lib/api/response.ts` for response shape and `lib/auth/verifyBearerToken.ts` for auth. Don't read cookies in `/api/*` handlers.
- The mobile app is **view-only** — it never purchases in-app. `POST /api/enrollments` rejects sectional courses with `COURSE_NOT_SECTIONAL`. Do not add mobile-side purchase endpoints.

## Env vars (names only — values live in `.env.local`, gitignored)

- Firebase admin service-account vars (`FIREBASE_ADMIN_EMAIL`, etc.)
- Mux: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY`
- R2: `R2_*` (account id, bucket, keys)
- ZainCash: `ZAINCASH_BASE_URL`, `ZAINCASH_MERCHANT_ID`, `ZAINCASH_MSISDN`, `ZAINCASH_SECRET_KEY`, and `ZAINCASH_CALLBACK_BASE_URL` (pin to the prod host for the wallet top-up callback; preview deploy URLs aren't whitelisted by ZainCash — falls back to `NEXT_PUBLIC_APP_URL` if unset)
- App: `NEXT_PUBLIC_APP_URL`, `NODE_ENV`. Pipeline scripts: `PIPELINE_ANTHROPIC_API_KEY` (deliberately NOT `ANTHROPIC_API_KEY` — an ambient one from other tooling must never shadow it), optional `PIPELINE_PYTHON` / `PIPELINE_DEVICE`

## Conventions

- Server Components by default; add `'use client'` only when needed.
- Async/submit buttons show a pending state via `components/ui/loading-button.tsx`; data-fetching route segments get a layout-matching `loading.tsx` skeleton (`components/ui/skeleton.tsx`).
- Server Actions live under `app/actions/*`. Mutations from forms prefer actions; mobile uses `app/api/*`.
- Validate input with zod at the boundary (action / route handler). Trust internal calls.
- Standard API response shape via `lib/api/response.ts` — don't hand-roll JSON.
- Path imports use `@/...` (e.g. `@/lib/mux/playbackToken`).
- RTL/Arabic content is supported — watch for direction-sensitive UI.
- Server-action failures return a stable `error` code + message; client localizes via `lib/sectional/localizeError.ts` for sectional flows.

## Gotchas / don'ts

- **No test suite, no CI, and `next.config.ts` runs "lenient mode"** (`eslint.ignoreDuringBuilds: true`, `typescript.ignoreBuildErrors: true`) — the build will not catch type/lint errors. Run `npm run lint` and `npx tsc --noEmit` (or `npm run typecheck`) manually before declaring work done.
- Server Action body limit is bumped to 100mb (for video uploads). Don't lower it without checking upload flows.
- Don't add `/api/:path*` to the middleware matcher (see Auth model above).
- Don't bypass `SignedMuxPlayer` / `SignedMuxThumbnail` with raw Mux URLs.
- Don't commit `.env.local`, service-account JSON, or anything that hardcodes secrets. Never paste secrets/JWTs into chat — describe shape only.
- Don't add new routes under `pages/` — App Router only.
- Image domains are pinned in `next.config.ts` — add new hosts there before using `<Image>`. Course covers deliberately use plain `<img>` (not `<Image>`) to dodge the Hobby-tier 402 image optimizer — see the `cover-image-rendering` skill.
- Vercel Hobby plan: runtime logs are retained only 1 hour. For production debugging, reproduce live while watching logs.

## Docs to skim when relevant

- `docs/MOBILE_API_MIGRATION.md` — mobile REST contract (keep current with any `/api/*` change)
- Strategy & priorities: read docs/STRATEGY.md before any roadmap or feature-priority discussion.
- `docs/RUBIK_STUDY_FEATURES.md` — AI study features: vision & phase gates, the normative Firestore Q&A schema, review/publishing lifecycle, content-safety invariants (companion to `docs/RUBIK_AI_CHAT.md`)
- `docs/COURSE_APPROVAL_PUBLISHING.md` — course approval/publish dual-gate, admin dashboard, deletion lifecycle (also the `course-approval` skill)
- `docs/INSTRUCTOR_PAYOUTS.md` — earnings ledger + admin payouts
- `docs/COURSE_PACKAGES.md` — course-packages model, invariants, scaling limits
- `docs/MANUAL_CLEANUP_DO_NOT_AUTOMATE.md` — items that must stay manual
- `docs/PHASE_4_ZAINCASH_DEFERRED.md` — why ZainCash sectional is deferred
- `docs/VIDEO_UPLOAD_PIPELINE.md` — instructor upload path: architecture, hard constraints, real-upload verification (also the `upload-resilience` skill)
- `docs/UPLOAD_ARCHITECTURE.md` — general upload guide across all backends (video/file/image/receipt): decision matrix, golden rules, iPad landmine, image-optimization cost (also the `upload-architecture` skill)
