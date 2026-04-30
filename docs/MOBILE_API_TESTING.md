# Mobile API Testing Guide

Quick recipes for hitting the new `/api/*` mobile endpoints with `curl`.

## 1. Get a Firebase ID token for a test user

The app uses Firebase Auth (email/password). To get an ID token outside the
app, hit the Identity Toolkit REST API directly with the project's **web API
key**.

The web API key is not secret — it's already in `firebase/client.ts`
(`AIzaSyCmjn2Enchkf-BH3-dBuBfCJPKPDnqfeT8`) and is restricted server-side via
Firebase Auth itself. For convenience, set it once in your shell:

```bash
export FIREBASE_WEB_API_KEY="AIzaSyCmjn2Enchkf-BH3-dBuBfCJPKPDnqfeT8"
export TEST_EMAIL="you@example.com"
export TEST_PASSWORD="your-test-password"
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

ID tokens expire after **1 hour**. Re-run the sign-in command to get a fresh
one.

If the test account doesn't exist yet, register it through the web app's
`/register` page first, or use the `accounts:signUp` REST endpoint.

## 2. Smoke-test `/api/_health/me`

`/api/_health/me` is a temporary debug endpoint added in Step 1 of the mobile
API migration. It returns the verified caller's identity. **It will be removed
before production.**

Assumes the dev server is running locally:

```bash
export BASE_URL="http://localhost:3000"
```

### a) No `Authorization` header → 401 `NO_TOKEN`

```bash
curl -i "$BASE_URL/api/_health/me"
```

Expected:

```
HTTP/1.1 401 Unauthorized
Content-Type: application/json
{"success":false,"error":{"code":"NO_TOKEN","message":"Missing Authorization header"}}
```

### b) Garbage token → 401 `INVALID_TOKEN`

```bash
curl -i -H "Authorization: Bearer garbage" "$BASE_URL/api/_health/me"
```

Expected:

```
HTTP/1.1 401 Unauthorized
Content-Type: application/json
{"success":false,"error":{"code":"INVALID_TOKEN","message":"Invalid ID token"}}
```

### c) Real token → 200

```bash
curl -i -H "Authorization: Bearer $ID_TOKEN" "$BASE_URL/api/_health/me"
```

Expected:

```
HTTP/1.1 200 OK
Content-Type: application/json
{"success":true,"data":{"userId":"...","email":"you@example.com","isAdmin":false}}
```

If the account has the `admin` custom claim set in Firebase Auth, `isAdmin`
will be `true`.

## Notes

- `/api/_health/me` exists only as a smoke test for the auth helper. Remove it
  once Step 2 (read-only endpoints) is verified.
- All `/api/*` failures return JSON with the shape
  `{ success: false, error: { code, message } }`. They do **not** redirect.
  Confirm by passing `-i --max-redirs 0` to `curl`.
- Token revocation is checked on every request (`verifyIdToken(..., true)`),
  so signing out a user via `adminAuth.revokeRefreshTokens(uid)` invalidates
  any in-flight ID tokens within ~5 seconds.
