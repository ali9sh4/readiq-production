# Audit — Rubik AI Chat (read-only investigation)

**Date:** 2026-05-30
**Scope:** Pre-implementation audit of the `readiq-production` web repo for "Rubik AI" —
an in-app chatbot answering questions about course content, served by a single
server-side API route that **both web and the mobile app call** (LLM key never ships
to a client). First model: Claude Haiku 4.5 + prompt caching. Dental vertical first.

This document is **read-only findings**. No code was modified, no packages installed,
no builds run. The companion design doc is `docs/RUBIK_AI_CHAT.md`.

> **TL;DR for decision-makers:** The plumbing (API conventions, auth, rate limiting,
> env, mobile contract, access gating) is all in place and directly reusable. **The one
> hard blocker is content:** there is **no text representation of the actual course
> material** in Firestore today — no transcripts, captions, or lesson text. Only
> instructor-authored metadata (titles, descriptions, bullet points) exists. A grounded
> chatbot is **not buildable on real lesson content until a text layer is created**
> (transcription or hand-authored Q&A). See §3.

---

## 1. API route conventions

### Existing `/api/*` routes (20 handlers)

| Route | Methods | Auth |
|---|---|---|
| `app/api/courses/route.ts` | GET | Public |
| `app/api/courses/[courseId]/route.ts` | GET | Public |
| `app/api/enrollments/route.ts` | POST | Bearer |
| `app/api/health/me/route.ts` | GET | Bearer |
| `app/api/me/route.ts` | GET, POST, PATCH, DELETE | Bearer |
| `app/api/me/enrollments/route.ts` | GET | Bearer |
| `app/api/me/favorites/route.ts` | GET, POST | Bearer |
| `app/api/me/favorites/[courseId]/route.ts` | DELETE | Bearer |
| `app/api/mux/playback-token/route.ts` | POST | Bearer |
| `app/api/payments/zaincash/init/route.ts` | POST | Bearer |
| `app/api/payments/zaincash/topup/init/route.ts` | POST | Bearer |
| `app/api/payments/zaincash/topup/intent/route.ts` | POST | Bearer |
| `app/api/payments/zaincash/topup/callback/route.ts` | POST | Public (ZainCash callback) |
| `app/api/payments/zaincash/webhook/route.ts` | POST | Public (ZainCash) |
| `app/api/refresh-token/route.ts` | GET | Cookie (web-only) |
| `app/api/wallet/route.ts` | GET | Bearer |
| `app/api/wallet/topup/history/route.ts` | GET | Bearer |
| `app/api/wallet/topup/request/route.ts` | POST | Bearer |
| `app/api/wallet/topup/upload-receipt/route.ts` | POST | Bearer |
| `app/api/wallet/transactions/route.ts` | GET | Bearer |

### Standard response shape — `lib/api/response.ts`

All `/api/*` handlers use a uniform envelope. **Do not hand-roll JSON** (CLAUDE.md convention).

```ts
// lib/api/response.ts
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
  if (err instanceof AuthError) return fail(err.code, err.message, 401);
  if (err instanceof ZodError) {
    const fields = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return NextResponse.json(
      { success: false as const, error: { code: "VALIDATION_ERROR", message: "Invalid request", fields } },
      { status: 400 }
    );
  }
  console.error("[api] unhandled error:", err);
  return fail("INTERNAL_ERROR", "Something went wrong", 500);
}
```

**Success:** `{ "success": true, "data": <T> }`
**Failure:** `{ "success": false, "error": { "code": "<CODE>", "message": "..." } }`
**Validation failure (400):** adds `error.fields: [{ path, message }]`, code `VALIDATION_ERROR`.

### Error-code format

String constants (SCREAMING_SNAKE / CamelCase domain codes), not numbers. The HTTP status
is carried separately. Observed codes & statuses:

