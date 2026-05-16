# Mobile API Testing Guide

`curl` recipes for hitting the new `/api/*` mobile endpoints.

## How to use this doc

### Test env vars

Test credentials live in `~/readiq-test-env.sh` on the dev machine (not in
the repo — it contains a real password). Source it once per shell. Example
shape (substitute your own values):

```bash
# ~/readiq-test-env.sh
export FIREBASE_API_KEY="<firebase-web-api-key>"   # same key as firebase/client.ts
export TEST_EMAIL="<your-test-account@example.com>"
export TEST_PASSWORD="<your-test-password>"
export API_BASE="http://localhost:3000"
```

```bash
source ~/readiq-test-env.sh
```

The recipes below use `BASE_URL` and `FIREBASE_WEB_API_KEY`; if your env file
uses different names (`API_BASE`, `FIREBASE_API_KEY`), either rename in the
file or alias them in your shell — both styles work.

### Get a fresh Firebase ID token

ID tokens expire after **1 hour**. Standard recipe:

```bash
ID_TOKEN=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"returnSecureToken\":true}" \
  | jq -r .idToken)

echo "$ID_TOKEN" | head -c 40; echo "..."
```

If the test account doesn't exist yet, register it through the web app's
`/register` page first.

### Recommended testing pattern

Work through endpoints in **small batches of 3–4 curls at a time** rather
than firing off the whole list. After each batch, paste the output back into
the conversation, confirm the response shape and status codes match
expectations, and only then move to the next batch. This catches regressions
early — a misshaped JSON body or wrong status code is much cheaper to fix
when only one batch has run than after a full sweep.

For a fresh `npm run dev` session, start with `/api/health/me` (Step 1) to
prove auth wiring before touching any data routes.

### Sectional courses (Phase 7a — read-only on mobile)

