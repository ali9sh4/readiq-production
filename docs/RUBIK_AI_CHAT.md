# Rubik AI Chat — design (not yet implemented)

**Status:** Design / planning. No code shipped.
**Companion audit:** `docs/AUDIT_RUBIK_AI_CHAT.md` (read it first — the content blocker in §3 there
gates everything below).
**Date:** 2026-05-30. **First vertical:** Dental.

Rubik AI is an in-app chatbot that answers learner questions about course content. It runs as a
**single server-side API route** that both the web app and the React Native app call, so the LLM
API key never reaches a client.

---

## 1. Architecture

```
 Web client ─┐                                  ┌─ Firestore (Q&A pairs, course text, enrollments)
             ├──► POST /api/chat  (server-only) ─┤
 Mobile  ────┘     • verifyBearerToken           └─ Anthropic API (Claude Haiku 4.5 + prompt caching)
                   • access gate (per-course)
                   • rate limit (per-user)
                   • retrieve context → call model → return cited answer
```

- **One route, two clients.** `POST /api/chat` on the web repo serves web and mobile identically,
  using the existing `/api/*` conventions (`lib/api/response.ts` envelope, `verifyBearerToken`).
  Mobile stays a **thin client**: send Bearer token + message, render the response. No model logic,
  no key on device.
- **Key is server-only.** `ANTHROPIC_API_KEY` lives in `.env.local` + Vercel env, read via
  `process.env`, never `NEXT_PUBLIC_`. (Audit §6.)
- **Non-streaming for v1.** Return a complete JSON answer — matches every existing endpoint and what
  the mobile client already parses. SSE streaming is deferred (§9).

---

## 2. Model strategy

- **Start: Claude Haiku 4.5** (`claude-haiku-4-5`) with **prompt caching** on the repeated
  course-content context. The grounding context (course text / Q&A block, system prompt) is stable
  across a user's turns and across users asking about the same course, so cache it with
  `cache_control` and pay full input price only on the first call per cache window.
- **Measure before optimizing.** Instrument input/output tokens per request (return them in the
  response `meta` and log them) and compute **real cost per active user** on Haiku before considering
  any alternative model (e.g. DeepSeek). Don't switch models on speculation.
- **Opus is out of scope.** Opus is the expensive tier; it is explicitly **not** used for this
  feature. Haiku 4.5 is the only model wired for v1.
- **Prompt-cache shape (planning):** system prompt + per-course grounding block marked cacheable;
  the user's question is the only uncached, per-request portion. Re-evaluate cache hit rate after
  launch (see the `claude-api` skill for caching specifics when implementing).

---

## 3. Retrieval

Two tiers, matching the ~80 / 20 split:

- **Common case (~80%) — pre-generated Q&A pairs in Firestore.** Hand-authored (dental vertical
  first) per course/section. On a query, match against these pairs and ground the model on the
  matched pair(s). Cheap, fast, no transcription. **This is the v1 backbone** and the only path that
  works given the content blocker (audit §3 — no transcripts exist yet).
  - Proposed storage: `courses/{courseId}/qa/{qaId}` → `{ question, answer, sectionId?, tags[], updatedAt }`.
- **Long tail — v1: dropdown narrows scope → full text into context.** The UI asks the user to pick
  one course (and optionally one section); the route loads that scope's available text (Q&A pairs +
  course `description`/`learningPoints`/`requirements` + section/video `title`s, and transcripts *if/when*
  they exist) and puts it directly into the model context. **No embeddings, no vector DB in v1.**
- **v2 (deferred) — embeddings + vector search.** Chunk + embed course text, retrieve top-k by
  similarity. Deferred until (a) real transcript text exists and (b) corpus size makes full-text
  context impractical. Not built in v1.

> **Hard dependency:** the long-tail "ask anything about the lesson" experience only becomes real
> once course videos are transcribed (audit §3, blocker 1). Until then, long-tail answers are limited
> to authored text and will be honest about not knowing specifics.

---

## 4. Access model

**Decision (proposed — carried from audit §4 open question): gate chat per-enrolled-course,
mirroring the Mux playback-token gate.** Not a separate paid add-on.

Reasons: zero new billing surface; consistent with "chat is part of learning"; and a paid add-on
would be unsellable on mobile (view-only / no in-app purchase, audit §8). **Confirm with product
before building** — this is still an open decision.

Gate logic (reuse `app/api/mux/playback-token/route.ts` as the reference):

```
owner (course.createdBy === userId) OR admin (auth.isAdmin)  → ALLOW (any scope)
no completed enrollment                                       → DENY (NOT_ENROLLED)
course.purchaseMode !== "sectional"                           → ALLOW
sectional:
  accessScope unset OR "full"                                 → ALLOW (grandfathered / bundle)
  accessScope === "sectional":
     chat scoped to a section the user owns (ownedSectionIds) → ALLOW
     else                                                     → DENY (SECTION_NOT_OWNED)
```

Respect all seven sectional invariants (audit §4). Unset `accessScope` = grandfathered full access —
never overwrite it.

---

## 5. Rate limiting

Reuse the existing Upstash setup (audit §5), **per user**, with a dedicated limiter:

```ts
const chatLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(/* e.g. */ 30, "1 h"), // tune to cost target
  analytics: true,
  prefix: "rubik_chat",
});
const { success } = await chatLimiter.limit(auth.userId);
if (!success) return fail("RATE_LIMITED", "You've reached your chat limit. Try again later.", 429);
```