- `NO_TOKEN` / `INVALID_TOKEN` / `EXPIRED_TOKEN` / `REVOKED_TOKEN` → **401**
- `VALIDATION_ERROR` → **400**
- `COURSE_NOT_FOUND`, `VIDEO_NOT_FOUND`, `WALLET_NOT_FOUND` → **404**
- `COURSE_NOT_SECTIONAL` → **400** (enrollments route, sectional guard)
- `NOT_ENROLLED`, `SECTION_NOT_OWNED` → **403** (playback-token gate)
- `INSUFFICIENT_BALANCE` → **402**
- `ALREADY_ENROLLED`, `IDEMPOTENCY_CONFLICT` → **409**
- `RATE_LIMITED` → **429**
- `INTERNAL_ERROR` → **500**

### Canonical handler skeleton (how a new POST route should look)

Every authenticated route follows this exact shape (`app/api/wallet/topup/request/route.ts`,
`app/api/enrollments/route.ts`, `app/api/mux/playback-token/route.ts`):

```ts
import { NextRequest } from "next/server";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { ok, fail, handleApiError } from "@/lib/api/response";
import { someBody } from "@/lib/validation/api/<name>";

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);          // 401 on failure
    // (optional) rate-limit: await ratelimit.limit(auth.userId) → 429
    const body = someBody.parse(await req.json());      // 400 VALIDATION_ERROR on failure
    // ... business logic ...
    return ok({ /* data */ });
  } catch (err) {
    return handleApiError(err);
  }
}
```

**Shared serializers/helpers to reuse:** `ok` / `fail` / `handleApiError` (`lib/api/response.ts`);
zod schemas live under `lib/validation/api/*.ts`; a new chat route should add
`lib/validation/api/chat.ts`. Public routes simply omit the `verifyBearerToken` call
(see `app/api/courses/route.ts`).

---

## 2. Auth in API routes

### The helper — `lib/auth/verifyBearerToken.ts`

```ts
export interface VerifiedAuth {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  token: string;        // raw bearer, to delegate to legacy server actions
}

export async function verifyBearerToken(req: Request): Promise<VerifiedAuth> {
  const token = extractBearer(req);                 // reads "Authorization: Bearer <t>"
  try {
    const decoded = await adminAuth.verifyIdToken(token, true); // checkRevoked = true
    return {
      userId: decoded.uid,
      email: decoded.email ?? null,
      isAdmin: decoded.admin === true,              // ← admin custom claim
      token,
    };
  } catch (err) {
    // maps auth/id-token-expired → EXPIRED_TOKEN, auth/id-token-revoked → REVOKED_TOKEN,
    // else INVALID_TOKEN; all throw AuthError (status 401)
  }
}
```

- **Token transport:** `Authorization: Bearer <Firebase ID token>` header only. The header
  is parsed case-insensitively by `extractBearer`; missing/blank → `AuthError("NO_TOKEN")`.
- **Revocation check:** `verifyIdToken(token, true)` forces a Firebase round-trip so logged-out
  / disabled users can't reuse a still-valid token. (Relevant to LLM cost abuse — a revoked
  user is rejected before any model call.)
- **Admin claim:** `verifiedToken.admin === true` surfaces as `auth.isAdmin`. Used e.g. in
  `app/api/mux/playback-token/route.ts:64-67`: `const isAdmin = auth.isAdmin === true; const isPrivileged = isOwner || isAdmin;`
- **Calling pattern:** `const auth = await verifyBearerToken(req);` inside the `try`, then
  `handleApiError(err)` maps the thrown `AuthError` to a 401 envelope automatically.

### Cookies vs header — confirmed

`/api/*` is **intentionally NOT in the middleware matcher** (`middleware.ts`; CLAUDE.md).
No authenticated API route reads cookies — the only cookie-touching route is
`app/api/refresh-token/route.ts` (web-only, sets `firebaseAuthToken` / `firebaseAuthRefreshToken`).
Mobile sends the Bearer header; the new chat route must do the same and **must not** read cookies.

