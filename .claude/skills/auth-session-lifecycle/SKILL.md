---
name: auth-session-lifecycle
description: >-
  Use whenever touching cookie/session auth: middleware.ts, context/authContext.tsx,
  context/actions.ts (setToken/removeToken), app/api/refresh-token/route.ts, the
  login/redirect flow, or ANY server component that reads the firebaseAuthToken
  cookie to decide what to render. Also read before changing a Mux/playback token
  lifetime or any redirect()/cookie write in a route handler or Server Component.
  Two of these files (middleware.ts, context/authContext.tsx) are OWNER-ONLY. This
  skill captures the cookie/token model and the Next.js auth gotchas that a wrong
  edit turns into "nobody can log in" or "a paying student sees buy buttons."
  Canonical diagnosis: docs/AUDIT_SYSTEM_HEALTH.md (Area 2 + Area 4).
---

# Auth & Session Lifecycle

Firebase auth on the web rides on **two cookies**, both set by `setToken` and
cleared by `removeToken` in `context/actions.ts` (httpOnly, sameSite lax,
`secure` in prod, path `/`):

- **`firebaseAuthToken`** — `maxAge` **7d** (`context/actions.ts`), but the value
  is a Firebase **ID token that expires in ~1h**. The cookie deliberately
  outlives the token inside it.
- **`firebaseAuthRefreshToken`** — `maxAge` **30d**. Exchanged at Google's
  securetoken endpoint by `app/api/refresh-token/route.ts` to mint a fresh ID
  token and re-stamp both cookies.

## The load-bearing invariant: verify everywhere, presence is never proof

Every consumer of `firebaseAuthToken` re-verifies the token's **signature +
exp** (`adminAuth.verifyIdToken` / middleware `jwtVerify`) — the 7 readers are
`app/course/[courseId]/page.tsx`, `app/user_dashboard/page.tsx`,
`app/user_dashboard/updatePassword/page.tsx`, `app/user_dashboard/myFavorites/page.tsx`,
`components/instructorCourse.tsx`, `app/course-upload/edit/[courseId]/page.tsx`,
and `middleware.ts`. **No consumer treats a present cookie as valid.**

This is *why* the cookie can be 7d while the token is 1h: a longer-lived cookie
carrying an expired token grants zero extra access — it just survives sleep so a
refresh path stays reachable. **Never re-shorten `firebaseAuthToken` to the
token's lifetime** — that reintroduces the S1 bug (cookie gone by expiry →
nothing can repair the session).

## Middleware (OWNER-ONLY `middleware.ts`)

- **Matcher**: `/admin-dashboard/*`, `/login`, `/register`, `/forget-password`,
  `/course-upload/*`, `/user_dashboard/*`, `/delete-account`. **`/course/*`, `/`,
  and `/api/*` are NOT matched** — a stale cookie is never repaired by middleware
  on those routes. Do not add `/api/:path*` (breaks mobile + ZainCash); do not
  naively add `/course/*` (would bounce anonymous visitors off the public
  preview).
- **Repair, don't just bounce (S1a):** a missing/expired/corrupt access token is
  sent to `/api/refresh-token?redirect=<path>` **when a refresh cookie exists**,
  else to `/login`. The `repairOrLogin` helper encodes this; the exp fast-path
  only fires when a refresh cookie is present (a still-valid token renders its
  remaining life). Middleware reads **both** cookies.
- **Loop termination is load-bearing:** the refresh route on **failure MUST
  clear both cookies and land on `/login`** (not `/`). Without that, a dead
  refresh cookie makes every protected hit bounce back to refresh forever — and
  a 7d cookie means the loop lasts 7 days. This is enforced by
  `clearedRedirect` in `app/api/refresh-token/route.ts` (`response.cookies.delete`
  on the redirect object). Verify it stays: `curl -sD -` the route with a
  garbage refresh cookie and confirm `Set-Cookie: …Expires=1970` on the 307.

## Client renewal (OWNER-ONLY `context/authContext.tsx`, S1b)