Phase 7a added sectional read fields to `/api/courses`, `/api/courses/:id`,
`/api/me/enrollments`, and `/api/me/favorites` (see "Sectional Purchasing —
Field Reference" in `MOBILE_API_MIGRATION.md` for the field list). The
mobile contract is **reader-app**: it can display sectional structure,
per-section prices, and per-user lock state, but it cannot purchase
sections or bundles client-side — purchase is web-only. Mobile-side
sectional test coverage is therefore intentionally absent here: the
purchase flow (`purchaseSectionsWithWallet`, `purchaseBundleWithWallet`)
is exercised by the web manual test plans and `scripts/test-purchase.mjs`.
`POST /api/enrollments` rejects sectional courses with `COURSE_NOT_SECTIONAL`
(400) — mobile must surface that response as "buy on web."

## Setup

### 1. Get a Firebase ID token for a test user

The app uses Firebase Auth (email/password). To get an ID token outside the
app, hit the Identity Toolkit REST API directly with the project's **web API
key**.

The web API key is not secret — it's already in `firebase/client.ts`
(`AIzaSyCmjn2Enchkf-BH3-dBuBfCJPKPDnqfeT8`) and is restricted server-side via
Firebase Auth itself. Set it once in your shell:

```bash
export FIREBASE_WEB_API_KEY="AIzaSyCmjn2Enchkf-BH3-dBuBfCJPKPDnqfeT8"
export TEST_EMAIL="you@example.com"
export TEST_PASSWORD="your-test-password"
export BASE_URL="http://localhost:3000"
```

Sign in and capture the token:

```bash
ID_TOKEN=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_WEB_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"returnSecureToken\":true}" \
  | jq -r .idToken)

echo "$ID_TOKEN"
```

ID tokens expire after **1 hour**. Re-run to refresh.

If the test account doesn't exist yet, register it through the web app's
`/register` page first.

### 2. Conventions for every recipe

- Success → `200` with `{"success":true,"data":...}`.
- Auth failure → `401` with `{"success":false,"error":{"code":"NO_TOKEN"|"INVALID_TOKEN"|"EXPIRED_TOKEN"|"REVOKED_TOKEN", ...}}`.
- Validation failure → `400` with `error.code === "VALIDATION_ERROR"` and an
  `error.fields[]` array.
- Not found → `404` with a route-specific code (`PROFILE_NOT_FOUND`,
  `COURSE_NOT_FOUND`).
- Pass `-i --max-redirs 0` to confirm responses are JSON, never redirects.

### 3. First-time Firestore index setup

Some endpoints need composite indexes that the existing web doesn't use. The
first time you hit them on a fresh project you'll see a `500
INTERNAL_ERROR` and a Firebase index-creation URL in server logs (`npm run
dev` console). Click each URL once — it autopopulates the right index in the
Firebase console.

**Indexes created during Step 2 testing on the dev project** (per commit
`386d15d`):

| Endpoint | Index |
|---|---|
| `GET /api/wallet/topup/history` | `topup_requests`: `userId ASC, createdAt DESC` |
| `GET /api/courses?level=...` | `courses`: `status ASC, isApproved ASC, level ASC, createdAt DESC` (TODO: confirm exact field order in Firebase Console — this repo doesn't track `firestore.indexes.json`, so the canonical source is the console). The same query also reads `isRejected` and `isDeleted`, which Firestore may fold into the same index automatically. |

**May also be required on a fresh project**:

| Endpoint | Probable index |
|---|---|
| `GET /api/me/enrollments` | `enrollments`: `userId ASC, status ASC, enrolledAt DESC` (was not explicitly created during Step 2 testing — either the dev project already had a compatible index, or Firestore satisfied the query from existing single-field indexes). If you see a 500 on a fresh project, follow the auto-create link. |

The category and `category + level` filter combinations on `/api/courses`
intentionally do **not** have indexes yet — see "Known limitations" in
`MOBILE_API_MIGRATION.md` section G. Mobile v1 only filters by `level`.

The other paginated endpoints (`/api/wallet/transactions`, `/api/me/favorites`)
reuse indexes already in use by the web.

---

## Step 1 — auth helper smoke test (`/api/health/me`)

`/api/health/me` is a temporary debug endpoint. **Remove before production.**

### a) No `Authorization` → 401 `NO_TOKEN`

```bash
curl -i "$BASE_URL/api/health/me"
```

### b) Garbage token → 401 `INVALID_TOKEN`

```bash
curl -i -H "Authorization: Bearer garbage" "$BASE_URL/api/health/me"
```

### c) Real token → 200

```bash
curl -i -H "Authorization: Bearer $ID_TOKEN" "$BASE_URL/api/health/me"
# {"success":true,"data":{"userId":"...","email":"...","isAdmin":false}}
```

---

## Step 2 — read-only endpoints

### `GET /api/me`

Returns the authenticated user's Firestore profile (`users/{uid}`).

```bash
# Happy path → 200 with profile fields
curl -i -H "Authorization: Bearer $ID_TOKEN" "$BASE_URL/api/me"

# Auth failure → 401 NO_TOKEN
curl -i "$BASE_URL/api/me"

# 404 PROFILE_NOT_FOUND → authed user has no users/{uid} doc yet.
# Web users get the doc auto-created on first auth state change by
# context/authContext.tsx → createOrUpdateUser. Mobile users bootstrap
# it explicitly with POST /api/me (see Step 4). Reproduce the 404 by
# signing in with a Firebase Auth user whose Firestore doc was never
# created (or was deleted).
```

### `GET /api/wallet`

Returns wallet balance. **Auto-creates** an empty wallet on first call so a
brand-new user sees `balance: 0` instead of 404.

```bash
curl -i -H "Authorization: Bearer $ID_TOKEN" "$BASE_URL/api/wallet"
# {"success":true,"data":{"userId":"...","balance":0,"totalTopups":0, ... }}

# Auth failure
curl -i "$BASE_URL/api/wallet"
```

### `GET /api/wallet/transactions`

Paginated wallet transactions. Cursor = last seen `wallet_transactions` doc id.

```bash
# Default page (limit=20)
curl -i -H "Authorization: Bearer $ID_TOKEN" "$BASE_URL/api/wallet/transactions"

# Custom limit + cursor
curl -i -H "Authorization: Bearer $ID_TOKEN" \
  "$BASE_URL/api/wallet/transactions?limit=5&cursor=<id-from-previous-response>"

# Validation failure → 400 VALIDATION_ERROR
curl -i -H "Authorization: Bearer $ID_TOKEN" \
  "$BASE_URL/api/wallet/transactions?limit=999"
# error.fields[0].path == "limit"
```

Response shape: `{ items: [...], nextCursor: string | null, hasMore: bool }`.

### `GET /api/wallet/topup/history`

User's own topup requests, all statuses, paginated.

```bash
curl -i -H "Authorization: Bearer $ID_TOKEN" "$BASE_URL/api/wallet/topup/history"

# 500 INTERNAL_ERROR on first call → check server logs for an index-creation
# URL, click it, retry.

# Auth failure
curl -i "$BASE_URL/api/wallet/topup/history"
```

Old web-created topup requests have `paymentMethod: null` and `receiptUrl:
null` — the new mobile flow (Step 5) will populate them.

### `GET /api/me/enrollments`

Paginated. Each item carries the joined course basics needed for the "My
Courses" list screen (no extra round-trip per course).

```bash
curl -i -H "Authorization: Bearer $ID_TOKEN" "$BASE_URL/api/me/enrollments"

# Auth failure
curl -i "$BASE_URL/api/me/enrollments"

# 500 on first call → composite index needed; see "First-time Firestore index
# setup" above.
```

Item shape:

```json
{
  "enrollmentId": "uid_courseId",
  "courseId": "courseId",
  "enrolledAt": "2026-01-15T10:00:00.000Z",
  "course": {
    "id": "courseId",
    "title": "...",
    "thumbnailUrl": "...",
    "instructorName": "...",
    "language": "arabic"
  }
}
```

Enrollments whose course is now soft-deleted (`isDeleted: true`) are filtered
out — `hasMore` is computed on the raw enrollment page, so you may see fewer
than `limit` items.

### `GET /api/me/favorites`

Paginated. Returns full course summaries (matches the web `getUserFavorites`
join pattern).

```bash
curl -i -H "Authorization: Bearer $ID_TOKEN" "$BASE_URL/api/me/favorites"

# Auth failure
curl -i "$BASE_URL/api/me/favorites"
```

### `GET /api/courses` (PUBLIC — no auth required)

Public catalog. Filter applied: `isApproved == true AND isRejected == false
AND status == "published" AND isDeleted == false` (copied from
`app/page.tsx:53`).

```bash
# Default
curl -i "$BASE_URL/api/courses"

# Filtered
curl -i "$BASE_URL/api/courses?category=programming&level=beginner&language=arabic&limit=5"

# Cursor pagination
curl -i "$BASE_URL/api/courses?cursor=<courseId-from-previous-response>"

# Validation failure → 400
curl -i "$BASE_URL/api/courses?level=expert"
```

### `GET /api/courses/[courseId]` (PUBLIC — no auth required)

Single course detail. Same visibility filter as the listing — anything else
returns 404.

```bash
# Happy path → 200 with full course detail (videos, learningPoints, etc.)
curl -i "$BASE_URL/api/courses/<published-course-id>"

# Unpublished / unapproved / soft-deleted → 404 COURSE_NOT_FOUND
curl -i "$BASE_URL/api/courses/<draft-course-id>"

# Bogus id → 404
curl -i "$BASE_URL/api/courses/does-not-exist"
```

`videos[].playbackId` is **only** included when `isFreePreview === true`.
Everything else has `playbackId: null` — mobile must call
`POST /api/mux/playback-token` (Step 3B) to actually play those videos.

---

## Step 3B — Mux signed playback (`POST /api/mux/playback-token`)

Returns a short-lived Mux JWT scoped to a single `playbackId`. The mobile
app must call this every time it starts a video.

> ⚠️ **Status: endpoint shipped (commit `f8acbb5`), end-to-end playback
> blocked until Step 3.5 lands.** Step 3.5 flips `createMuxUpload` to
> `playback_policy: ["signed"]` and migrates the three web Mux player
> surfaces (`components/video_uploader.tsx`, `components/CoursePreview.tsx`,
> `components/ui/CoursePlayer.tsx`) onto a `SignedMuxPlayer` wrapper. Until
> then, every existing Mux asset is public-policy, and Mux refuses to issue
> signed JWTs against public-policy assets — so a request that hits this
> endpoint returns a JWT, but that JWT will not play against
> `stream.mux.com` for any current course video.
>
> You **can** still verify routing, auth, validation, error codes, the
> course-visibility filter, the free-preview bypass, and the enrollment gate
> against the recipes below. Only the final "stream the bytes" step in (i)
> is gated on Step 3.5.

Set a couple of variables for the recipes below:

```bash
export COURSE_ID="<published-course-id>"
export VIDEO_ID="video_1"   # the videoId field on course.videos[], not the Mux asset id
```

### a) Happy path — enrolled user, paid video → 200

```bash
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_ID\",\"videoId\":\"$VIDEO_ID\"}" \
  "$BASE_URL/api/mux/playback-token"
# {"success":true,"data":{"playbackId":"...","token":"<jwt>","expiresAt":"..."}}
```

Capture the response into shell variables for the playback test below:

```bash
RESP=$(curl -s -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_ID\",\"videoId\":\"$VIDEO_ID\"}" \
  "$BASE_URL/api/mux/playback-token")

PLAYBACK_ID=$(echo "$RESP" | jq -r .data.playbackId)
TOKEN=$(echo "$RESP" | jq -r .data.token)
```

### b) Free preview — any authed user, regardless of enrollment → 200

```bash
# Same request as (a) but with a videoId whose isFreePreview === true.
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_ID\",\"videoId\":\"<free-preview-video-id>\"}" \
  "$BASE_URL/api/mux/playback-token"
```

### c) Not enrolled, paid video → 403 `NOT_ENROLLED`

```bash
# Sign in as a user who has not enrolled in $COURSE_ID, then:
curl -i -X POST -H "Authorization: Bearer $OTHER_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_ID\",\"videoId\":\"$VIDEO_ID\"}" \
  "$BASE_URL/api/mux/playback-token"
# {"success":false,"error":{"code":"NOT_ENROLLED", ...}}  HTTP 403
```

### c.1) Course owner — bypasses enrollment AND visibility gate → 200

The owner branch (added in Path D / Step 3.5-prep) lets the instructor
fetch a token for any course where `course.createdBy === auth.userId`,
including drafts, unapproved courses, and unpublished courses. This is what
unblocks the instructor preview surface in `components/video_uploader.tsx`
once Step 3.5 lands.

```bash
# Sign in as the user listed as course.createdBy for $COURSE_ID, then:
curl -i -X POST -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_ID\",\"videoId\":\"$VIDEO_ID\"}" \
  "$BASE_URL/api/mux/playback-token"
# 200, server log shows: reason=owner

# Now hit it against a DRAFT course you own (status !== "published")
export DRAFT_COURSE_ID="<a-course-you-own-that-is-NOT-publicly-visible>"
curl -i -X POST -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$DRAFT_COURSE_ID\",\"videoId\":\"video_1\"}" \
  "$BASE_URL/api/mux/playback-token"
# 200 — owner bypasses the visibility gate.
# Server log shows: reason=owner

# Sanity-check: same draft course as a non-owner → 404 COURSE_NOT_FOUND
# (the visibility gate still applies to everyone else)
curl -i -X POST -H "Authorization: Bearer $OTHER_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$DRAFT_COURSE_ID\",\"videoId\":\"video_1\"}" \
  "$BASE_URL/api/mux/playback-token"
# 404 COURSE_NOT_FOUND
```

### c.2) Global admin — bypasses enrollment AND visibility gate → 200

Same behavior as the owner branch but driven by the `admin === true`
custom claim on the Firebase ID token (surfaced as `auth.isAdmin`). This is
what lets admins review pending / unapproved courses in the dashboard.

```bash
# Sign in as a Firebase user with admin === true custom claim:
export ADMIN_TOKEN=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_WEB_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"returnSecureToken\":true}" \
  | jq -r .idToken)

