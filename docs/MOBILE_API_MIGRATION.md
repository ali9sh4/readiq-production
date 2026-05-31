# Mobile API Migration Plan

## Status

Every step in this plan has shipped to `main`. Status, shipped commits, and
decisions live in `docs/MOBILE_PROJECT_STATE.md` — the single status board.
This file is the standing REST contract; it does not track progress.

---

Goal: stand up a parallel, mobile-friendly REST surface under `/api/*` that a future React Native (Expo) **student** app can consume, without touching existing web behavior.

## Ground rules (apply to every new route)

- **Auth:** `Authorization: Bearer <Firebase ID token>` only. No cookies.
- **Verify** server-side via `adminAuth.verifyIdToken(token)` through the new `verifyBearerToken(req)` helper.
- **Validate** request bodies (and query params where they're not trivial) with Zod, matching the existing `validation/` folder convention.
- **Response shape:** always JSON. On success: `{ success: true, data }`. On failure: `{ success: false, error: { code, message } }`. HTTP status reflects the outcome (`401` on auth failure, **never a redirect**).
- **No cookies.** Do not set or read cookies in any `/api/*` handler that's part of this plan.
- **Do not touch:** instructor course-upload server actions, admin dashboards, ZainCash routes/code. ZainCash will be removed in a separate task.
- **Additive only:** every route here is new. Existing server actions stay so the web continues to work.

---

## Sectional Purchasing — Field Reference (Phase 7a)

Sectional purchasing is a server-authoritative feature with read-side parity exposed across four mobile endpoints. Mobile is **reader-app**: it can display sectional structure and lock state, but cannot purchase sections or bundles (Phase 7 plan). The legacy `POST /api/enrollments` rejects sectional courses with `COURSE_NOT_SECTIONAL` (400) — surface that as "buy on web."

### Discriminators

- **Course is sectional iff `course.purchaseMode === "sectional"`.** Missing or `"full"` means legacy full-course. The presence of `course.sections[]` is NOT a discriminator (the Phase 1 backfill populated `sections[]` on multi-section courses regardless of mode).
- **Enrollment is sectional iff `enrollment.accessScope === "sectional"`.** Missing or `"full"` grants the entire course (legacy grandfathered, or explicit bundle buyer).

### Course fields (exposed on `/api/courses`, `/api/courses/:id`, `/api/me/favorites`, `/api/me/enrollments` embedded course)

| Field | Type | Notes |
|---|---|---|
| `price` | number | Legacy full-course price. **Misleading for sectional courses** — kept for back-compat only. |
| `salePrice` | number \| null | Legacy. **Misleading for sectional courses.** |
| `purchaseMode` | `"full" \| "sectional"` | Always present. Default `"full"` when unset upstream. The single discriminator. |
| `fullCoursePrice` | number \| null | The bundle price for sectional courses. Use this (not `price`/`salePrice`) when `purchaseMode === "sectional"`. |
| `sections` | `CourseSection[]` | Only on `/api/courses/:id` (detail). Each: `{ sectionId, title, order, price?, salePrice?, isLocked? }`. Mobile reader-app displays structure; ignores pricing for purchase since purchase is web-only. |

### Video fields (within `course.videos[]` on `/api/courses/:id`)

| Field | Type | Notes |
|---|---|---|
| `section` | string \| null | Legacy free-text section label. Kept for back-compat. |
| `sectionId` | string \| null | Stable FK to `course.sections[].sectionId`. **Use this** to group videos by section client-side (matches the Phase 6a `groupVideosBySection` helper). |

### Enrollment fields (on `/api/me/enrollments` items)

| Field | Type | Notes |
|---|---|---|
| `status` | `"completed" \| "pending" \| "failed" \| "refunded" \| null` | Enrollment lifecycle status. |
| `accessScope` | `"full" \| "sectional"` | Always present. Default `"full"`. |
| `ownedSectionIds` | string[] | Always present, possibly empty. Only meaningful when `accessScope === "sectional"`. |
| `totalSpent` | number | Cumulative IQD spent on this enrollment. Drives bundle break-even math on web; informational on mobile. Default `0`. |
| `sourcePackage` | `{ id: string, title: string } \| null` | The course package this enrollment came from, or `null` for standalone/sectional enrollments. Always present (never omitted). Resolved from `enrollment.sourcePackageId`. |

### Mobile lock-state recipe

For a video V in a course C with enrollment E:

1. If `V.isFreePreview === true` → unlocked.
2. If `C.price === 0` → unlocked.
3. If no enrollment → locked.
4. If `C.purchaseMode !== "sectional"` → unlocked (legacy full-course buyer).
5. If `E.accessScope !== "sectional"` → unlocked (bundle / grandfathered).
6. If `V.sectionId ∈ E.ownedSectionIds` → unlocked.
7. Otherwise → locked.

This mirrors the server-side Mux gate (`/api/mux/playback-token`) exactly. The client only renders affordances — the server is authoritative.

---

## A. New `/api/*` routes for mobile

All routes below are new files under `app/api/`. They must conform to the ground rules.

### Read-only

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/api/courses` | Paginated public catalog | Filter: `status === "published"`, `isApproved === true`, `isDeleted !== true`. Query params: `pageSize` (default 20, max 50), `cursor` (last doc id), optional `category`, `level`, `language`, `search` (later). **Phase 7a:** each tile includes `purchaseMode` + `fullCoursePrice` (no structured `sections[]` — that's on detail). |
| GET | `/api/courses/:courseId` | Single course detail | Same visibility filter as above. Strip instructor-only fields (`deletionStatus`, `rejectionReason`, internal flags). Return `videos` with `videoId`, `title`, `description`, `section`, `sectionId`, `order`, `duration`, `isFreePreview` — but **never** the raw `playbackId` for paid courses (use `/api/mux/playback-token` to gate access). For free courses or `isFreePreview === true` videos the `playbackId` may be returned. **Phase 7a:** course includes `purchaseMode`, `fullCoursePrice`, `sections[]` (see Sectional Field Reference above). |
| GET | `/api/me` | Current user profile | Reads `users/{uid}` doc. Returns `displayName`, `email`, `photoURL`, `language`, `notifications`. |
| GET | `/api/me/enrollments` | Courses the user is enrolled in | Query `enrollments where userId == uid and status == "completed"`, batch-fetch course docs (filter out `isDeleted`). Paginate. **Phase 7a:** each item includes `status`, `accessScope`, `ownedSectionIds`, `totalSpent`, `sourcePackage`; embedded `course` includes `purchaseMode` + `fullCoursePrice`. |
| GET | `/api/me/favorites` | Favorited course IDs (and optionally hydrated courses) | Query param `hydrate=1` returns full `Course` docs (mirrors `getUserFavorites`). Default returns `{ courseIds: string[] }`. **Phase 7a:** hydrated entries include `purchaseMode` + `fullCoursePrice`. |
| GET | `/api/wallet` | Current wallet balance | Reads `wallets/{uid}`. Auto-create empty wallet doc if missing (mirrors `createTopupRequest` first-time logic) so this endpoint never 404s for a logged-in user. |
| GET | `/api/wallet/transactions` | Paginated wallet transactions | Cursor pagination via `lastDocId`. Mirrors `getWalletTransactions`. Default `limit=20`, max `50`. |
| GET | `/api/wallet/topup/history` | Student's own topup requests with status | Query `topup_requests where userId == uid` ordered by `createdAt desc`. Return `id`, `amount`, `paymentMethod`, `receiptUrl`, `status`, `rejectionReason`, `adminNotes`, `createdAt`, `processedAt`. |

### Writes

| Method | Path | Purpose | Notes |
|---|---|---|---|
| PATCH | `/api/me` | Update basic profile fields | Body: `{ displayName?, language? }`. Zod-validated. Updates `users/{uid}` and `adminAuth.updateUser(uid, { displayName })` if `displayName` changed (mirrors web profile flow). |
| DELETE | `/api/me` | Permanently delete the caller's account | No body. Re-checks eligibility server-side and refuses with `403 DELETION_NOT_ALLOWED` for admins, instructors with any course, instructors with `users/{uid}.earningsTotal > 0`, or instructors with unsettled `package_sales` payouts (`reason` ∈ `{ACCOUNT_IS_ADMIN, INSTRUCTOR_HAS_COURSES, INSTRUCTOR_HAS_EARNINGS, INSTRUCTOR_HAS_PACKAGE_PAYOUTS}` — surface as "contact support" in the mobile UI). On success: deletes R2 `topup-receipts/{uid}/*`, all favorites for the user, all `progress` (video viewing history) for the user, `wallets/{uid}`, `users/{uid}`, then revokes refresh tokens and deletes the Firebase Auth user. **Retained** (financial records, disclosed in the privacy policy): `enrollments`, `wallet_transactions`, `topup_requests`, `payment_transactions`, `package_sales` — the bare `userId/buyerId` becomes pseudonymous once Auth is gone. Idempotent. Shared service: `lib/services/accountDeletion.ts`. Returns `{ deleted: true }`. The mobile client signs out locally on success; any in-flight token on another device 401s on its next refresh (revoked). **Note (out of scope for this PR):** retained pending `topup_requests` can belong to deleted users — the admin approval flow should eventually short-circuit when `wallets/{uid}` no longer exists, to avoid crediting a non-existent wallet. |
| POST | `/api/me/favorites` | Add a favorite | Body: `{ courseId }`. Creates `favorites/{uid}_{courseId}`. Idempotent (set with merge). |
| DELETE | `/api/me/favorites/:courseId` | Remove a favorite | Deletes `favorites/{uid}_{courseId}`. Idempotent. |
| POST | `/api/wallet/topup/upload-receipt` | Get a presigned R2 PUT URL for a receipt image | Body: `{ contentType, sizeBytes }`. Validate `contentType` ∈ `{image/jpeg, image/png, image/webp}` and `sizeBytes <= 10 MB`. Returns `{ uploadUrl, key, expiresIn }`. The mobile app `PUT`s the bytes directly to `uploadUrl`. **Server never sees the bytes.** Key format: `topup-receipts/{uid}/{ts}_{rand}.{ext}` so it never collides with `courses/`. URL TTL: 5 minutes. |
| POST | `/api/wallet/topup/request` | Create a pending topup request | Body: `{ amount, paymentMethod, receiptKey }`. Server constructs `receiptUrl` from `receiptKey` (presigned GET URL or stored as the R2 key — admin UI generates a signed GET when viewing). Validate `paymentMethod ∈ {bank_transfer, personal_wallet, fastpay, other}`. Reuse the existing rate limit (`Ratelimit.slidingWindow(10, "1 h")`, `prefix: "topup_request"`) and the existing 1,000–5,000,000 IQD limits. Reuse the existing "one pending request at a time" check. **Writes into the same `topup_requests` collection** so the existing admin approval UI keeps working — adding the new `paymentMethod` and `receiptUrl` fields is additive. |
| POST | `/api/enrollments` | Buy a course with wallet | Body: `{ courseId }`. Server generates an idempotency key (`generateProtectionKey(uid, courseId)`) so duplicate retries from a flaky mobile network don't double-charge. Calls the same atomic Firestore transaction logic as `purchaseCourseWithWallet`: read wallet, check balance ≥ price (use `salePrice` if lower), block self-purchase, debit buyer, create `enrollments/{uid}_{courseId}`, log the buyer's `wallet_transactions` row, increment course `enrollmentCount`. **Instructor side (changed):** the sale no longer credits the instructor's spend wallet — it appends an immutable `earning` entry to `users/{instructorId}/earningsLedger` and increments `earningsTotal` (a real-world cash payable, see `docs/INSTRUCTOR_PAYOUTS.md`). This is a server-side change only; the request/response contract is unchanged. Free courses (`price === 0`) take a separate fast-path that mirrors `enrollInFreeCourse`. Returns `{ enrollmentId, newBalance }`. **Sectional courses (`course.purchaseMode === "sectional"`) are rejected with `COURSE_NOT_SECTIONAL` (400) before any wallet logic runs** — those must be purchased on the web via the sectional flow (Phase 7 plan is reader-app: no mobile sectional purchase). |
| POST | `/api/mux/playback-token` | Issue a short-lived signed Mux playback token | Body: `{ courseId, videoId }`. **DRM gate.** Steps: (1) verify token; (2) load course doc, fail if missing/`isDeleted`; (3) find the matching video object, fail if `isVisible === false`; (4) determine access — instructor (`createdBy === uid`), admin, free course (`price === 0`), free preview (`video.isFreePreview === true`), or completed enrollment doc at `enrollments/{uid}_{courseId}`; (5) sign a Mux playback JWT scoped to that specific `playbackId` with `aud: "v"` and `exp` ≤ 5 minutes. Return `{ playbackId, token, expiresAt }`. |

**Mux signed playback:** real signing from day one. There are zero live students; the web viewer is throwaway. So:

- **All new uploads** use `playback_policy: ["signed"]` only. One-line change in `createMuxUpload` (`upload_video_actions.ts`). This lands as part of step 3.
- **No migration script.** Existing public-playback test videos stay public and irrelevant. If any test data needs re-uploading later, do it manually.
- **No changes to the existing web Mux player.** It keeps using public playback until the web viewer route is deleted (post-mobile follow-up).
- **New env vars required:** `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY` (created in the Mux dashboard, RSA private key — the API token used today is not a signing key). The `/api/mux/playback-token` handler signs JWTs against these.

### Mobile-side DRM (client app)

These are mobile-app responsibilities that the API surface assumes. Listed here so they're not forgotten when the Expo project starts:

- **Android:** `FLAG_SECURE` on the player Activity — **mandatory for v1**. Blocks screenshots and screen recording at the OS level.
- **iOS:** screen-capture detection (`UIScreen.isCaptured` / `capturedDidChangeNotification`) — **v1.1**, not v1. Pause/blank the player when capture is detected.
- **No caching of playback URLs or tokens** in app state, AsyncStorage, or any persistence layer. Always re-fetch from `/api/mux/playback-token` on play. Tokens are intentionally short-TTL (≤ 5 min).

---

## B. Server actions and routes that stay as-is

- **Instructor course-upload actions** — all of `upload_File_actions.ts`, `upload_video_actions.ts`, `course_deletion_action.ts`, `basic_info_actions.ts`. Web-only.
- **Admin actions** — `approveTopupRequest`, `rejectTopupRequest`, `getPendingTopupRequests` in `wallet_actions.ts`; `restoreDeletedCourse`, `permanentlyDeleteCourse` in `course_deletion_action.ts`; `lib/admin/admin-utils.ts`. Web-only.
- **Existing ZainCash routes** — `app/api/payments/zaincash/init`, `app/api/payments/zaincash/webhook`, `lib/payments/zaincash.ts`. **Frozen.** Will be removed in a separate task.
- **ZainCash → wallet top-up routes** — `app/api/payments/zaincash/topup/{init,callback,intent}` (added on `feat/zaincash-wallet-topup`). **WEB-ONLY. Not part of the mobile contract — do NOT call these from the mobile app.** Mobile must use Apple/Play billing for any future paid flow (App Store / Play policy forbids surfacing an external payment rail in-app). These routes top up the web wallet only; the wallet still pays for enrollments. The `lib/payments/zaincash.ts` class is reused for JWT signing/verifying but is otherwise untouched by mobile. Mobile's existing read endpoints (`/api/wallet`, `/api/wallet/transactions`, `/api/wallet/topup/history`) keep working unchanged — ZainCash top-up docs share the `topup_requests` collection, discriminated by `source: "zaincash"` and a distinct `awaiting_payment` status, so the manual one-pending guard is unaffected.
- **Existing favorites/enrollment server actions** — `addToFavorites`, `removeFromFavorites`, `checkUserFavorites`, `getUserFavorites`, `enrollInFreeCourse`, `purchaseCourseWithWallet`, `getWalletTransactions`, `getPendingTopupRequestsUSER`, `createTopupRequest`. Kept so web keeps working unchanged. The new `/api/*` routes are **parallel** endpoints, not replacements.
- **`/api/refresh-token`** — kept. Cookie-based, web-only.
- **`middleware.ts`** — see section C.

---

## C. Middleware change

**Current state:** `middleware.ts` matcher is `["/admin-dashboard/:path*", "/login", "/register", "/forget-password", "/course-upload/:path*", "/user_dashboard/:path*"]`. **`/api/*` is not in the matcher**, so all API routes already bypass middleware entirely.

**Required change: none.** No code edit to `middleware.ts` is needed. The matcher already excludes `/api/*`, which means:

- `/api/*` handlers must do their own bearer-token verification via `verifyBearerToken(req)`.
- Cookie-based redirect logic continues to apply only to `/login`, `/register`, `/forget-password`, `/admin-dashboard/*`, `/course-upload/*`, `/user_dashboard/*`.

**Guardrail:** add a comment at the top of the `config.matcher` explaining that `/api/*` is intentionally excluded and any new mobile-facing route must enforce auth in the handler itself. If anyone later adds `/api/:path*` to the matcher, every mobile request will hit the cookie path and break.

```ts
// middleware.ts
export const config = {
  // /api/* is intentionally NOT in this matcher.
  // Mobile API routes use bearer-token auth (Authorization header) via
  // lib/auth/verifyBearerToken.ts. Do not add /api/:path* here — it would
  // break mobile clients that don't send cookies.
  matcher: [
    "/admin-dashboard/:path*",
    "/login",
    "/register",
    "/forget-password",
    "/course-upload/:path*",
    "/user_dashboard/:path*",
    "/delete-account",
  ],
};
```

`/delete-account` is the web-reachable account-deletion page (required for the Play Console Data Safety form). Adding it to the matcher populates `x-user-id` for the server-action eligibility re-check. It still must NOT pull `/api/*` in.

That comment block is the entire diff to `middleware.ts`.

---

## D. Shared helpers to add

### `lib/auth/verifyBearerToken.ts`

```ts
// Pseudocode shape — do not implement yet.
export class AuthError extends Error {
  code: "NO_TOKEN" | "INVALID_TOKEN" | "EXPIRED_TOKEN" | "REVOKED_TOKEN";
  status: 401;
}

export async function verifyBearerToken(req: Request): Promise<{
  userId: string;
  email: string | null;
  isAdmin: boolean;
}> {
  // 1. Read Authorization header. If missing or not "Bearer X" → throw NO_TOKEN.
  // 2. await adminAuth.verifyIdToken(token, true).
  //    Map auth/id-token-expired to EXPIRED_TOKEN, auth/id-token-revoked to
  //    REVOKED_TOKEN, everything else to INVALID_TOKEN.
  // 3. Return { userId: decoded.uid, email: decoded.email ?? null, isAdmin: decoded.admin === true }.
}
```

Every `/api/*` handler in this plan calls this first. No more inline `adminAuth.verifyIdToken(token)`.

### `lib/api/response.ts`

```ts
// Pseudocode.
export function ok<T>(data: T, init?: ResponseInit): Response;
export function fail(
  code: string,
  message: string,
  status: number = 400,
  init?: ResponseInit
): Response;

// Convention: ok → { success: true, data }
//             fail → { success: false, error: { code, message } }
```

Plus a small `withAuth(handler)` wrapper that runs `verifyBearerToken`, catches `AuthError`, and returns `fail(err.code, ..., 401)` (the `AuthError.code` — `NO_TOKEN` / `INVALID_TOKEN` / `EXPIRED_TOKEN` / `REVOKED_TOKEN`). Handlers receive `(req, ctx, auth)` and can stay focused on their own logic.

### `lib/validation/`

One Zod schema file per route group. Match the naming style of `validation/courseSchema.ts`:

- `validation/api/profileSchema.ts` — `UpdateMeSchema`
- `validation/api/favoritesSchema.ts` — `AddFavoriteSchema`
- `validation/api/topupSchema.ts` — `UploadReceiptSchema`, `TopupRequestSchema` (with the 4-value `paymentMethod` enum)
- `validation/api/enrollmentSchema.ts` — `PurchaseCourseSchema`
- `validation/api/muxSchema.ts` — `PlaybackTokenSchema`
- `validation/api/coursesSchema.ts` — `ListCoursesQuerySchema`

Reuse existing schemas (`PricingSchema`, etc.) where possible — do not duplicate.

### `lib/mux/playbackToken.ts` (new file, used only by the Mux route)

Wraps the JWT signing logic so the route handler stays thin. Signs a Mux playback JWT against `MUX_SIGNING_KEY_ID` / `MUX_SIGNING_PRIVATE_KEY` (RS256), with `sub: playbackId`, `aud: "v"`, `exp ≤ now + 5min`. Returns `{ playbackId, token, expiresAt }`.

### `lib/R2/presignedUpload.ts` (new file)

```ts
// Pseudocode.
export async function createPresignedUploadUrl(opts: {
  key: string;
  contentType: string;
  expiresIn?: number; // seconds, default 300
  contentLengthRange?: { min: number; max: number };
}): Promise<{ uploadUrl: string; key: string; expiresIn: number }>;
```

Used by `/api/wallet/topup/upload-receipt`. Reuses `r2Client` and `R2_BUCKET_NAME` from `lib/R2/r2_client.ts`.

---

## E. Implementation order

Smallest, lowest-risk first. Each step is independently shippable.

1. **Shared helpers + middleware comment.**
   - Add `lib/auth/verifyBearerToken.ts`, `lib/api/response.ts`, `lib/validation/api/*` skeleton, `lib/R2/presignedUpload.ts`, `lib/mux/playbackToken.ts`.
   - Add the matcher comment in `middleware.ts`.
   - No new routes yet. Verifies the helper layer in isolation.

2. **Read-only endpoints.**
   - `GET /api/me`
   - `GET /api/courses`
   - `GET /api/courses/:courseId`
   - `GET /api/me/enrollments`
   - `GET /api/me/favorites`
   - `GET /api/wallet`
   - `GET /api/wallet/transactions`
   - `GET /api/wallet/topup/history`
   - These are read-only and the failure mode is "wrong data shown to one user" — easy to roll back.

3. **Mux signed playback** — split into 3B, 3.5-prep, and 3.5 after the web-side audit.
   - **Step 3B (DONE).** `POST /api/mux/playback-token` endpoint with auth, course-visibility check, video lookup, free-preview bypass, enrollment gate (`enrollments/{uid}_{courseId}` with `status === "completed"`). Real Mux JWT signing (RS256) using `MUX_SIGNING_KEY_ID` / `MUX_SIGNING_PRIVATE_KEY`. Endpoint is dormant on web until 3.5 ships and becomes mobile-ready when needed.
   - **Step 3.5-prep (DONE — Path D).** Added owner + admin branches to the route. Owner (`course.createdBy === auth.userId`) and admin (`auth.isAdmin === true`) both bypass the visibility gate AND the enrollment check. Route is now structurally complete; Step 3.5 itself no longer needs to touch it.
   - **Step 3.5 (ACTIVE — next milestone).** Flip `createMuxUpload` to `playback_policy: ["signed"]` AND migrate the three web player surfaces that currently consume raw `playbackId` (`components/video_uploader.tsx`, `components/CoursePreview.tsx`, `components/ui/CoursePlayer.tsx`). The flip cannot land standalone — every new instructor upload would silently break those three surfaces. Scope below in **Step 3.5 scope** (note: section 1 "Server owner branch" is now done as part of 3.5-prep).

4. **Profile and favorites writes.**
   - `PATCH /api/me`
   - `POST /api/me/favorites`
   - `DELETE /api/me/favorites/:courseId`
   - Low-risk writes. No money involved.

5. **Top-up request flow.**
   - `POST /api/wallet/topup/upload-receipt`
   - `POST /api/wallet/topup/request`
   - First step that introduces a new field shape (`paymentMethod`, `receiptUrl`) on `topup_requests`. Confirm with admin UI owner that the existing approval page degrades cleanly when those fields are present (it already does — it just won't display them until the UI is updated).

6. **Enrollment purchase.**
   - `POST /api/enrollments`
   - Most complex: Firestore transaction, wallet deduction, instructor credit, idempotency. Port logic directly from `purchaseCourseWithWallet`. Test free path (`price === 0`) and paid path separately.

---

## Step 3.5 scope

Recommended approach from the web-side audit, verbatim.

Three things that make this clean:

1. Ownership is already a single field check (createdBy === uid) — no co-instructor matrix to design.
2. The signed-playback API already exists (/api/mux/playback-token); it just needs an instructor branch added.
3. /course/[courseId]/page.tsx already routes the owner to CoursePlayer (line 199, if (isInstructor)), so the natural surface for instructor preview is the existing viewer — not a new instructor-only player.

### Substep status (current as of 3.5.D shipping to the branch)

| Substep | Scope | Status | Commit |
|---|---|---|---|
| 3.5.A | `useMuxPlaybackToken` hook | DONE | `3a5b5e3` |
| 3.5.B | `SignedMuxPlayer` wrapper | DONE | `1e63f36` + `784d360` (post-fix gate) |
| 3.5.C | Thumbnail token signing (`lib/mux/thumbnailToken.ts` + extended route response) | DONE | `f80ff3a` |
| 3.5.D | `components/video_uploader.tsx` (instructor preview, lines 740 + 857) | DONE | `a20b5ed` |
| 3.5.E | `components/CoursePreview.tsx` (free-preview, line ~326) | TODO | — |
| 3.5.F | `components/ui/CoursePlayer.tsx` (enrolled viewer, line ~644). Highest risk — watermark DOM-walking + `:fullscreen` selectors + `onEnded` chain + auto-advance (mid-video-swap flash needs hook fix). | TODO | — |
| 3.5.G | Grep `image.mux.com` across `components/`, `app/`, `lib/`. Replace each with `<SignedMuxThumbnail>`. | TODO | — |
| 3.5.H | Flip `app/actions/upload_video_actions.ts` `playback_policy` from `["public"]` to `["signed"]`. **Separate one-line commit on `main` after the wrapper PR merges — NOT on the feature branch.** | TODO | — |

### 1. Server owner branch — DONE (Path D / Step 3.5-prep)

Shipped ahead of the rest of Step 3.5 as a risk-free pre-cursor. The route now has owner + admin branches that both bypass the visibility gate AND the enrollment check. Single token-issuance code path; mobile and web both consume it. See `app/api/mux/playback-token/route.ts` and the test recipes in `MOBILE_API_TESTING.md` (sections c.1, c.2).

### 2. `useMuxPlaybackToken` hook — DONE (3.5.A, `3a5b5e3`)

`hooks/useMuxPlaybackToken.ts`. Takes `{ courseId, videoId, enabled? }`. Calls `user.getIdToken()` from `useAuth()`, POSTs to `/api/mux/playback-token`, returns `{ token, thumbnailToken, playbackId, expiresAt, isLoading, error, refetch }`. Auto-refreshes 5 min before `expiresAt`. AbortController on input change. Treats every API failure (including `409 VIDEO_NOT_READY`) as `error` state — never throws. `isLoading` initialized via lazy initializer (post-fix in `784d360`) so render 1 already shows the loading state and consumers don't paint a pre-fetch frame.

### 3. `SignedMuxPlayer` wrapper — DONE (3.5.B, `1e63f36` + `784d360`)

`components/SignedMuxPlayer.tsx`. `forwardRef<MuxPlayerRef, SignedMuxPlayerProps>` so refs reach the underlying mux-player element (CoursePlayer's watermark DOM-walking depends on this). Renders `<MuxPlayer>` directly (no wrapping div) so `:fullscreen` / `.video-container` CSS selectors keep working. Passthrough for `className`, `metadata`, `onEnded`, `streamType`, etc. via `{...muxProps}` first, controlled props (`ref`, `playbackId`, `tokens`) after. The wrapper signature is:

```tsx
<MuxPlayer
  playbackId={playbackId}
  tokens={{ playback: token, thumbnail: thumbnailToken }}
  ...
/>
```

The `@mux/mux-player-react` 3.x API uses a single `tokens` object (`{ playback, thumbnail, storyboard, drm }`), not separate `playbackToken` / `thumbnailToken` props. The wrapper builds `tokens` conditionally and omits the prop entirely for legacy public-policy assets (no `tokens={undefined}`).

The three call sites get migrated in order: 3.5.D `video_uploader.tsx:857` (DONE), 3.5.E `CoursePreview.tsx:326` (TODO), 3.5.F `CoursePlayer.tsx:644` (TODO). Same component, three behaviors driven by the route's gate:

- Instructor upload card → owner branch issues both JWTs.
- `/course/[courseId]` for unenrolled visitor → free-preview branch.
- `/course/[courseId]` for enrolled / owner / admin → enrollment / owner / admin branch.

### 4. Thumbnail token signing — DONE (3.5.C, `f80ff3a`)

Option 1 picked from the audit: extended the existing `/api/mux/playback-token` endpoint to also return `thumbnailToken` (alongside `token`) in the same response. Same gate logic, single round-trip, hook + wrapper already wired.

`lib/mux/thumbnailToken.ts` mirrors `lib/mux/playbackToken.ts` — same algorithm, same key, same TTL. Only structural difference: `aud="t"` instead of `aud="v"`. Mux validates `aud` per request type, so a playback JWT can't fetch a thumbnail and vice versa.

The signed thumbnail URL form is `https://image.mux.com/<playbackId>/thumbnail.jpg?time=<n>&token=<jwt>`. The 3.5.D `<SignedMuxThumbnail>` component (`components/SignedMuxThumbnail.tsx`) is the established pattern — drop-in for `next/image`, takes `Omit<ImageProps, "src">` plus `{ courseId, videoId, playbackId, time? }`. 3.5.G's grep-and-replace work uses this component at every remaining `image.mux.com` call site.

### 5. Legacy public-asset coexistence — partially handled

The wrapper already handles the client side: when the hook returns no token (and no error), the `tokens` prop is omitted entirely (not `tokens={undefined}`), so legacy public-policy assets render unsigned. This works today because the route still issues a signed JWT for every asset, and Mux ignores the JWT for public assets.

The server-side half — having the route return `token: null` explicitly for public-policy assets — is NOT yet built. It would require storing the playback policy on the video doc at upload time and keying off it. Not urgent: the existing 17 dev/test public-policy videos play fine through the wrapper today, and the 3.5.H upload-policy flip means new uploads are signed-only. Defer until there's a concrete reason to add the explicit signal (e.g., catalog perf concerns from unnecessary JWT minting on legacy assets).

### What to avoid

- A separate "instructor preview" route or component. The owner already lands in CoursePlayer via isInstructor — duplicating that for upload-time preview is the wrong axis to split on. Solve token issuance once, reuse the player everywhere.
- Building this around instructorName. The display-name field is denormalized; ownership is createdBy. Use the uid.

### Single-field ownership reference

The audit confirmed: course doc field is createdBy (Firebase uid, set on course creation in app/course-upload/action.ts at lines 72 and 129). No co-instructors. No alternate ownership fields. Global admin override via verifiedToken.admin === true.

### Test plan before merging

Before merging Step 3.5, manually verify all six of these flows on a local dev server:

1. Instructor uploads a NEW video to a draft course → preview card plays the video correctly (uses owner branch on `/api/mux/playback-token`, signed token, ~200-300ms first-play delay).
2. Instructor uploads a NEW video to a published course → preview card plays correctly.
3. Public visitor opens the course detail page → free-preview videos play correctly (uses free-preview branch on `/api/mux/playback-token`).
4. Enrolled student opens a paid course → CoursePlayer plays paid videos correctly (uses enrollment branch).
5. Enrolled student opens a course with mixed legacy + new videos → both types play (wrapper handles unsigned legacy AND signed new).
6. After all of the above, the watermark stays positioned correctly across fullscreen transitions in CoursePlayer (the DOM-walking quirk noted in the migration gotchas).
7. Admin opens `/api/mux/playback-token` for a course they don't own and aren't enrolled in (admin custom claim set, course is publicly visible) → admin branch fires, signed token issued, server log shows `reason=admin`. (Path D shipped this; covering it in the test plan ensures it doesn't regress when the wrapper is added.)
8. Instructor uploads a NEW video to any course → after Mux processes it, the per-video card thumbnail renders correctly (signed thumbnail URL via `/api/mux/thumbnail-token` or via the playback-token endpoint's `thumbnailToken` field, depending on which approach Step 3.5.C picks). NO broken-image icons anywhere in instructor or admin surfaces.
9. Instructor uploads a NEW video and immediately tries to preview it before Mux finishes processing → `SignedMuxPlayer` wrapper surfaces a "processing" state cleanly. Token endpoint returns `409 VIDEO_NOT_READY` without throwing. Player retries automatically once `playbackId` becomes available, OR shows a clear "video is processing, please wait" message. No infinite spinner, no console errors, no poisoned state.

If any of those nine fail, do NOT flip upload policy to `["signed"]`. The flip is the LAST step and should be done in a separate commit after the wrapper is proven across all surfaces.

---

## F. Manual test plan

For each new route, run one happy-path and one auth-failure case before the mobile client integrates. Use a real Firebase ID token from the Firebase Auth REST API or the web app's network tab.

| Route | Happy-path | Auth-failure |
|---|---|---|
| `GET /api/courses` | `curl -H "Authorization: Bearer $T" .../api/courses?pageSize=5` → 200, 5 courses, all `status:published` and `isApproved:true`. | No header → 401 `{success:false,error:{code:"UNAUTHENTICATED"}}` (JSON, not redirect). |
| `GET /api/courses/:id` | Existing approved course id → 200 with full course detail. | Soft-deleted course id → 404. |
| `GET /api/me` | → 200 with own profile. | Bearer of expired token → 401 `EXPIRED_TOKEN`. |
| `PATCH /api/me` | `{displayName:"Test"}` → 200, then `GET /api/me` reflects the change. | Body `{language:"klingon"}` → 400 Zod error. |
| `GET /api/me/enrollments` | Enroll in a free course on web first, then GET → that course appears. | Bearer of a different user → only that user's enrollments. |
| `GET /api/me/favorites` | After `POST` favorite → courseId appears. | No header → 401. |
| `POST /api/me/favorites` | `{courseId:"abc"}` → 200, repeat call also 200 (idempotent). | `{courseId:""}` → 400. |
| `DELETE /api/me/favorites/:courseId` | After favoriting then deleting → `GET` no longer includes it. | DELETE for never-favorited id → 200 (idempotent). |
| `GET /api/wallet` | New user → 200 with `balance:0` (auto-created). | No header → 401. |
| `GET /api/wallet/transactions` | After a topup approval on web → that transaction appears. | `limit=999` → clamped to 50, no error. |
| `POST /api/wallet/topup/upload-receipt` | `{contentType:"image/jpeg",sizeBytes:500000}` → 200 with `uploadUrl`, then `curl -X PUT --data-binary @file.jpg "$uploadUrl"` succeeds. | `{contentType:"application/pdf"}` → 400. |
| `POST /api/wallet/topup/request` | After upload-receipt → request created, `topup_requests` doc has `paymentMethod` and `receiptUrl`. Admin web page shows it as pending. | Two requests in a row → second returns 400 "pending request exists". |
| `GET /api/wallet/topup/history` | After creating a request → it appears with `status:"pending"`. After admin approves on web → next call shows `status:"approved"`. | No header → 401. |
| `POST /api/enrollments` (free) | `courseId` of a `price:0` course → 200, `enrollments/{uid}_{cid}` exists, `enrollmentCount` incremented. | Same call again → 200 with idempotent flag, no double-increment. |
| `POST /api/enrollments` (paid) | Sufficient balance → 200 `{newBalance}`, balance decremented exactly once even on retried call. | Insufficient balance → 400 with Arabic error message. |
| `POST /api/mux/playback-token` | Enrolled user + valid `videoId` → 200 with `playbackId` and signed `token`. Token plays the video in a Mux player; same token after `expiresAt` no longer plays. | Not-enrolled user + paid course → 403. |

All 401s **must** be JSON responses, not redirects. Verify by passing `--max-redirs 0 -i` to `curl` and confirming the body is JSON, not HTML.

---

## G. Known limitations

Things that work today but have a documented edge worth knowing about.

### Course catalog filters (`GET /api/courses`)

`level` filtering works. `category` filtering and combined `category + level`
filtering both **return 500** on a clean Firebase project because they need
composite indexes that aren't yet created. Mobile v1 only filters by `level`,
so we're deferring the index work until a screen actually needs it.

| Query | Composite index needed |
|---|---|
| `?category=...` | `courses`: `status ASC, isApproved ASC, category ASC, createdAt DESC` |
| `?category=...&level=...` | `courses`: `status ASC, isApproved ASC, category ASC, level ASC, createdAt DESC` |

(`isRejected ASC` and `isDeleted ASC` may also need to be in the index
depending on how Firestore plans the query — Firebase will print the exact
required shape in the error URL when you hit it.)

When mobile UI starts using these filters, hit the endpoint once, click the
auto-create URL Firebase prints in the dev logs, done.

### Search

Searching courses or instructors by **name** is **not** in the API surface.
Firestore can't do free-text search efficiently; doing it via prefix-matching
on `title`/`instructorName` would mislead users into thinking it's a real
search.

A dedicated search service (likely Algolia, which integrates cleanly with
Firestore via the official extension) is the right answer. **Deferred to a
post-mobile-v1 task** — mobile v1 ships with category/level filters only,
no search bar.

---

## H. Post-mobile follow-ups

These are explicitly out of scope for the API migration. Each is a separate PR after the mobile app is live.

1. **Delete `/Course/[courseId]` web viewer route** and any web-only Mux player code. Single cleanup PR.
2. **Remove all ZainCash code** — `app/api/payments/zaincash/*`, `lib/payments/zaincash.ts`, related env vars, error page. Single cleanup PR.
3. **Update `/admin-dashboard/topup-approvals` UI** to show `paymentMethod` and a thumbnail/preview of `receiptUrl` (presigned R2 GET).
4. **iOS screen-capture detection** in the mobile app (v1.1).
5. **Mux signing key rotation policy** — short doc covering when to rotate `MUX_SIGNING_PRIVATE_KEY`, how to do it without downtime (Mux supports overlapping signing keys), and where the new key/cert lives.
6. **Remove `/api/health/me`** — the temporary auth-helper smoke endpoint added in Step 1. Delete before production. It echoes the decoded bearer token's `userId`, `email`, and `isAdmin` flag, which is fine for dev but unnecessary surface area in prod.

---

## Stop here

After this plan is reviewed, the user will pick which step from section E to implement first. No code is written until then.
