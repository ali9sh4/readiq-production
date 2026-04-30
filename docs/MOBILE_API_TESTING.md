# Mobile API Testing Guide

`curl` recipes for hitting the new `/api/*` mobile endpoints.

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

Two endpoints need composite indexes that the existing web doesn't use. The
first time you hit them on a fresh project you'll see a `500
INTERNAL_ERROR` and a Firebase index-creation URL in server logs (`npm run
dev` console). Click each URL once — it autopopulates the right index in the
Firebase console.

| Endpoint | Index needed |
|---|---|
| `GET /api/wallet/topup/history` | `topup_requests`: `userId ASC, createdAt DESC` |
| `GET /api/me/enrollments` | `enrollments`: `userId ASC, status ASC, enrolledAt DESC` |

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

# 404 PROFILE_NOT_FOUND → user authed but never went through web registration
# (the web register flow is what creates users/{uid}). Reproduce by signing in
# with a Firebase Auth user that has no Firestore doc.
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
`POST /api/mux/playback-token` (Step 3) to actually play those videos.

---

## Step 3 — Mux signed playback (`POST /api/mux/playback-token`)

Returns a short-lived (2-hour) Mux JWT scoped to a single `playbackId`. The
mobile app must call this every time it starts a video.

> **Until Step 3.5 lands, no signed Mux assets exist. The endpoint is
> structurally correct but cannot be end-to-end tested with a real video —
> playback ID inputs would correspond to public-policy assets, and Mux
> refuses to issue signed JWTs for those. End-to-end test happens after 3.5
> flips uploads to signed.**

You can still verify the routing, auth, validation, enrollment gate, and
error codes against the recipes below — the endpoint will issue a JWT for
any `playbackId` it finds; that JWT just won't play against a public-policy
asset on `stream.mux.com`.

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

### d) Course not found / not visible → 404 `COURSE_NOT_FOUND`

```bash
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"does-not-exist\",\"videoId\":\"$VIDEO_ID\"}" \
  "$BASE_URL/api/mux/playback-token"
# 404 COURSE_NOT_FOUND. Same response if the course is draft/unapproved/deleted.
```

### e) Video not in course → 404 `VIDEO_NOT_FOUND`

```bash
curl -i -X POST -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_ID\",\"videoId\":\"video_999\"}" \
  "$BASE_URL/api/mux/playback-token"
```

### f) Upload still processing → 409 `VIDEO_NOT_READY`

Reproducible by hitting the endpoint between `createMuxUpload` and the moment
`saveCourseVideoToFireStore` writes back the `playbackId`. Rare in practice.

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
| Course id doesn't exist or isn't publicly visible | 404 | `COURSE_NOT_FOUND` |
| `videoId` not in course | 404 | `VIDEO_NOT_FOUND` |
| Course/video exists but `playbackId` not yet set | 409 | `VIDEO_NOT_READY` |
| Paid video, user not enrolled | 403 | `NOT_ENROLLED` |