# Pending / unapproved course (status:"pending" OR isApproved:false)
export PENDING_COURSE_ID="<a-course-pending-admin-review>"
curl -i -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$PENDING_COURSE_ID\",\"videoId\":\"video_1\"}" \
  "$BASE_URL/api/mux/playback-token"
# 200 — admin bypasses the visibility gate.
# Server log shows: reason=admin
```

If `auth.isAdmin` is `false`, the route falls through to the regular
student gating. Confirm the custom claim is set:

```bash
# Hit the auth-debug endpoint and look for "isAdmin": true
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/health/me" | jq .
```

If `isAdmin: false`, set the claim via Firebase Admin SDK first
(`adminAuth.setCustomUserClaims(uid, { admin: true })`) and re-sign in to
pick it up — custom claims propagate on next ID token refresh.

### d) Course not found / not visible → 404 `COURSE_NOT_FOUND`

```bash
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"does-not-exist\",\"videoId\":\"$VIDEO_ID\"}" \
  "$BASE_URL/api/mux/playback-token"
# 404 COURSE_NOT_FOUND. Same response if the course is draft/unapproved/deleted
# AND the caller is not the owner / not an admin.
```

### e) Video not in course → 404 `VIDEO_NOT_FOUND`

```bash
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_ID\",\"videoId\":\"video_999\"}" \
  "$BASE_URL/api/mux/playback-token"