Three layers keep the cookie fresh; the throttleable interval alone is not
enough (Chrome throttles background timers to ~1/hr, sleep suspends them):

- **`onIdTokenChanged`** (keyed `[isClient]`) re-stamps on Firebase's own hourly
  rotation. Call `setToken` **only** — never `setUser` (that would re-run the
  auth effects). **Skip the null fire** or it resurrects the cookie `removeToken`
  just cleared on sign-out.
- **Wake handler** (keyed `[user]`): `document.addEventListener('visibilitychange')`
  (guarded by `document.visibilityState === 'visible'`) + `window.addEventListener('focus')`
  — **correct targets matter** (visibilitychange is a `document` event, focus a
  `window` event). Guard `if (!user) return` before attaching; debounce the
  double-fire; only force-refresh when the token is within ~10 min of expiry;
  wrap in try/catch (offline wake rejects with `auth/network-request-failed`).
- **60s interval** stays as a floor. `onAuthStateChanged` handles sign-in/out +
  `setToken` + the post-login redirect.

## The unmatched `/course/*` route (S1 item 5)

`/course/[courseId]` is not matched, so its **server render happens before any
client JS** — S1b cannot un-render a stale page. The page itself must repair: a
**present-but-invalid** token (expired during sleep) redirects to
`/api/refresh-token` (refresh cookie present) or `/login`, and **never renders
the logged-out buy UI to a paying student**. Anonymous visitors (no token) still
get the public preview via the `!token` branch above it. See
`app/course/[courseId]/page.tsx`.

## Next.js App-Router gotchas (each is a confirmed bug this codebase hit)

- **`redirect()` throws `NEXT_REDIRECT`.** It must be **outside** any catch-all
  `try/catch`, or the catch swallows it and renders the fallback instead. The
  edit page had exactly this bug. Verify tokens *inside* the try but call
  `redirect()` *after* it (`let verified; try { … } catch { verified = null } if
  (!verified) redirect(...)`).
- **Cookies on a redirect: use `response.cookies`, not the ambient store.**
  Build one `NextResponse.redirect(url)` and call `res.cookies.set()/delete()` on
  it — this reliably attaches `Set-Cookie` to the 307. The ambient
  `cookies().set()` on a success redirect works today, but delete-on-failure was
  never exercised until S1; `response.cookies` removes the doubt.
- **Middleware sets RESPONSE headers, not REQUEST headers.** `x-user-id` /
  `x-user-email` / `x-user-admin` are written to `NextResponse.next()`'s
  response, so `headers().get('x-user-id')` in a Server Component/Action reads
  the **incoming** request header — which a client can spoof. **This is an OPEN
  finding (NEW-1 in the audit): `delete-account` trusts `x-user-id` for a
  destructive delete.** Derive identity for authorization from the **verified
  cookie**, never the header.
- **`params` is a `Promise` in Next 15** — `await params`. The
  `params: { courseId: string }` annotation on these pages produces a known
  stale `.next/types` `PageProps` error; it is pre-existing and unrelated —
  note and ignore.

## Still open (do not assume fixed)

- **S2 — Mux token expiry in the main player.** Playback TTL is 7200s (2h). The
  study-deck hook `hooks/useMuxPlaybackToken.ts` proactively re-mints 5 min
  before expiry; the **main player `components/player/VideoStage.tsx` does not**
  (mints once, no expiry tracking, no `onError`), so a lesson idle >2h dies
  unrecoverably. Not yet fixed.
- **NEW-1 — the `x-user-id` header spoof** (above).

## OWNER-ONLY

`middleware.ts` and `context/authContext.tsx` are edit-protected
(`docs/MANUAL_CLEANUP_DO_NOT_AUTOMATE.md`) — changing them needs explicit owner
sign-off, and auth is the change class where "builds clean" and "real users can
log in" differ most: exercise a real sign-in on the deployed URL, not just
localhost (the `secure` cookie flag only flips on in prod). `context/actions.ts`
and `app/api/refresh-token/route.ts` are not owner-protected.