---

## 3. CONTENT — does grounded text exist? (most important)

### Course document shape — `types/types.ts`

```ts
// types.ts:63-120 (text-bearing fields highlighted)
export interface Course {
  id: string; title: string; category: string;
  subtitle?: string;          // short text
  description?: string;       // instructor-authored freeform (typically short)
  learningPoints?: string[];  // bullet strings ("what you'll learn")
  requirements?: string[];    // bullet strings (prerequisites)
  rejectionReason?: string | null;
  purchaseMode?: "full" | "sectional";
  fullCoursePrice?: number;
  sections?: CourseSection[];
  videos?: CourseVideo[];
  files?: CourseFile[];
  instructorName?: string;
  createdBy?: string;         // instructor UID
  // ... status/approval/deletion/metadata fields (no content text)
}
```

### Video array — `types/types.ts:26-41`

```ts
export interface CourseVideo {
  videoId: string;
  courseId: string;
  assetId: string;     // Mux asset id
  playbackId: string;  // Mux playback id
  duration?: number;
  title: string;       // ← text
  description?: string;// ← text (often empty; written as "" on upload)
  section?: string;    // ← legacy section name text
  sectionId?: string;  // FK to CourseSection
  order?: number; originalFilename?: string; isVisible?: boolean; isFreePreview?: boolean;
}
```

### Section shape — `types/types.ts:43-50`

```ts
export interface CourseSection {
  sectionId: string;
  title: string;   // ← the ONLY text field; no description
  order: number; price?: number; salePrice?: number; isLocked?: boolean;
}
```

`CourseFile` (`types.ts:52-61`) holds only metadata (`filename`, `originalName`, `size`,
`type`) — **not** file text content. The `files[]` array is R2 object metadata, not extracted text.

### Exhaustive search for groundable text — result

Searched the whole repo for `transcript`, `transcription`, `caption`, `subtitle`, `vtt`,
`srt`, `generated_subtitles`, `text_track`, `summary`. **None found** in application code,
types, Firestore writes, or the Mux integration.

- **Mux integration** (`lib/mux/mux.ts`, `lib/mux/playbackToken.ts`, `lib/mux/thumbnailToken.ts`):
  uses `video.uploads`, `video.assets.retrieve()` (status/duration only), `video.assets.delete()`.
  It **does not** call Mux's captions / text-tracks / auto-generated-subtitles APIs. Transcripts
  are never requested or stored.
- **Video upload write** (`app/actions/upload_video_actions.ts:242-266`): persists
  `videoId, assetId, playbackId, title, originalFilename, description: "", order, …` — no transcript field.
- **Basic-info writes** (`app/actions/basic_info_actions.ts`): `title`, `subtitle`,
  `description`, `learningPoints[]`, `requirements[]` only.

### Plain verdict

**Real text content of the course *material* does NOT exist in Firestore.** What exists is
**instructor-authored metadata**: course `title` / `subtitle` / `description`, `learningPoints[]`,
`requirements[]`, per-video `title` (+ usually-empty `description`), and `sections[].title`.
The actual lesson content lives **only as video in Mux** and has **never been transcribed**.

> **Update 2026-07-02:** a transcription pipeline now exists — `scripts/pipeline/`
> (faster-whisper large-v3 GPU/CPU + `claude-sonnet-5` Q&A generation, usage in the
> `run.mts` header). It writes transcripts + pending-review Q&A to the gitignored
> `output/` dir ONLY; Firestore still holds no transcript/Q&A text, so the in-app
> consequence below stands until a storage shape + instructor review ship.

**Consequence for the feature:** A chatbot grounded on *what the lessons teach* is **not
buildable on existing data**. A text layer must be created first. Two viable paths (detailed in
the design doc):

1. **Pre-authored Q&A** (per course/section) — buildable now, no transcription, fits the
   "~80% common case" plan and the dental-first scope. Recommended for v1.