```

### f) Upload still processing → 409 `VIDEO_NOT_READY`

Returned when the video doc exists in `course.videos[]` but its
`playbackId` field is missing or empty. This happens between the moment
`createMuxUpload` returns and the moment Mux finishes ingest +
`saveCourseVideoToFireStore` writes back the `playbackId`. Rare in
practice but the wrapper must distinguish this from `VIDEO_NOT_FOUND`
(retry vs. give up).

Easiest way to reproduce in dev: open Firestore console, find a video in
`courses/{id}.videos[]`, blank out its `playbackId` field, then curl:

```bash
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_ID\",\"videoId\":\"<id-of-video-with-blank-playbackId>\"}" \
  "$BASE_URL/api/mux/playback-token"
# HTTP/1.1 409
# {"success":false,"error":{"code":"VIDEO_NOT_READY","message":"Video upload has not finished processing"}}
```

Restore the `playbackId` field after testing.

### g) No auth → 401 `NO_TOKEN`

```bash
curl -i -X POST -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_ID\",\"videoId\":\"$VIDEO_ID\"}" \
  "$BASE_URL/api/mux/playback-token"
```

### h) Validation failure → 400 `VALIDATION_ERROR`

```bash
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"\",\"videoId\":\"\"}" \
  "$BASE_URL/api/mux/playback-token"
```

### i) Use the token to actually play the video

The token goes on the Mux playback URL as `?token=<jwt>`. HEAD the HLS
playlist to confirm Mux accepts the signature:

```bash
curl -I "https://stream.mux.com/${PLAYBACK_ID}.m3u8?token=${TOKEN}"
# HTTP/2 200  → token accepted.
# HTTP/2 403  → signed-policy asset rejecting an unsigned/invalid/expired token.
```

A `200` response means the player can stream it. A `403` here means either
the token is expired/wrong-key, or the asset's playback policy is wrong —
double-check the asset was uploaded *after* Step 3 (so it's `signed`).

### Quick failure-mode reference

| Case | Status | `error.code` |
|---|---|---|
| No `Authorization` header | 401 | `NO_TOKEN` |
| Bad/expired/revoked bearer | 401 | `INVALID_TOKEN` / `EXPIRED_TOKEN` / `REVOKED_TOKEN` |
| Body missing fields | 400 | `VALIDATION_ERROR` |
| Course id doesn't exist | 404 | `COURSE_NOT_FOUND` |
| Course not publicly visible AND caller is not owner/admin | 404 | `COURSE_NOT_FOUND` |
| `videoId` not in course | 404 | `VIDEO_NOT_FOUND` |
| Video in course but `playbackId` missing (still processing) | 409 | `VIDEO_NOT_READY` |
| Paid video, user not enrolled, not owner, not admin | 403 | `NOT_ENROLLED` |
| Owner (`course.createdBy === auth.userId`) | 200 | — bypasses visibility + enrollment, server log `reason=owner` |
| Admin (`auth.isAdmin === true`) | 200 | — bypasses visibility + enrollment, server log `reason=admin` |
| Free preview (`video.isFreePreview === true`) | 200 | — any authed user, server log `reason=free-preview` |

---

## Step 4 — small write endpoints

Three low-risk write routes that wrap existing server actions.

### `POST /api/me`

Bootstraps the authenticated user's `users/{uid}` Firestore profile after a
fresh sign-in (typically Google OAuth on mobile). Mobile clients call this
once, after sign-in, to ensure GET/PATCH `/api/me` no longer return 404.

**Idempotent.** If the doc already exists, it is returned unchanged with
status 200 — no `PROFILE_ALREADY_EXISTS` error. The `displayName` and
`photoURL` are sourced from the Firebase Auth record (`adminAuth.getUser`),
so a Google sign-in carries those over automatically.

Body: empty (no JSON to send).

Returns the same 8-field projection as `GET /api/me`.

```bash
# Happy path (no doc yet) → 200 with the newly-created profile
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" "$BASE_URL/api/me"

