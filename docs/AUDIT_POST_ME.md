# AUDIT — `POST /api/me` (mobile profile bootstrap)

Scratch audit for the new `POST /api/me` endpoint. Read-only; no production code touched.
File paths reference the repo root (`/home/ali-alhadidi/readiq-production`).

---

## 1. Existing `/api/me` handler — `app/api/me/route.ts`

Single file, two handlers (`GET`, `PATCH`). The new `POST` must be added in this file
and mirror the existing patterns exactly.

### Imports — copy verbatim (drop `patchMeBody` if you don't need a body schema)

```ts
import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/firebase/service";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { fail, handleApiError, ok } from "@/lib/api/response";
```

### Handler shape (`app/api/me/route.ts:8-32`, GET)

```ts
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);

    const snap = await db.collection("users").doc(auth.userId).get();
    if (!snap.exists) {
      return fail("PROFILE_NOT_FOUND", "User profile does not exist", 404);
    }

    const data = snap.data()!;

    return ok({
      userId: auth.userId,
      email: data.email ?? auth.email,
      displayName: data.displayName ?? null,
      photoURL: data.photoURL ?? null,
      language: data.language ?? "ar",
      notifications: data.notifications ?? true,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
```

Things to mirror exactly:
- `try { … } catch (err) { return handleApiError(err); }` envelope around the whole handler.
- `db.collection("users").doc(auth.userId)` — admin SDK style, NOT `setDoc(doc(...))`.
- The `ok({ ... })` projection with **the same eight fields in the same order** (`userId`, `email`, `displayName`, `photoURL`, `language`, `notifications`, `createdAt`, `updatedAt`). The PATCH handler at `app/api/me/route.ts:53-62` re-uses the identical projection — POST should too.
- Timestamp serialization: `data.createdAt?.toDate?.()?.toISOString?.() ?? null`. **This chain only resolves on a Firestore `Timestamp`.** ISO strings have no `.toDate` and silently become `null` here. See §6.
- `email` falls back to `auth.email` when the doc field is missing.

### TypeScript types

There is **no shared `ProfileData` interface**. Both GET and PATCH inline the literal shape inside `ok({...})`. Don't invent a new exported type unless you also refactor GET/PATCH — keep parity.

`patchMeBody` (`lib/validation/api/me.ts`) is the only Zod schema in this file. POST takes an empty body, so no schema is needed; if you add one (even an empty `z.object({})`), follow the same `lib/validation/api/me.ts` location.

---

## 2. The "existing /register flow" — **does NOT write `users/{uid}`**

Surprise gotcha. The plan in `docs/MOBILE_API_MIGRATION.md` and the comment in
`docs/MOBILE_API_TESTING.md:173` ("the web register flow is what creates users/{uid}")
is **inaccurate**. The actual writer is `createOrUpdateUser` in `lib/services/userService.ts`,
called from `context/authContext.tsx:81` on every `auth.onAuthStateChanged`.

### What `app/(auth)/register/action.ts` actually does

```ts
// app/(auth)/register/action.ts:21-30
const userRecord = await adminAuth.createUser({
  displayName: data.name,
  email: data.email,
  password: data.password,
});

return { success: true, uid: userRecord.uid };
```

Just creates a Firebase **Auth** record. Never touches Firestore. After registration
the user is redirected to login, signs in, and `authContext` fires
`createOrUpdateUser(currentUser)` — which is the actual Firestore writer.

### `lib/services/userService.ts:36-69` — the real writer (client SDK, not admin)

```ts
export async function createOrUpdateUser(user: User): Promise<void> {
  const userRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || null,
      createdCourses: [],
      enrolledCourses: [],
      walletBalance: 0,
      coursesCompleted: 0,
      language: "ar",
      notifications: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    // Existing user — only refresh auth-derived fields
    await updateDoc(userRef, {
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || null,
      updatedAt: serverTimestamp(),
    });
  }
}
```

