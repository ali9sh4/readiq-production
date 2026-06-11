# ZainCash — Production Debug Learnings

**Date:** 2026-05-31. **Scope:** the wallet top-up `init` call failing on live
while working on localhost. Sibling to `docs/archive/AUDIT_ZAINCASH.md`. Purpose: diagnose
this class of bug in minutes next time, not an hour.

> **Status caveat:** This documents the **init (send) half** only — proven green on
> live (real ZainCash transaction `id` returned, pay page loads). The **callback
> (receive) half** — crediting the wallet exactly once under a double-fired
> callback — is **still unverified on live**. That is batch C in
> `docs/ZAINCASH_TOPUP_TESTING.md` and is the real money-safety gate. Do not treat
> the top-up feature as shipped until C passes on prod.

---

## 1. Symptom

- **localhost: works. Live: fails** with the generic Arabic string `خطأ من زين كاش`.
- **The trap:** that string was **our own fallback**, not ZainCash's reply. The
  code caught ZainCash's real response, threw away the useful part, and re-threw a
  generic message — so the real cause was invisible until we logged the raw body.

## 2. Root cause

`ZAINCASH_SECRET_KEY` was stored **backslash-escaped** (`\$2y\$10\$...`) in both
`.env.local` and the Vercel env box. The HMAC was signed with the literal
backslashes included; ZainCash validates against the **unescaped** secret →
signature mismatch → ZainCash returns:

```json
{ "err": "token_not_valid_expired" }
```

The real bcrypt secret is **60 chars**; escaped it read **63**. The 3 extra chars
were the `\` escapes — **not whitespace**, so `.trim()` could never fix it. (We
chased a trailing-newline theory first; the length staying 63 *after* trim ruled
that out and pointed at embedded, non-whitespace characters.)

Note the misleading error name: `token_not_valid_expired` sounds like an `exp`
problem, but the `iat`/`exp` construction was correct (Unix seconds, +4h). For
ZainCash this string means **JWT validation failed**, which with a correct `exp`
means **signature mismatch → wrong secret value**.

## 3. The fix

- **`.env.local`** — use **single quotes** so the shell/dotenv does not expand `$`
  (single quotes are stripped by dotenv; the value stays 60 chars, unescaped):

  ```bash
  ZAINCASH_SECRET_KEY='$2y$10$...'
  ```

  Do **not** backslash-escape the `$`. Backslashes become part of the value.

- **Vercel env box** — does **no** shell expansion. Paste the **raw** secret:
  no quotes, no backslashes. After the fix the diagnostic showed `sec 60` and
  `init` returned a real `id`.

## 4. Diagnostic ladder (the reusable part — the order that cracked it)

1. **`merchant_not_found`** → `merchantId` wrong / missing / whitespace on that
   deploy scope. (We never hit this here — merchant resolved, which ruled out
   `merchantId` early.)
2. **`token_not_valid_expired`** → JWT failed validation → signature mismatch.
   Check **`iat`/`exp` first** (must be Unix **seconds**, not `Date.now()` ms),
   then the **secret value**. Here the code was correct, so it was the secret.
3. **When the app shows a generic error, log the RAW provider reply** (HTTP status
   + body) before any of your own fallback strings. The masked `err` names the
   cause. ZainCash's `err` is sometimes an object (`{ msg }`) and sometimes a bare
   string — handle both (the code now does; see `lib/payments/zaincash.ts`).
4. **Verify env values by LENGTH and char codes, never by pasting the value.**
   Useful char codes: `92`=`\` backslash, `34`=`"` doublequote, `39`=`'`
   singlequote, `36`=`$`. A bcrypt ZainCash secret **starts with `36` (`$`) and is
   60 chars**. A length of 63 = 3 stray chars; check whether they're `92`
   (escapes) or `34`/`39` (wrapping quotes).
5. **`localhost works / live fails` is almost always env scope or env-value
   corruption**, because dotenv and the Vercel env box parse values differently
   (shell expansion, quote stripping, escaping).

## 5. General rule for this repo

**Any secret containing `$` must be single-quoted in `.env` files and pasted raw
(unescaped, unquoted) in the Vercel env box.** This applies to ZainCash keys, Mux
keys (`MUX_SIGNING_PRIVATE_KEY`, `MUX_TOKEN_SECRET`), and any future `$`-containing
secret. Backslash-escaping a `$` for a `.env` value is always wrong — the
backslash becomes part of the value.

## 6. Cleanup confirmation

The temporary diagnostics (`ZC_DIAG`, `ZC_INIT_RAW`, `ZC_INIT_RAW(catch)`) and the
8s timeout probe added during this session **have been removed** from
`lib/payments/zaincash.ts`. Retained from the session as permanent, justified
hardening:

- `.trim()` on all four credential reads in the `ZainCash` constructor.
- `err`-as-string handling in `createTopupTransaction` (never re-mask the provider
  reply with the generic Arabic fallback).