# Idempotent re-call (doc already exists) → 200, same profile, doc unchanged
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" "$BASE_URL/api/me"

# Auth failure → 401 NO_TOKEN
curl -i -X POST "$BASE_URL/api/me"

# Round-trip sanity check: POST then GET should return identical envelopes
curl -s -X POST -H "Authorization: Bearer $ID_TOKEN" "$BASE_URL/api/me" | jq .
curl -s        -H "Authorization: Bearer $ID_TOKEN" "$BASE_URL/api/me" | jq .
```

### `PATCH /api/me`

Updates the authenticated user's profile. Only `displayName` and `language`
are mutable from mobile. At least one field must be provided.

Body shape: `{ displayName?: string (1..100), language?: 'ar' | 'en' }`.

Returns the same shape as `GET /api/me` (post-update).

```bash
# Happy path → 200 with the updated profile
curl -i -X PATCH -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Ali","language":"ar"}' \
  "$BASE_URL/api/me"

# Single-field update is fine
curl -i -X PATCH -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"en"}' \
  "$BASE_URL/api/me"

# Auth failure → 401 NO_TOKEN
curl -i -X PATCH -H "Content-Type: application/json" \
  -d '{"displayName":"Ali"}' \
  "$BASE_URL/api/me"

# Validation failure (empty body) → 400 VALIDATION_ERROR
curl -i -X PATCH -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE_URL/api/me"

# Validation failure (bad enum) → 400 VALIDATION_ERROR
curl -i -X PATCH -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"fr"}' \
  "$BASE_URL/api/me"

# 404 PROFILE_NOT_FOUND → authed user has no users/{uid} doc
# (same reproduction as GET /api/me)
```

### `POST /api/me/favorites`

Adds a course to the authenticated user's favorites. Idempotent — re-adding
returns success. The course must be publicly visible (published, approved,
not rejected, not soft-deleted) or you get 404 `COURSE_NOT_FOUND`. Wraps the
existing `addToFavorites` server action.

Body shape: `{ courseId: string (non-empty) }`.

```bash
export COURSE_ID="<published-course-id>"

# Happy path → 200 { courseId, addedAt }
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_ID\"}" \
  "$BASE_URL/api/me/favorites"

# Re-add same course → 200 (idempotent, no error)
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_ID\"}" \
  "$BASE_URL/api/me/favorites"

# Auth failure → 401 NO_TOKEN
curl -i -X POST -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_ID\"}" \
  "$BASE_URL/api/me/favorites"

# Validation failure (empty courseId) → 400 VALIDATION_ERROR
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId":""}' \
  "$BASE_URL/api/me/favorites"

# 404 COURSE_NOT_FOUND → bogus id, draft, unapproved, or soft-deleted course
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId":"does-not-exist"}' \
  "$BASE_URL/api/me/favorites"
```

### `DELETE /api/me/favorites/[courseId]`

Removes a course from the authenticated user's favorites. Idempotent — if the
course isn't in favorites, still returns success with the same shape. Wraps
the existing `removeFromFavorites` server action. **Does not** check course
visibility (a course that becomes unpublished must still be removable).

Path param: `courseId` (non-empty).

```bash
export COURSE_ID="<any-course-id>"

# Happy path → 200 { courseId, removed: true }
curl -i -X DELETE -H "Authorization: Bearer $ID_TOKEN" \
  "$BASE_URL/api/me/favorites/$COURSE_ID"

# Repeat call (already removed) → 200 (idempotent, same shape)
curl -i -X DELETE -H "Authorization: Bearer $ID_TOKEN" \
  "$BASE_URL/api/me/favorites/$COURSE_ID"

# Auth failure → 401 NO_TOKEN
curl -i -X DELETE "$BASE_URL/api/me/favorites/$COURSE_ID"

# Validation failure (empty path segment isn't routable, so the closest
# analogue is sending whitespace which Zod min(1) catches after URL decode):
curl -i -X DELETE -H "Authorization: Bearer $ID_TOKEN" \
  "$BASE_URL/api/me/favorites/%20"