### Field-by-field shape the new POST must produce

| Field | Type | Default for new doc | Notes |
|---|---|---|---|
| `uid` | string | `auth.userId` | Yes, the doc carries `uid` even though it's also the doc id. Keep it. |
| `email` | string | `auth.email \|\| ""` | Empty string, not `null`. |
| `displayName` | string | `name claim \|\| userRecord.displayName \|\| ""` | Empty string fallback, **not** `null`. |
| `photoURL` | string \| null | `picture claim \|\| userRecord.photoURL \|\| null` | `null` fallback (different from displayName). |
| `createdCourses` | string[] | `[]` | |
| `enrolledCourses` | string[] | `[]` | |
| `walletBalance` | number | `0` | Note: actual wallet balance lives in `wallets/{uid}`. This field on the user doc is a stale legacy field — but `userService.UserProfile` requires it and downstream code may read it. Write `0` for parity. |
| `coursesCompleted` | number | `0` | |
| `language` | `"ar" \| "en"` | `"ar"` | Matches PATCH validator (`lib/validation/api/me.ts`). |
| `notifications` | boolean | `true` | |
| `createdAt` | Firestore Timestamp | `FieldValue.serverTimestamp()` | **Critical, see §6.** |
| `updatedAt` | Firestore Timestamp | `FieldValue.serverTimestamp()` | **Critical, see §6.** |

Fields NOT initialized by `createOrUpdateUser` (optional in the type — leave them off):
`bio`, `website`, `totalStudents`, `averageRating`.

No uniqueness checks, no welcome email, no analytics, no other side effects.

### TypeScript shape on disk (`lib/services/userService.ts:13-30`)

```ts
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  bio?: string;
  website?: string;
  createdCourses: string[];
  enrolledCourses: string[];
  walletBalance: number;
  coursesCompleted: number;
  totalStudents?: number;
  averageRating?: number;
  language: "ar" | "en";
  notifications: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

The 8-field GET/PATCH projection is a **strict subset** of this shape. The new POST
must write the full superset (so subsequent web reads via `getUserProfile` or the
user-dashboard counters keep working) but return the same 8-field projection.

### Other readers/writers of `users/{uid}` (for blast-radius awareness)

```
lib/services/userService.ts            — client SDK, createOrUpdateUser / getUserProfile / updateUserProfile
context/authContext.tsx:81             — invokes createOrUpdateUser on auth state change
app/api/me/route.ts:12,39              — admin SDK GET/PATCH (existing)
app/user_dashboard/actions.ts:166-169  — admin SDK update of photoURL only
```

That's the full list. No analytics hook, no webhook, no other writer.

---

## 3. `lib/auth/verifyBearerToken.ts`

```ts
export interface VerifiedAuth {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  token: string;
}

// inside verifyBearerToken:
const decoded = await adminAuth.verifyIdToken(token, true);  // checkRevoked=true
return {
  userId: decoded.uid,
  email: decoded.email ?? null,
  isAdmin: decoded.admin === true,
  token,
};
```

Only `userId`, `email`, `isAdmin`, `token` are surfaced. **`name` and `picture`
claims are NOT exposed**, even though Firebase Auth populates them on the
`DecodedIdToken` for OAuth providers (Google).

### Two ways to get `displayName` / `photoURL` for a fresh Google sign-in

**(a) Reuse the existing `adminAuth.getUser(uid)` precedent.** This is the pattern
used by the wallet auto-provision (`app/api/wallet/route.ts:17`):

```ts
// app/api/wallet/route.ts:17-20
const userRecord = await adminAuth.getUser(auth.userId);
const initial = {
  ...
  userName: userRecord.displayName ?? "مستخدم",
  ...
};
```

`UserRecord` exposes `uid`, `email`, `displayName`, `photoURL`, `emailVerified`,
`disabled`, `metadata.creationTime`, `providerData[]`. This is the cleanest path —
identical pattern, no new auth helper changes.

**(b) Extend `verifyBearerToken` to surface `decoded.name` and `decoded.picture`.**
Cleaner long-term, but it's a cross-cutting change to a shared file. Do not do this
for the POST /api/me PR alone — that's scope creep.

**Recommendation:** use (a). Adds one Firebase round-trip to a once-per-user code path.

The POST request body is empty; everything you need (`uid`, `email`) comes from
`verifyBearerToken`, and `displayName` / `photoURL` from `adminAuth.getUser(uid)`.

---

## 4. `lib/api/response.ts` — the envelope helpers

Three helpers, all NextResponse-based:

```ts
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ success: true as const, data }, init);
}

