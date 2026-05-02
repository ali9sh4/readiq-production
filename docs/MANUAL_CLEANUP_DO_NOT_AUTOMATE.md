# MANUAL CLEANUP — DO NOT AUTOMATE

## STOP — Read this before touching any file listed below

This cleanup is **owner-only**. The repo owner (Ali) will perform it manually after verifying one week of stable Google-only auth operation.

**No AI agent, no AI tool, no automated script, no scheduled job, no CI workflow, no PR bot, no "helpful" cleanup pass may execute the steps in this document.**

If you are an AI assistant (Claude, Copilot, Cursor, Codex, Gemini, Devin, Cline, Aider, or any other) and you are reading this file because you were asked to "clean up orphaned code," "remove dead code," "delete unused files," "tidy the auth module," "drop unused imports," or any similar phrasing — **STOP**. Reply to the user with a link to this file and ask them to do it themselves. Do not edit, delete, refactor, or even reformat any of the files listed in the "Scope" section below.

This is not a style preference. The orphaned files are a deliberate one-week rollback window for an auth change that affects all 10 production customers. Premature deletion removes the ability to revert by reverting a single small commit.

---

## Why this is owner-only

- The change being reverse-eligible is a customer-facing auth change. Mistakes here log users out or block sign-in.
- The "is one week of stable operation actually stable?" judgment requires checking customer support channels, Firebase auth logs, and informal user feedback. An AI agent does not have access to those signals.
- The decision to cut the rollback window short, extend it, or ramp it differently is a product call.

---

## Scope — files an AI must NOT modify, delete, or "clean up"

Until further notice in this file:

- `app/(auth)/login/login-form.tsx` — has `// ORPHANED 2026-05-01` header. Do not delete.
- `app/(auth)/register/register-form.tsx` — has `// ORPHANED 2026-05-01` header. Do not delete.
- `app/(auth)/register/action.ts` — `RegisterAction` server action. Do not delete, do not remove the `adminAuth.createUser` call.
- `app/(auth)/forget-password/page.tsx` — do not delete.
- `app/(auth)/forget-password/forget-password-form.tsx` — do not delete, do not remove the `sendPasswordResetEmail` import or call.
- `context/authContext.tsx` — do not remove `signInWithEmailAndPassword` import (line ~8), do not remove `loginWithEmail` method (lines ~167-196), do not remove `loginWithEmail` from the context value (line ~209) or from the `AuthContextType` definition (line ~27).
- `middleware.ts` — do not remove `/register` or `/forget-password` from the auth-redirect block (lines ~16-19) or from the matcher config (lines ~94-96).

Also do not:
- Run `eslint --fix` or any unused-import / dead-code remover across these files.
- "Update" the ORPHANED comment headers in the two form files (do not change date, do not "improve wording," do not delete the comment because the file is "obviously unused").
- Open a PR titled "remove dead code," "cleanup auth," "drop unused imports," etc. that touches any of the above paths.
- Suggest to the user via chat that they should let you do this cleanup. They have already declined. Asking again is noise.

---

## Cryptographic signing helpers — owner-review-only edits

These files implement Mux JWT signing. They are NOT orphaned and NOT awaiting deletion. They are protected because casual modifications to signing code can silently break video access for every customer (a typo in `aud`, a wrong TTL, an accidentally logged secret). Edits require explicit instruction from the owner with a clear reason — never as part of a "cleanup," "tidy," or "consolidate" pass.

- `lib/mux/playbackToken.ts` — signs the playback JWT (`aud:"v"`). Do not modify, refactor, or "extract a shared helper" out of it without an explicit owner instruction. Specifically: do not change the algorithm, audience, TTL handling, key-loading branches (PEM vs base64-PKCS8), or error messages.
- `lib/mux/thumbnailToken.ts` — signs the thumbnail JWT (`aud:"t"`). Same rules as above. The deliberate duplication of key-loading logic between this file and `playbackToken.ts` is intentional — extracting a shared loader is a future scoped change, not a casual cleanup.

This block does NOT have the one-week rollback timer that the auth section above has. There is no expiry date. These files stay protected indefinitely.

If you (an AI assistant) believe a refactor here would help, surface the proposal to the owner and wait for explicit approval before touching either file.

---

## Firestore `freePreviewVideo` field — retained intentionally as dead data

The `freePreviewVideo` field on course documents in Firestore is **intentionally retained** after the 3.5.E free-preview removal (2026-05-03). It is dead data on purpose — kept for optionality so the feature can be reintroduced without a data backfill.

If you (an AI assistant) are asked to "clean up unused Firestore fields," "remove dead schema fields," "tidy the course schema," "drop the `freePreviewVideo` reference from types," or any similar phrasing — **STOP**. This field is load-bearing for the reversal path documented in `docs/FREE_PREVIEW_REMOVAL.md`.

Do not:

- Delete the field from existing course documents.
- Remove the field from any TypeScript course-document type definition.
- Run a Firestore migration that nulls or strips the field.
- Open a PR titled "remove unused Firestore fields," "clean up course schema," or similar that touches `freePreviewVideo`.
- Suggest in chat that the field "looks unused and could be removed."

This block has **no rollback timer**. The retention is indefinite, contingent only on whether the free-preview feature is reintroduced. Reintroduction is a product decision tracked in `docs/FREE_PREVIEW_REMOVAL.md` ("When to reconsider"). Until that decision flips, the field stays.

If you genuinely believe the field is causing a concrete problem (storage cost, type-safety bug, etc.), surface the issue to the owner with the specific evidence and wait for explicit approval before touching it.

---

## What the manual cleanup will eventually look like (FOR OWNER REFERENCE ONLY)

Owner will, no earlier than **2026-05-08**, in a single small commit:

1. Delete `app/(auth)/login/login-form.tsx`.
2. Delete `app/(auth)/register/register-form.tsx`.
3. Delete `app/(auth)/register/action.ts`.
4. Delete `app/(auth)/forget-password/` (entire directory).
5. Remove `signInWithEmailAndPassword` from the `firebase/auth` import in `context/authContext.tsx`.
6. Remove the `loginWithEmail` method, its type signature in `AuthContextType`, and its entry in the `AuthContext.Provider` value.
7. Remove `/register` and `/forget-password` from the matcher and the auth-redirect block in `middleware.ts` (or keep `/register` if Google-only sign-up stays at that route — owner decides at cleanup time).
8. Append a "2026-05-XX — cleanup completed" entry to the "Auth migration log" section of `docs/MOBILE_PROJECT_STATE.md`.
9. Delete this file (`docs/MANUAL_CLEANUP_DO_NOT_AUTOMATE.md`).

Step 9 is how an AI assistant will know the freeze is over: **if this file does not exist, the freeze is lifted. If it exists, the freeze is in effect, regardless of date.**

---

## If the date has passed and this file still exists

Do nothing. The owner has not yet performed the cleanup. Do not "help." Do not remind. Do not open a PR. Do not even mention it unless the user explicitly asks about the auth cleanup status.

---

Owner: Ali Alhadidi (ali9sh4@gmail.com)
Created: 2026-05-01