# → 400 VALIDATION_ERROR if the route param fails min(1) after decoding,
# otherwise treated as a non-existent favorite and returns 200 (idempotent).
```

Note: there is no 404 case — DELETE on a non-favorited course is success, by
design. If the underlying Firestore delete throws, you'll see 500
`INTERNAL_ERROR` and the cause is logged server-side under
`[api/me/favorites DELETE] removeFromFavorites failed`.

---

## Step 5 — wallet topup with manual receipt upload

Two new endpoints make up the mobile topup flow. The web flow
(`createTopupRequest` server action) is **untouched** and continues to work.

Both endpoints are mobile-only — they layer additive fields onto the existing
`topup_requests` collection. Old web-created docs predate `paymentMethod`,
`receiptKey`, `receiptUrl`, `receiptContentType`, and `note`; the history
route already surfaces those as `null` for backwards compatibility.

End-to-end flow:

1. Client picks a file, calls `POST /api/wallet/topup/upload-receipt` with
   the file's contentType and size → gets a presigned PUT URL + an R2 key.
2. Client `PUT`s the file body directly to the presigned URL.
3. Client calls `POST /api/wallet/topup/request` with the R2 key + amount
   + paymentMethod + senderName → server verifies the upload, enforces
   daily limit, writes the topup_requests doc, returns the request id.
4. Admin sees it in the existing topup-approvals page (UI update for the new
   fields is a Step 5 follow-up — see `MOBILE_API_MIGRATION.md` section H).
   Clients can poll `GET /api/wallet/topup/history` to see status.

### Bounds and rules

| Field | Rule |
|---|---|
| `contentType` | one of `image/jpeg`, `image/png`, `image/webp`, `application/pdf` |
| `sizeBytes` | integer in `[1, 5_000_000]` |
| `amount` | integer IQD in `[1_000, 1_000_000]` |
| `paymentMethod` | one of `bank_transfer`, `personal_wallet`, `fastpay`, `other` |
| `senderName` | 1..100 chars |
| `note` | optional, ≤ 500 chars |
| receipt key ownership | the `receiptKey` body field MUST start with `topup-receipts/{userId}/` — server rejects mismatches |
| daily-limit window | UTC calendar day; sum of `pending` + `approved` `amount` for the user since today's UTC midnight |
| pending policy | only one `pending` request per user at a time (mirrors web) |

### `POST /api/wallet/topup/upload-receipt`

Returns a 10-minute presigned PUT URL and the R2 key the client must pass
back to `/topup/request`.

```bash
# Happy path → 200 { uploadUrl, key, expiresAt }
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg","sizeBytes":204800}' \
  "$BASE_URL/api/wallet/topup/upload-receipt"

# Auth failure → 401 NO_TOKEN
curl -i -X POST -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg","sizeBytes":204800}' \
  "$BASE_URL/api/wallet/topup/upload-receipt"

# Validation: bad contentType → 400 VALIDATION_ERROR
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/gif","sizeBytes":1000}' \
  "$BASE_URL/api/wallet/topup/upload-receipt"

# Validation: oversized sizeBytes → 400 VALIDATION_ERROR
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg","sizeBytes":9999999}' \
  "$BASE_URL/api/wallet/topup/upload-receipt"
```

### `POST /api/wallet/topup/request`

Creates a pending topup request after the receipt has been PUT to R2.

```bash
# Happy path → 200 { topupRequestId, status:"pending", expiresAt }
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\":50000,\"paymentMethod\":\"bank_transfer\",\"receiptKey\":\"$RECEIPT_KEY\",\"senderName\":\"Ali\",\"note\":\"branch deposit\"}" \
  "$BASE_URL/api/wallet/topup/request"

# Auth failure → 401 NO_TOKEN
curl -i -X POST -H "Content-Type: application/json" \
  -d "{\"amount\":50000,\"paymentMethod\":\"bank_transfer\",\"receiptKey\":\"$RECEIPT_KEY\",\"senderName\":\"Ali\"}" \
  "$BASE_URL/api/wallet/topup/request"

# Validation: amount below 1000 → 400 VALIDATION_ERROR
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\":500,\"paymentMethod\":\"bank_transfer\",\"receiptKey\":\"$RECEIPT_KEY\",\"senderName\":\"Ali\"}" \
  "$BASE_URL/api/wallet/topup/request"

# Validation: foreign receiptKey (not under topup-receipts/{your-uid}/)
# → 400 VALIDATION_ERROR ("receiptKey does not belong to this user")
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":50000,"paymentMethod":"bank_transfer","receiptKey":"topup-receipts/some-other-uid/123_abc.jpg","senderName":"Ali"}' \
  "$BASE_URL/api/wallet/topup/request"

# RECEIPT_NOT_UPLOADED → key looks valid but the object isn't in R2
# (skipped the PUT step or used a stale key after expiry)
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\":50000,\"paymentMethod\":\"bank_transfer\",\"receiptKey\":\"topup-receipts/$YOUR_UID/0_deadbeef.jpg\",\"senderName\":\"Ali\"}" \
  "$BASE_URL/api/wallet/topup/request"