export function fail(code: string, message: string, status: number): NextResponse {
  return NextResponse.json(
    { success: false as const, error: { code, message } },
    { status }
  );
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof AuthError)  return fail(err.code, err.message, 401);
  if (err instanceof ZodError)   return /* 400 VALIDATION_ERROR with fields[] */;
  console.error("[api] unhandled error:", err);
  return fail("INTERNAL_ERROR", "Something went wrong", 500);
}
```

### Status-code convention for POST: **200, not 201**

There is no convention for 201 in this codebase. Every existing POST returns
200 via bare `return ok(...)`:

- `POST /api/me/favorites` (`app/api/me/favorites/route.ts:104`) → `return ok({ courseId, addedAt })` → HTTP 200
- `POST /api/enrollments` (`app/api/enrollments/route.ts:122,254`) → `return ok({...})` → HTTP 200
- `POST /api/wallet/topup/upload-receipt`, `POST /api/wallet/topup/request` → 200
- `POST /api/mux/playback-token` → 200

The user's spec says "200 if exists, 201 if created". **That's not the house style.**
Either:
- Stick to 200 for both (idempotent — "here's your profile", caller doesn't care
  whether you created it). This matches every other POST in the repo.
- Or, if 201-on-create is non-negotiable, pass `{ status: 201 }` as the second
  arg to `ok()`: `return ok(data, { status: 201 })`. The `ok()` helper supports it
  but no current handler uses it.

Recommend: **stick with 200 to match the rest of the surface.** Mobile can branch
on whether the doc was new from the response shape if it ever needs to (e.g. an
optional `created: boolean` field on the response — but that's a deviation from
the shared 8-field projection, so probably not worth it).

---

## 5. Error code conventions

Full inventory across `app/api/**/*.ts` (grepped):

| Origin | Code | Status |
|---|---|---|
| `AuthError` (`lib/auth/verifyBearerToken.ts`) | `NO_TOKEN` | 401 |
| `AuthError` | `INVALID_TOKEN` | 401 |
| `AuthError` | `EXPIRED_TOKEN` | 401 |
| `AuthError` | `REVOKED_TOKEN` | 401 |
| `handleApiError` ZodError branch | `VALIDATION_ERROR` | 400 |
| `handleApiError` fallback | `INTERNAL_ERROR` | 500 |
| `app/api/me/route.ts` | `PROFILE_NOT_FOUND` | 404 |
| `app/api/courses/**`, others | `COURSE_NOT_FOUND` | 404 |
| `app/api/mux/playback-token` | `VIDEO_NOT_FOUND` | 404 |
| `app/api/mux/playback-token` | `VIDEO_NOT_READY` | 409 |
| `app/api/mux/playback-token` | `NOT_ENROLLED` | 403 |
| `app/api/wallet/**`, `enrollments` | `WALLET_NOT_FOUND` | 404 |
| `app/api/enrollments` | `ALREADY_ENROLLED` | 409 |
| `app/api/enrollments` | `INSUFFICIENT_BALANCE` | 402 |
| `app/api/enrollments` | `CANNOT_BUY_OWN_COURSE` | 403 |
| `app/api/enrollments` | `IDEMPOTENCY_CONFLICT` | 409 |
| `app/api/wallet/topup/request` | `RECEIPT_NOT_UPLOADED` | 400 |
| `app/api/wallet/topup/request` | `DAILY_LIMIT_EXCEEDED` | 400 |

### `PROFILE_ALREADY_EXISTS`?

**Not a thing.** The repo's idempotency convention is "return 200 with the result"
not "409". Examples:

- `POST /api/me/favorites` re-add: returns 200 (no error) — `MOBILE_API_TESTING.md:617`.
- `DELETE /api/me/favorites/:id` for non-favorited: returns 200 — `MOBILE_API_TESTING.md:657`.
- `POST /api/enrollments` for `ALREADY_ENROLLED` returns 409 with `details`, but only
  because re-enrolling would re-charge. Profile-already-exists has no such risk.

For POST /api/me, **do NOT introduce `PROFILE_ALREADY_EXISTS`.** Read-then-set,
returning the existing/created doc with 200, matches the rest of the codebase.

### What to use if creation actually fails

Just throw and let `handleApiError` map it to 500 `INTERNAL_ERROR`. That's what
every other write handler does. No new error code needed.

---

## 6. Firestore write patterns

### Admin SDK, not client SDK

Every `app/api/**` handler uses the admin SDK style:

```ts
// app/api/wallet/route.ts:10,28
const walletRef = db.collection("wallets").doc(auth.userId);
await walletRef.set(initial);
```

**Never** `setDoc(doc(db, ...))` — that's only used in client-side
`lib/services/userService.ts`. The admin SDK and client SDK can both write to
the same docs, but mixing styles in API handlers is wrong.

### `merge: true`

Not used in any `app/api/**/*.ts` route handler. Grepped `app/api`:

```
$ grep -rn "merge:" app/api lib/api lib/auth
(no matches)
```

For a `users/{uid}` create-if-missing, the established pattern is read → check →
set unconditionally. See `app/api/wallet/route.ts:11-29`:

```ts
const snap = await walletRef.get();
if (!snap.exists) {
  const initial = { ... };
  await walletRef.set(initial);
  return ok(initial);
}
const data = snap.data()!;
return ok({ ... });
```

Mirror that exact pattern. If both branches return the same projection (which
they should, for shape parity), the duplication is fine.

### try/catch wrapping

Every handler wraps the entire body in `try { … } catch (err) { return handleApiError(err); }`.
Do the same. `handleApiError` deals with `AuthError` and `ZodError` automatically
and otherwise logs + returns 500.

### Timestamp convention — **mixed, choose carefully**

There are **two coexisting patterns** in the codebase, and POST /api/me must pick
the one that's compatible with how GET /api/me reads:

**Pattern A — Firestore `serverTimestamp()` (Timestamp on disk):**
- `lib/services/userService.ts:56-57` (web's actual writer) — `createdAt: serverTimestamp(), updatedAt: serverTimestamp()`
- `app/api/me/route.ts:47` (PATCH) — `updatedAt: FieldValue.serverTimestamp()`

**Pattern B — `new Date().toISOString()` (string on disk):**
- `app/api/wallet/route.ts:25-26` (auto-provisioned wallet)
- `app/api/wallet/topup/request/route.ts:84-85`
- `app/api/me/favorites/route.ts:106` (response only)
- `app/api/payments/zaincash/**`
- `app/user_dashboard/actions.ts:168` (photoURL update on user doc — **already inconsistent**)

GET /api/me reads with `data.createdAt?.toDate?.()?.toISOString?.() ?? null`. That
chain works on a Firestore Timestamp (the `.toDate()` method exists). On an ISO
string, `.toDate` is undefined and the optional chain returns `undefined`, falling
through to `null`.

**Implication:** existing web-created docs (Pattern A) return real ISO timestamps
in GET responses. If POST /api/me writes Pattern B, mobile-created docs will return
`createdAt: null, updatedAt: null` to GET /api/me — divergent behavior between
web-registered and mobile-registered users.

→ **Use `FieldValue.serverTimestamp()` from `firebase-admin/firestore`** (Pattern A,
import already present at `app/api/me/route.ts:2`).

---

## 7. Tests

There are **no tests in the repo.**

```
$ find . -name "*.test.ts" -o -name "*.spec.ts" -not -path "*/node_modules/*"
(no matches)
$ cat package.json | jq '.scripts'
{
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit"
}
```

No test framework, no test script. CLAUDE.md confirms: *"No test or typecheck
script exists. There is no CI test suite — verify changes manually."* (The
`typecheck` script is actually present — CLAUDE.md is slightly out of date — but
there are still no tests.)

**No parallel test file is needed.** Manual verification path is curl recipes in
`docs/MOBILE_API_TESTING.md`. Add an entry there (see §8).

---

## 8. `docs/MOBILE_API_TESTING.md` format

Each endpoint gets its own subsection with:

1. A short description (1–2 sentences) of what it does and what it reads/writes.
2. Body shape (when applicable), as inline prose: *"Body shape: `{ courseId: string (non-empty) }`."*
3. Optional bounds-and-rules table for complex endpoints.
4. A series of `bash` blocks, one per failure mode, each preceded by a short
   header (`### a) Happy path → 200`, `### b) ...`, etc.) OR inlined comments above the curl when shorter.
5. For complex endpoints: a closing "Quick failure-mode reference" markdown table
   mapping case → status → `error.code`.

Concrete example of the lighter format (good fit for POST /api/me):
`docs/MOBILE_API_TESTING.md:556-596` — the existing PATCH /api/me section.

Add the new section under "Step 4 — small write endpoints", **before** PATCH /api/me
(since it's the bootstrap that has to run first), or alongside it. Recipes the new
section needs:

- Happy path (no doc → 200/201, returns the created profile)
- Idempotent re-call (doc exists → 200, returns same profile, doc unchanged)
- Auth failure (no header → 401 NO_TOKEN)
- Round-trip with GET (POST → GET returns identical projection)

Cross-link from the GET /api/me section, which currently says "404 PROFILE_NOT_FOUND
→ user authed but never went through web registration" (`MOBILE_API_TESTING.md:174-176`).
That note is now outdated — mobile callers can just POST /api/me to fix the 404.

The `MOBILE_PROJECT_STATE.md` board may also need an entry; not audited in detail.

---

## 9. Other things to know

### 9a. The migration plan does not mention POST /api/me

`docs/MOBILE_API_MIGRATION.md` line 43 says GET /api/me "Reads `users/{uid}` doc"
and assumes the doc exists. The plan was written assuming web /register was the
sole writer; since that's not actually true (§2), no plan revision was triggered.
Adding POST /api/me is a net-new capability not on the original roadmap. Update
the migration doc when shipping.

### 9b. `verifyIdToken(..., true)` — checkRevoked round-trip

`lib/auth/verifyBearerToken.ts:57` passes `checkRevoked = true`, which forces a
Firebase Auth round-trip on every `/api/*` request. POST /api/me is exactly one
such request (per new mobile user, once in the user's lifetime), so the cost is
negligible. Just be aware: combining that with `adminAuth.getUser(uid)` for the
display fields adds a second round-trip. Acceptable for a one-shot bootstrap.

### 9c. Custom claims and `isAdmin`

`auth.isAdmin` is derivable from the ID token's `admin === true` custom claim.
**Do NOT trust client-supplied isAdmin values** (the mobile app can't set claims
itself anyway, but the principle holds). The user doc in Firestore does not have
an `admin` field — admin is purely a custom claim on Auth. No special handling
needed for POST /api/me.

### 9d. Free preview / wallet-balance fields on the user doc

`UserProfile.walletBalance` and `coursesCompleted` exist on the user doc but are
stale legacy fields. The authoritative source is `wallets/{uid}.balance` and the
`enrollments` collection. **Write `0` for both at create time** to match
`createOrUpdateUser`; do not try to "do better" by reading from `wallets/{uid}` —
that doc may not exist yet (mobile users typically have no wallet until first
`GET /api/wallet`).

### 9e. Race condition: two simultaneous POST /api/me

If two mobile clients POST /api/me at the same millisecond for the same uid, both
will see `snap.exists === false` and both will call `set()`. The second `set()`
overwrites the first — including `createdAt`. Mitigations:

- Use a Firestore transaction (`db.runTransaction`) for the read-then-write — clean
  but heavier.
- Use `set(data, { merge: true })` with `createdAt` only set if not present — but
  `merge: true` is not used anywhere else in the repo (§6).
- Accept the race — practical impact is a `createdAt` jitter of at most a few ms;
  no data corruption.

The wallet auto-provision (`app/api/wallet/route.ts:11-29`) accepts the race. **Do
the same for parity** unless the user has a stronger requirement.

### 9f. `checkRevoked` will reject a user who's been revoked between POST and GET

Edge case: mobile signs in, GET /api/me returns 404, admin nukes the auth account
in the millisecond between GET and POST. POST returns 401 `REVOKED_TOKEN`. Mobile
must already handle this (it can happen on any endpoint). No special handling needed.

### 9g. Build doesn't catch type errors

CLAUDE.md callout, worth repeating: `next.config.ts` has
`eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true`.
Run `npx tsc --noEmit` and `npm run lint` manually before declaring done.

### 9h. Inaccurate docstring in `MOBILE_API_TESTING.md:174-176`

> `# 404 PROFILE_NOT_FOUND → user authed but never went through web registration`
> `# (the web register flow is what creates users/{uid}). Reproduce by signing in`
> `# with a Firebase Auth user that has no Firestore doc.`

This is wrong — the web register flow does NOT create `users/{uid}`; the
`onAuthStateChanged` handler in `authContext` does. Worth updating that comment in
the same PR that ships POST /api/me, since the new endpoint is the answer to the
404 it documents.

---

## TL;DR — what the new POST handler must look like (sketch, not code to commit)

- File: `app/api/me/route.ts` — add a third export next to GET and PATCH.
- Imports: `NextRequest`, `FieldValue` from `firebase-admin/firestore`, `db`,
  `adminAuth` (new), `verifyBearerToken`, `handleApiError`, `ok`. (No `fail`, no
  Zod schema unless you want one for the empty body.)
- Body: empty. Don't parse JSON.
- Flow: `verifyBearerToken` → `db.collection("users").doc(uid).get()` →
  - If exists: project to the 8-field shape (identical to GET) → `ok(...)`.
  - Else: `adminAuth.getUser(uid)` → build the full 12-field doc (per §2 table)
    with `FieldValue.serverTimestamp()` for `createdAt`/`updatedAt` →
    `userRef.set(fullDoc)` → return the same 8-field projection → `ok(...)` (with
    server timestamps mirrored back as ISO via the `.toDate()` chain — this means
    you must re-`.get()` the doc to materialize the timestamps, OR construct the
    response body using `new Date().toISOString()` for the just-written timestamps;
    look at `app/api/me/route.ts:50-62` PATCH for the re-get pattern).
- Error handling: outer `try/catch` calling `handleApiError(err)`. No new error
  codes.
- Status: 200 (matches every other POST). If you really want 201-on-create, pass
  `{ status: 201 }` as second arg to `ok(...)`.

Pattern reference cheat-sheet:

| Concern | Reference file | Lines |
|---|---|---|
| Handler skeleton | `app/api/me/route.ts` (GET) | 8-32 |
| Re-get-after-write | `app/api/me/route.ts` (PATCH) | 39-62 |
| Read-then-create-if-missing | `app/api/wallet/route.ts` | 11-29 |
| `adminAuth.getUser` for displayName | `app/api/wallet/route.ts` | 17-20 |
| Full users-doc field set | `lib/services/userService.ts` | 45-58 |
