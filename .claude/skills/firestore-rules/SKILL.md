---
name: firestore-rules
description: >-
  Use before changing firestore.rules (or firebase.json / .firebaserc), and
  whenever adding a client-SDK read or write to a new Firestore collection or
  field (grep target: getDoc/getDocs/onSnapshot/setDoc/updateDoc/deleteDoc/addDoc
  against @/firebase/client). Rules changes are rare, high-blast-radius, and have
  a non-obvious failure mode (they can't see the server's email-admin fallback),
  so a wrong deploy silently breaks the admin dashboard or reopens a data-leak
  P0. Canonical: the firestore.rules header comments; diagnosis in
  docs/AUDIT_SYSTEM_HEALTH.md (exec #2 / H3); rollback snapshot at
  docs/firestore.rules.pre-hardening/.
---

# Firestore Security Rules

Rules are **versioned in the repo** (`firestore.rules` + `firebase.json` +
`.firebaserc`). Two things to internalize first:

- **Server code (`firebase-admin`) bypasses rules entirely.** Every rule governs
  the **browser client SDK** only. The purchase/access/money paths run through
  server actions and API routes with the admin SDK — they are unaffected by
  rules. Rules exist to stop the *client* from reading/writing what only the
  server should.
- **Admin in rules = the token claim `request.auth.token.admin == true`, and
  ONLY that.** Rules do **not** see the `FIREBASE_ADMIN_EMAIL` fallback that
  server code (`getCurrentUser`, `approveTopupRequest`) accepts. This is the
  single most dangerous gap.

## BLOCKING prerequisite: verify the admin token claim before deploying

The admin dashboard and top-up approvals use **client-SDK** `onSnapshot`
listeners on `courses` / `topup_requests`, allowed only via `isAdmin()`. If the
admin account's **token** lacks `admin: true`, those listeners go
`permission-denied` the moment new rules publish. Check first (one-off `tsx`
through `firebase/service.ts`, gitignored, never committed):

```js
const u = await adminAuth.getUserByEmail(process.env.FIREBASE_ADMIN_EMAIL);
console.log(u.uid, u.customClaims); // must show { admin: true }
```

The claim is set lazily in `context/actions.ts` on that email's sign-in and only
reaches the **token** on the *next* sign-in — so if it's missing, the fix is
sign-in → sign-out → sign-in, then re-check. Do not deploy until confirmed.

## The three pre-deploy gates

- **GATE 1 — does any client read ANOTHER user's doc?** Grep
  `getDoc/getDocs/onSnapshot` + `doc(db,/collection(db,`. Tightening `users` read
  to own-doc+admin breaks any client that reads e.g. `users/{instructorId}`.
  (Verified clean once: the only client user-doc reads are own-uid.)
- **GATE 2 — any client-SDK writes to a locked collection?** Grep
  `setDoc/addDoc/updateDoc/deleteDoc`. Every collection with `allow write: if
  false` (courses, enrollments, favorites, topup_requests, wallets,
  wallet_transactions, system_events) must have zero client writes — all go
  through server actions/API. (Verified once: the only client writes are the
  user's own `users/{uid}` doc.)
- **GATE 3 — reconcile the `users` update allowlist field-by-field.** The
  `updateTouchesOnlyProfileFields().hasOnly([...])` list must be a **union** of
  every field any client write touches — `hasOnly()` denies the *whole* write on
  the first unlisted key. Miss one (`marketingConsentAt`, `phonePromptDismissed`,
  `language`, `notifications`…) and every profile save 403s in production. Union,
  not narrow: the security boundary is money/authorization fields, not the
  profile surface — include non-money fields, exclude only money/counter fields.

## Field patterns

- **`users` create** pins money fields to their `buildNewUserDocFields` defaults
  (`walletBalance == 0`, `revenueSharePercent == 70`, `earningsTotal == 0`,
  `payoutsTotal == 0`, `enrolledCourses == []`, `createdCourses == []`). The
  browser writes this doc on sign-in; the create rule allows it only at those
  defaults so a client can't self-grant a wallet or a 100% revenue share.
- **`users` update** excludes every money/counter field (they become
  admin-SDK-only) — `revenueSharePercent` especially, since
  `lib/earnings/recordEarning.ts` trusts it to compute the sale split.
- Rules-language notes: `let d = request.resource.data; return …` is valid v2
  function form; `== []` is a correct empty-list check; overlapping `allow`
  statements OR together (can only grant); missing-key reads fail **closed**.

## Deploy & verify

1. **Snapshot the live console rules to `docs/firestore.rules.pre-hardening/`
   BEFORE deploying** — it's the one-paste rollback and worthless if taken after.
2. Deploy: `npx firebase deploy --only firestore:rules` (firebase-tools is
   available; needs `firebase login` once) **or** console paste. The repo file
   stays authoritative.
3. Smoke test in this order — sign-out→sign-in first (exercises create +
   update allowlist), admin dashboard second (where a missing claim surfaces),
   then profile save, wallet balance, playback, favorites.
4. **Exploit checks that must now FAIL** from the site's devtools console:
   `getDocs(collection(db,'users'))` → `permission-denied`; `updateDoc` on your
   own doc setting `revenueSharePercent: 100` → `permission-denied`.

Rollback is pasting the pre-hardening snapshot into the console — do that
immediately if sign-in or the admin dashboard breaks; don't leave broken rules
live while debugging.