- **Per-user keying** on `auth.userId`, plus a **per-user/day** cap to bound cost.
- **Fail-closed** (deliberate divergence from the playback route's fail-open): since each call costs
  real money, deny on a Redis error rather than letting unlimited calls through. To confirm in design.
- Add a **global monthly ceiling** alarm separate from per-user limits.

---

## 6. Request / response contract

`POST /api/chat` — Bearer auth, standard envelope (`lib/api/response.ts`).

**Request:**
```jsonc
{
  "message": "string (required, 1..4000 chars)",
  "courseId": "string (required in v1 — chat is course-scoped for grounding + gating)",
  "sectionId": "string (optional — narrows scope for sectional users / long-tail)",
  "conversationId": "string (optional — continuity; server-managed if omitted)"
}
```
Validate with a new zod schema `lib/validation/api/chat.ts`.

**Success (200):**
```jsonc
{
  "success": true,
  "data": {
    "conversationId": "string",
    "message": "string (assistant answer; markdown — render with react-markdown + remark-gfm)",
    "citations": [
      {
        "kind": "qa" | "course" | "section" | "video",
        "courseId": "string",
        "sectionId": "string | null",
        "videoId": "string | null",
        "label": "string (human-readable source, e.g. video/section title or Q&A question)"
      }
    ],
    "meta": { "model": "claude-haiku-4-5", "inputTokens": 0, "outputTokens": 0, "cached": false }
  }
}
```

**Failure:** standard envelope `{ success:false, error:{ code, message } }`. Codes:
`NO_TOKEN`/`INVALID_TOKEN`/`EXPIRED_TOKEN`/`REVOKED_TOKEN` (401), `VALIDATION_ERROR` (400),
`NOT_ENROLLED`/`SECTION_NOT_OWNED` (403), `COURSE_NOT_FOUND` (404), `RATE_LIMITED` (429),
`INTERNAL_ERROR` (500). `handleApiError` covers auth + zod automatically.

**Citation shape:** every answer should cite the grounding source(s) so the UI can link back to the
course/section/video the answer came from. When the model lacks grounding to answer, it returns an
honest "I don't have that in the course material" message with an empty `citations` array — it must
not invent citations.

---

## 7. Mobile UI

- **Entry point:** a **floating action button (FAB) with the R (Rubik) logo**, anchored bottom-end
  on course/learning screens, opening the chat panel.
- **Thin client:** sends `{ message, courseId, sectionId?, conversationId? }` with the Bearer header;
  renders `data.message` as markdown and `data.citations` as tappable links into the course/section/video.
- **Reuses existing patterns:** same Bearer-token + 401-refresh-retry the mobile app already does for
  every endpoint; same `{success,data}` parsing. No new auth or networking primitive needed.
- **No purchase UI** in the chat (view-only rule). If a user without entitlement opens chat, the
  client shows a "buy on web" prompt on `NOT_ENROLLED` / `SECTION_NOT_OWNED`.

---

## 8. Out of scope for v1 / deferred

- **Transcript-grounded long-tail Q&A** — needs a transcription pipeline first (audit §3). Deferred.
- **Embeddings + vector search** — v2; not built in v1 (full-text-into-context instead).
- **Streaming (SSE) responses** — v1 returns complete JSON; streaming deferred.
- **DeepSeek or any non-Haiku model** — only after measuring real cost/user on Haiku.
- **Opus** — explicitly excluded (expensive tier).
- **Verticals beyond dental** — dental first; others follow once the pattern proves out.
- **Separate paid chat add-on / chat SKU** — not in v1 (see §4); incompatible with mobile view-only.
- **Persistent long-term conversation memory / cross-course context** — minimal conversation
  continuity only in v1.

---

## 9. Open decisions (carried from the audit)

1. **Access model** — confirm per-enrolled-course gating (§4) vs paid add-on. *Recommended: per-course.*
2. **Q&A authoring** — who writes dental Q&A pairs; final storage location
   (`courses/{courseId}/qa/{qaId}` vs top-level collection).
3. **Rate-limit posture** — confirm fail-closed + per-user/day cap + global monthly ceiling (§5).
4. **Streaming** — confirm non-streaming JSON for v1 (§6/§8).
5. **Content path to true long-tail** — commit (or not) to a transcription sub-project, and if so,
   Mux auto-captions vs external STT, and where transcript text is stored on `videos[]`.
6. **Cost guardrails** — set the per-user daily cap and monthly ceiling targets before launch;
   instrument token usage (`data.meta`) from day one.

---

## Implementation prerequisites (when building begins — not now)

1. Provision `ANTHROPIC_API_KEY` in `.env.local` + Vercel (Production); document in `CLAUDE.md`.
   Remove + rotate the stray unused `OPENAI_API_KEY` (audit §6).
2. `npm install @anthropic-ai/sdk` (audit §7). Then `npx tsc --noEmit` + `npm run lint` (lenient build mode).
3. Add `app/api/chat/route.ts` following the canonical handler skeleton (audit §1) +
   `lib/validation/api/chat.ts`.
4. Add a reusable access helper mirroring the playback-token gate (consider extracting the gate so
   chat and playback share one source of truth — coordinate with the `sectional-invariants` skill).
5. Author the first dental Q&A set in Firestore.
6. Update `docs/MOBILE_API_MIGRATION.md` with the new endpoint **in the same commit** (CLAUDE.md rule).