2. **Transcription** of Mux videos (Mux auto-generated captions or an external STT) → store
   text on `videos[]` → feed into the model. Required for the long-tail "ask anything about the
   video" experience; a prerequisite project of its own.

Until one of these exists, a model can only be grounded on titles + descriptions + bullet points,
which is thin and will hallucinate on specifics. **This is the gating decision for the whole feature.**

---

## 4. Access gating

### Enrollment shape — `types/types.ts:129-149`

Stored at `enrollments/{userId}_{courseId}`.

```ts
export interface Enrollment {
  userId: string; courseId: string;
  status: "pending" | "completed" | "failed" | "refunded";
  accessScope?: "full" | "sectional";   // UNSET = grandfathered full access
  ownedSectionIds?: string[];           // meaningful only when accessScope === "sectional"
  totalSpent?: number;                  // sectional break-even math
  sourcePackageId?: string;             // traceability only
  // ...payment/timestamp fields
}
```

### The real gate — `app/api/mux/playback-token/route.ts` (the reference implementation)

Authoritative server-side access decision (lines ~98-209). A chat gate should mirror it:

```
if video.isFreePreview === true                 → GRANT (free preview)
if course.createdBy === userId OR auth.isAdmin   → GRANT (owner / admin bypass)
if no enrollment with status === "completed"     → DENY (NOT_ENROLLED)
if course.purchaseMode !== "sectional"           → GRANT (full-mode: enrollment is enough)
else (sectional):
  if accessScope is unset OR "full"              → GRANT (grandfathered / bundle buyer)
  if accessScope === "sectional":
    if video.sectionId unset                     → GRANT (untagged video, by spec)
    if video.sectionId ∈ ownedSectionIds[]       → GRANT
    else                                         → DENY (SECTION_NOT_OWNED)
```

Course ownership: `course.createdBy === auth.userId` (`playback-token/route.ts:65`).
Client mirror (UX only, non-authoritative): `lib/sectional/access.ts` `getLockReason()`.

### Sectional invariants (`.claude/skills/sectional-invariants/SKILL.md`) relevant to gating

1. `purchaseMode === "sectional"` is the **only** activator (presence of `sections[]` is not).
2. `accessScope` is the single source of truth for access.
3. **Unset `accessScope` = grandfathered full access** — never overwrite/migrate it.
4. Bundle buyer → `accessScope:"full"`; per-section buyer → `accessScope:"sectional"` + `ownedSectionIds[]`.
5. Server rejects a per-section purchase if `accessScope !== "sectional"` (`ALREADY_FULL_ACCESS`).
6. A sold section is immutable (lock at first sale/enrollment).
7. The Mux playback-token route is the real gate; client locks must mirror, not diverge.

### Open question (carried to design doc)

**Should chat be gated per-enrolled-course, or be a separate paid add-on?**

- **Per-course entitlement** (recommended default): reuse the exact gate above — a user can chat
  about a course they're entitled to; sectional users limited to their `ownedSectionIds`. Zero new
  billing surface; consistent with "chat is part of the learning experience."
- **Separate paid add-on:** new entitlement/SKU, new purchase + ledger surface, new gate. Heavier;
  also collides with the mobile **view-only / no in-app purchase** rule (§8) — a paid chat add-on
  could not be sold in the mobile app. Defer unless there's a clear monetization reason.

This needs a product decision before implementation. The design doc assumes **per-course
entitlement, mirroring the playback gate**, unless overridden.

---

## 5. Rate limiting (Upstash Redis)