# DAILY_LIMIT_EXCEEDED → sum of today's approved+pending + amount > wallet.dailyLimit
# (default dailyLimit is 5,000,000 IQD; reproduce by topping up close to the
# cap or by lowering dailyLimit on your test wallet doc)
```

### End-to-end recipe (upload → PUT → request → history)

```bash
# 1. Get a presigned PUT URL
UPLOAD_RESP=$(curl -s -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg","sizeBytes":'"$(stat -c%s ./receipt.jpg)"'}' \
  "$BASE_URL/api/wallet/topup/upload-receipt")

UPLOAD_URL=$(echo "$UPLOAD_RESP" | jq -r .data.uploadUrl)
RECEIPT_KEY=$(echo "$UPLOAD_RESP" | jq -r .data.key)
echo "key: $RECEIPT_KEY"

# 2. PUT the file body directly to R2. Content-Type MUST match what you sent
# in step 1 — the presigned URL was signed against that header.
curl -i -X PUT \
  -H "Content-Type: image/jpeg" \
  --upload-file ./receipt.jpg \
  "$UPLOAD_URL"
# Expect HTTP/1.1 200. A 403 means the Content-Type header doesn't match
# what was signed; a 400 means the URL has expired (10 min TTL).

# 3. File the topup request
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\":50000,\"paymentMethod\":\"bank_transfer\",\"receiptKey\":\"$RECEIPT_KEY\",\"senderName\":\"Ali\",\"note\":\"test\"}" \
  "$BASE_URL/api/wallet/topup/request"

# 4. Confirm it shows up in history with paymentMethod + receiptUrl populated
curl -s -H "Authorization: Bearer $ID_TOKEN" \
  "$BASE_URL/api/wallet/topup/history" | jq '.data.items[0]'
# Expect:
# {
#   "id": "...",
#   "amount": 50000,
#   "status": "pending",
#   "paymentMethod": "bank_transfer",
#   "receiptUrl": "https://<bucket>.r2.cloudflarestorage.com/topup-receipts/...",
#   "senderName": "Ali",
#   ...
# }

# 5. (Optional) The receiptUrl is a 24h signed GET. Sanity-check it:
RECEIPT_URL=$(curl -s -H "Authorization: Bearer $ID_TOKEN" \
  "$BASE_URL/api/wallet/topup/history" | jq -r '.data.items[0].receiptUrl')
curl -I "$RECEIPT_URL"
# HTTP/2 200 → admin UI can render the image/PDF directly.
```

### Quick failure-mode reference

| Case | Status | `error.code` |
|---|---|---|
| No `Authorization` header | 401 | `NO_TOKEN` |
| Bad/expired/revoked bearer | 401 | `INVALID_TOKEN` / `EXPIRED_TOKEN` / `REVOKED_TOKEN` |
| Body missing/invalid fields | 400 | `VALIDATION_ERROR` |
| `receiptKey` not under `topup-receipts/{userId}/` | 400 | `VALIDATION_ERROR` |
| `receiptKey` looks valid but R2 has no such object | 400 | `RECEIPT_NOT_UPLOADED` |
| Already have a `pending` request | 400 | `VALIDATION_ERROR` |
| `usedToday + amount > wallet.dailyLimit` | 400 | `DAILY_LIMIT_EXCEEDED` |
| Wallet auto-provision failed (rare) | 404 | `WALLET_NOT_FOUND` |

---

## Step 6 — enroll in a course (`POST /api/enrollments`)

The money-moving endpoint. Thin wrapper around the existing
`purchaseCourseWithWallet` (paid) and `enrollInFreeCourse` (free) server
actions — the atomic Firestore transaction in those actions is the source
of truth for both web and mobile and is **not** re-implemented here.

The route does pre-flight checks (course exists & visible, not already
enrolled, wallet exists, balance sufficient) for clean error codes, then
delegates. The underlying transaction re-validates inside Firestore so the
small race window between pre-check and commit is still safe — we just map
the resulting Arabic error string back to a stable error code.

### Body

```json
{ "courseId": "<courseId>" }
```

### Success response

```json
{
  "success": true,
  "data": {
    "enrollmentId": "<userId>_<courseId>",
    "courseId": "<courseId>",
    "status": "completed",
    "enrolledAt": "2026-05-01T12:34:56.000Z",
    "walletBalance": 47000,
    "transactionId": "enroll_<userId>_<courseId>_<timestamp>"
  }
}
```

`transactionId` is `null` for free courses (no wallet_transactions row is
written for free enrollments). For paid courses it equals the
`protectionKey` written to both the enrollment doc (`transactionId` field)
and the buyer's `wallet_transactions` row (`protectionKey` field).

### Failure mode reference

| Case | Status | `error.code` | Notes |
|---|---|---|---|
| No `Authorization` header | 401 | `NO_TOKEN` | |
| Bad/expired/revoked bearer | 401 | `INVALID_TOKEN` / `EXPIRED_TOKEN` / `REVOKED_TOKEN` | |
| Body missing/invalid `courseId` | 400 | `VALIDATION_ERROR` | `error.fields[]` carries the path |
| Course id doesn't exist or isn't publicly visible | 404 | `COURSE_NOT_FOUND` | Same response for draft/unapproved/rejected/soft-deleted |
| User already enrolled (status=`completed`) | 409 | `ALREADY_ENROLLED` | `details` carries the existing `{ enrollmentId, courseId, status, enrolledAt, transactionId }` so mobile can navigate to player without re-purchase |
| Paid course, balance < price | 402 | `INSUFFICIENT_BALANCE` | `details: { currentBalance, requiredPrice, shortfall }` |
| User has no wallet doc (very rare) | 404 | `WALLET_NOT_FOUND` | Auto-provision happens on first `GET /api/wallet`; this only fires if the user never hit that endpoint |
| Buying your own course | 403 | `CANNOT_BUY_OWN_COURSE` | From the underlying transaction's instructor === buyer guard |
| Protection-key collision (effectively impossible) | 409 | `IDEMPOTENCY_CONFLICT` | Defensive — tells mobile to refetch `/api/me/enrollments` and only retry if missing |

### Recipes

```bash
export COURSE_FREE_ID="<published-free-course-id>"
export COURSE_PAID_ID="<published-paid-course-id>"
```

#### a) Free course → 200

```bash
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_FREE_ID\"}" \
  "$BASE_URL/api/enrollments"
# {"success":true,"data":{"enrollmentId":"...", "transactionId":null, ...}}
```

#### b) Paid course, sufficient balance → 200

Top up first via Step 5 if your test wallet is empty (or hand-set
`wallets/{uid}.balance` in Firestore for a quick test).

```bash
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_PAID_ID\"}" \
  "$BASE_URL/api/enrollments"
# {"success":true,"data":{"enrollmentId":"...", "walletBalance":<new>, "transactionId":"enroll_..."}}
```

Verify the side-effects (admin lens):

```bash
# Enrollment doc
# → Firestore console: enrollments/<userId>_<courseId> with status=completed
# Wallet debit
# → wallets/<userId>.balance decreased by the effective price
# Audit row
# → wallet_transactions where userId=<userId> AND protectionKey=enroll_...
# Instructor credit
# → wallets/<course.createdBy>.balance increased by the same amount,
#   wallet_transactions row with type=earning for the instructor
# Course counter
# → courses/<courseId>.enrollmentCount += 1
```

#### c) Paid course, insufficient balance → 402

Reproduce by topping up less than the course price (or attempting any
paid course on a fresh wallet with `balance: 0`).

```bash
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_PAID_ID\"}" \
  "$BASE_URL/api/enrollments"
# HTTP/1.1 402
# {"success":false,"error":{"code":"INSUFFICIENT_BALANCE",
#  "details":{"currentBalance":0,"requiredPrice":50000,"shortfall":50000}}}
```

#### d) Already enrolled → 409

Re-run any successful (a) or (b) to trigger.

```bash
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_PAID_ID\"}" \
  "$BASE_URL/api/enrollments"
# HTTP/1.1 409
# {"success":false,"error":{"code":"ALREADY_ENROLLED",
#  "details":{"enrollmentId":"...","courseId":"...","status":"completed",
#             "enrolledAt":"...","transactionId":"enroll_..."}}}
```

Mobile reads `details.enrollmentId` and routes the user straight to the
course player — no error toast needed.

#### e) Course not found / not visible → 404

```bash
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId":"does-not-exist"}' \
  "$BASE_URL/api/enrollments"
# {"success":false,"error":{"code":"COURSE_NOT_FOUND", ...}}

# Same response for a draft/unapproved/rejected/soft-deleted course id.
```

#### f) Validation failure → 400

```bash
# Empty courseId
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId":""}' \
  "$BASE_URL/api/enrollments"

# Missing field
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE_URL/api/enrollments"
```

Both → 400 `VALIDATION_ERROR` with `error.fields[0].path === "courseId"`.

#### g) No auth → 401

```bash
curl -i -X POST -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_PAID_ID\"}" \
  "$BASE_URL/api/enrollments"
# {"success":false,"error":{"code":"NO_TOKEN", ...}}
```

#### h) Trying to buy your own course → 403 (defensive)

Sign in as the user listed as `course.createdBy` for `$COURSE_PAID_ID`,
then run (b). Returns 403 `CANNOT_BUY_OWN_COURSE`.

### What the transaction touches (for verifying side-effects)

The underlying `purchaseCourseWithWallet` writes are **unchanged** by this
route. For a paid enrollment, one atomic transaction commits all of:

1. `wallets/{buyerId}` — `balance -= price`, `totalSpent += price`,
   `updatedAt`.
2. `wallets/{instructorId}` — created if missing; `balance += price`,
   `totalEarnings += price`.
3. `wallet_transactions` (buyer row) — `type=purchase`, `amount=-price`,
   carries the `protectionKey` for idempotency.
4. `wallet_transactions` (instructor row) — `type=earning`, `amount=+price`.
5. `enrollments/{userId}_{courseId}` — `status=completed`,
   `paymentMethod=wallet`, `enrollmentType=paid`, `transactionId=<protectionKey>`.
6. `courses/{courseId}` — `enrollmentCount += 1`.

For a free enrollment (`enrollInFreeCourse` server action, batch write):

1. `enrollments/{userId}_{courseId}` — `enrollmentType=free`,
   `status=completed`. **No** `transactionId` field.
2. `courses/{courseId}` — `enrollmentCount += 1`.

Free enrollments do **not** write `wallet_transactions` rows.