Already in place and directly reusable. Pattern (`app/api/mux/playback-token/route.ts:21-55`,
also `app/actions/wallet_actions.ts`, `upload_video_actions.ts`, `upload_File_actions.ts`):

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),                       // reads UPSTASH_REDIS_REST_URL / _TOKEN
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
  prefix: "mux_playback_token",                 // namespacing prefix per use-case
});
// inside handler, after auth:
const { success } = await ratelimit.limit(auth.userId);   // keyed per-user
if (!success) return fail("RATE_LIMITED", "...", 429);
```

- **Algorithm:** sliding window. **Keyed per user** (`auth.userId`). Configurable per-endpoint via `prefix`.
- **Fail-open** is the established convention: the playback route wraps the `.limit()` call in
  its own try/catch and lets the request through on a Redis error (abuse mitigation, not a hard gate).
- **Reusable for the LLM endpoint? Yes** — add a dedicated limiter, e.g.
  `Ratelimit.slidingWindow(N, "1 h")` with `prefix: "rubik_chat"`, keyed on `auth.userId`.
  Because LLM calls cost money, consider a **stricter, fail-closed** policy here (deny on Redis
  error) rather than the playback route's fail-open — a deliberate divergence to call out in design.
- Deps already present: `@upstash/ratelimit ^2.0.6`, `@upstash/redis ^1.35.3`.

---

## 6. Secrets / env

- **Convention:** server-only secrets have **no** `NEXT_PUBLIC_` prefix and are read via
  `process.env.*` in server code only; client-exposed config uses `NEXT_PUBLIC_` (only
  `NEXT_PUBLIC_APP_URL` is exposed today). Values live in `.env.local` (gitignored).
  **No `.env.example`** exists — `CLAUDE.md` (env-vars section) is the source of truth for names.
- **Adding `ANTHROPIC_API_KEY`:**
  1. Add `ANTHROPIC_API_KEY=...` to `.env.local` locally (server-only, **never** `NEXT_PUBLIC_`).
  2. Add the same key to **Vercel → Project → Settings → Environment Variables** for Production
     (and Preview/Development as needed). It is read server-side only, so it is never bundled to
     the client.
  3. Read it in server code with a presence guard: `const k = process.env.ANTHROPIC_API_KEY; if (!k) throw …`.
  4. Document the new name in `CLAUDE.md` (env-vars section).
- **Cleanup finding (security):** `.env.local` currently contains an `OPENAI_API_KEY` that is
  **not referenced anywhere** in the codebase (no `openai` import; leftover from earlier
  exploration). Recommend **removing and rotating** it — an unused live key is needless exposure.
  *(Value intentionally not reproduced here.)*

---

## 7. Dependencies

`package.json` — **no AI/LLM SDK present**: `@anthropic-ai/sdk` ✗, `openai` ✗, `ai` (Vercel AI SDK) ✗,
`langchain` ✗. Relevant existing deps: `next ^15.5.7`, `react ^19`, `typescript ^5`, `zod ^3.25.63`,
`@upstash/ratelimit ^2.0.6`, `@upstash/redis ^1.35.3`, `firebase-admin ^13.2.0`, `axios ^1.13.1`,
`react-markdown ^10.1.0` + `remark-gfm ^4.0.1` (handy for rendering chat answers).

> **Update 2026-07-02:** `@anthropic-ai/sdk` is now installed (a dependency of
> `scripts/pipeline/run.mts`), so the "to add" step below is done.

**To add (do NOT install during audit):** `@anthropic-ai/sdk` (latest stable). Installs cleanly
alongside the current stack; supports prompt caching and Haiku 4.5. No other new runtime dep is
strictly required for v1 (pre-authored Q&A path). Note: `next.config.ts` runs in lenient mode
(`typescript.ignoreBuildErrors` + `eslint.ignoreDuringBuilds` both `true`), so run
`npx tsc --noEmit` and `npm run lint` manually after adding the SDK.

---

## 8. Mobile consumption

- **Contract doc:** `docs/MOBILE_API_MIGRATION.md` (kept current with any `/api/*` change — a new
  chat endpoint must be added there in the same commit). Testing recipes: `docs/MOBILE_API_TESTING.md`.
- **Auth:** mobile sends `Authorization: Bearer <Firebase ID token>` (from `user.getIdToken()`),
  **no cookies**. ID tokens expire after ~1h; mobile refreshes on `401 EXPIRED_TOKEN` and retries.
- **Base URL:** `https://<app-host>/api/`. Same envelope (`{success,data}` / `{success,error}`) the
  mobile client already parses for every endpoint.
- **No streaming today:** every mobile endpoint is request→response JSON (enrollments,
  playback-token, wallet). The only stream in the system is the Mux HLS URL (client→Mux directly).
  A v1 chat endpoint should therefore return a **complete JSON response** (non-streaming) to match
  what the mobile client already handles; streaming (SSE) is a deferred enhancement.
- **View-only rule:** mobile is a reader app — **never purchases in-app** (App/Play store
  commission avoidance; `docs/MOBILE_PROJECT_STATE.md`). `POST /api/enrollments` rejects sectional
  courses with `COURSE_NOT_SECTIONAL`. **Implication:** a "separate paid chat add-on" (§4) could not
  be sold through mobile — another argument for per-course entitlement gating.
- **What a mobile chat client needs from the new route:** Bearer header; a small JSON request
  (`message`, optional `courseId`/`sectionId`, optional `conversationId`); the standard envelope with
  the assistant message + citations; the same 401-refresh-retry handling it already implements.

---

## Blockers & Open Decisions

**Blockers (must resolve before building a *grounded* chatbot):**

1. **No groundable course text exists (§3).** Hard blocker for the "ask about lesson content"
   experience. Resolve by choosing the content source:
   - (a) **Pre-authored Q&A** per course/section — unblocks v1 immediately, no transcription. ✅ recommended start.
   - (b) **Transcription pipeline** (Mux captions or external STT → store on `videos[]`) — required
     for true long-tail Q&A; a prerequisite sub-project with its own cost/latency.
   Without (a) or (b), the model can only see titles/descriptions/bullets and will hallucinate specifics.
2. **`ANTHROPIC_API_KEY` not provisioned.** Must be added to `.env.local` + Vercel (Production)
   before any live call (§6).
3. **`@anthropic-ai/sdk` not installed** (§7).

> **Update 2026-07-02:** blocker 3 is resolved (SDK installed). Blocker 1(b)'s
> pipeline now exists (`scripts/pipeline/` — external STT via local faster-whisper,
> not Mux captions) but outputs to disk, not Firestore, so 1's storage decision
> remains open. Blocker 2 still stands for the chat feature; note the pipeline
> deliberately uses its own `PIPELINE_ANTHROPIC_API_KEY` (named to dodge
> ambient-env shadowing) — the chat route's `ANTHROPIC_API_KEY` is a separate,
> still-unprovisioned key.

**Open decisions (product/design):**

1. **Access model (§4):** per-enrolled-course entitlement (recommended, mirrors playback gate)
   vs separate paid add-on (heavier, incompatible with mobile view-only). **→ decide.**
2. **Content authoring ownership:** who writes the dental-vertical Q&A pairs, and where do they
   live (proposed: `courses/{courseId}/qa/{qaId}` or a top-level `aiQa` collection)? **→ decide.**
3. **Rate-limit posture for the LLM endpoint:** fail-open (like playback) vs **fail-closed** (deny on
   Redis error, since each call costs money). **→ decide** (design doc proposes fail-closed + per-user/day cap).
4. **Streaming:** non-streaming JSON for v1 (matches mobile); SSE deferred. **→ confirm.**
5. **Cleanup:** remove + rotate the stray unused `OPENAI_API_KEY` in `.env.local` (§6).
6. **Cost guardrails:** per-user daily token/cost cap and a hard monthly ceiling — define targets
   before launch (design doc proposes measuring real cost/user on Haiku before any model change).

**Cleared (no blocker):** API conventions (§1), auth (§2), rate-limit infra (§5), env workflow (§6),
mobile contract (§8) are all in place and reusable as-is.
