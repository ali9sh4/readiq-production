# Audit — Instructor video upload on Chrome‑on‑iPad (WebKit/Safari)

> **SUPERSEDED — archived 2026-07-02.** Discovery-only audit. Its findings are
> distilled into the canonical `docs/UPLOAD_ARCHITECTURE.md` (the iPad
> auth-redirect landmine) and the `upload-architecture` skill. Kept for
> historical context only.

**Date:** 2026‑06‑14
**Type:** Discovery only — read‑only. No code changed.
**Reported symptoms (Chrome on iPad):** (1) slow uploads, (2) the page sometimes
"navigates away" to home/login mid‑upload.

> Chrome on iOS/iPadOS is a UIKit shell around **WebKit** — it is Safari under
> the hood. Everything below about Safari/WebKit timer throttling and storage
> eviction applies to "Chrome on iPad" too.

---

## 1. End‑to‑end trace of the instructor video upload flow

```
VideoUploader (components/video_uploader.tsx)            ← UI, "use client"
  mounted by CourseDashboard (components/CourseDashboard.tsx)
  rendered at:
    app/course-upload/edit/[courseId]/page.tsx           ← middleware-matched
    app/user_dashboard/createdCourses/[courseId]/page.tsx ← middleware-matched
        │
        │ handleUpload() → auth.user.getIdToken()
        ▼
useVideoUpload.startUpload()  (hooks/useVideoUpload.ts)
        │
        │ (1) Server Action: createMuxUpload(formData)
        ▼
app/actions/upload_video_actions.ts::createMuxUpload
        │   - adminAuth.verifyIdToken(token)
        │   - Upstash rate limit (10 / 10m per uid)
        │   - course owner/admin check
        │   - mux.video.uploads.create({ playback_policy:["signed"], timeout:86400 })
        │   ← returns { uploadUrl, uploadId }
        ▼
@mux/upchunk createUpload({ endpoint: uploadUrl, file, chunkSize, attempts… })
        │
        │ (2) PUT chunks  ───────────────►  Mux direct-upload URL
        │     **directly to Mux/Google storage — NOT through our server**
        │
        │ (3) on "success" → poll Server Action getMuxAssetStatus(uploadId)
        │     every 10s, up to 60 attempts (mux.video.uploads.retrieve →
        │     mux.video.assets.retrieve)
        ▼
        │ (4) Server Action: saveCourseVideoToFireStore({courseId, videoData, token})
        │     writes video metadata to Firestore courses/{courseId}.videos
        ▼
   done
```

**Cloudflare R2 is not in this path.** R2 (`lib/R2/`) is used for image/file uploads,
not video. Video bytes go to **Mux only**, via the UpChunk direct‑upload URL.

---

## 2. Explicit answers to Q1–Q6

### Q1 — Chunked/resumable or single POST?

**Chunked + resumable.** It uses Mux direct uploads driven by **`@mux/upchunk`**.
The whole file is never POSTed to our backend.

`hooks/useVideoUpload.ts:116‑128`:
```ts
// Chunked + resumable upload. UpChunk uploads chunks
// sequentially by design — no concurrency option exists.
const upload = createUpload({
  endpoint: uploadUrl,
  file,
  chunkSize: 30720, // KB (30 MB), must be divisible by 256
  attempts: 12,
  // Browsers fire 'online' before the link is actually usable, so
  // instant retries burn all attempts in seconds. 12 × 10s ≈ 2 min
  // of tolerance per chunk (router reboots, ISP blips).
  delayBeforeAttempt: 10,
  dynamicChunkSize: true,
});
```

The Mux upload URL itself is created with a 24h validity
(`upload_video_actions.ts:100‑111`, `timeout: 86400`), so the URL won't expire
during a long upload. UpChunk PUTs each ~30 MB chunk **sequentially** (the code
comment notes there is no concurrency option), and `dynamicChunkSize: true` lets
it shrink/grow the chunk based on observed throughput.

### Q2 — On upload error or network drop, what happens?

**It retries automatically and resumes; it does not navigate.** UpChunk handles
retry/resume internally and the hook wires the events to UI state
(`hooks/useVideoUpload.ts:140‑175`):

- `attemptFailure` → `isRetrying = true` (UI shows "جاري إعادة المحاولة…").
- `offline` / `online` → `isOffline` banner ("انقطع الاتصال — سيستأنف الرفع تلقائياً").
- Each failed chunk retries up to **12 attempts**, 10s apart (~2 min tolerance/chunk).
- Only **after attempts are exhausted** does `upload.on("error")` fire → state
  becomes `"error"`, surfaced as a red banner + a "محاولة مرة أخرى" (retry) button
  (`video_uploader.tsx:768‑779`). The Promise rejects; `handleUpload`'s catch sets
  a generic Arabic error. **No redirect, no reload** originates from this path.

So a transient network drop is the *benign* failure mode here. The "navigates
away" symptom is **not** produced by the UpChunk error path — see Q3.

### Q3 — Any redirect‑to‑login / redirect‑to‑home that can fire DURING a long upload?

**Yes. This is the most plausible source of the "navigates away" symptom.**
The video chunks go straight to Mux and never touch our server, so middleware
never sees them. But the flow makes **Server Action calls to the current page URL**
*during* the upload/processing, and the page route is inside the middleware matcher.

Relevant redirect vectors:

**(a) Middleware token‑expiry redirect on the 10s status poll.**
After UpChunk finishes, `getMuxAssetStatus(uploadId)` is called as a **Server
Action every 10 seconds** for up to 10 minutes (`useVideoUpload.ts:39‑84, 165`).
A Next.js Server Action POSTs to the **current page path**
(`/course-upload/edit/[courseId]` or `/user_dashboard/createdCourses/[courseId]`),
and **both of those are in the middleware matcher** (`middleware.ts:91‑101`).
Middleware then runs `middleware.ts:45‑57`:
```ts
const decodedToken = decodeJwt(token);
if (decodedToken.exp && (decodedToken.exp - 300) * 1000 < Date.now()) {
  return NextResponse.redirect(
    new URL(`/api/refresh-token?redirect=${encodeURIComponent(request.nextUrl.pathname)}`, request.url)
  );
}
```
Once the cookie token is within 5 minutes of expiry (or the JWKS verify throws),
the Server Action request is answered with a **redirect** — to
`/api/refresh-token` (which then 307s back to the page, **reloading it and
dropping the in‑flight upload state**) or, on the failure branches
(`middleware.ts:42‑43`, `76‑79`: no token / verify fail), straight to **`/`
(home)**. From the user's seat this is exactly "the page navigated away
to home" mid‑upload.

**(b) Firebase token refresh is unreliable on iPad, which makes (a) fire.**
`authContext.tsx:44‑70` refreshes the token on a **60s `setInterval`**, only when
it's within 5 min of expiry, via `user.getIdToken(true)` + `setToken(...)`. On
iPad/WebKit this timer is throttled or fully suspended while the tab is
backgrounded or the screen sleeps during a long upload, and Firebase's auth
persistence (IndexedDB) can be paused/evicted. If that refresh doesn't run (or
fails — the catch just logs, `authContext.tsx:63‑66`), the cookie token lapses
and the **next 10s poll trips the middleware redirect in (a).** iPad is therefore
*more* exposed than desktop, matching the report.

**(c) Safari ITP / storage eviction → forced sign‑out.**
`onAuthStateChanged` (`authContext.tsx:73‑109`) calls `removeToken()` whenever it
fires with `null`. WebKit can evict Firebase's IndexedDB under memory pressure or
ITP, which can surface as a transient `null` user → cookie cleared → next poll →
middleware redirect to `/`. (Plausible, harder to prove without a live repro.)

**(d) Start‑of‑upload only:** `createMuxUpload` returns `TOKEN_EXPIRED`
(`upload_video_actions.ts:54‑63`) if the token is already expired when the upload
*begins*. That's a clean error, not a redirect, and only at the start — not the
mid‑upload symptom.

> Net: the chunk transfer is safe, but the **10s status‑poll Server Action is a
> recurring trip through auth middleware**, and on iPad the token‑refresh that
> would keep that green is exactly what WebKit throttles. That pairing is the
> leading explanation for the redirect.

### Q4 — beforeunload guard or navigation block while uploading?

**No.** Confirmed — there is **no `beforeunload` handler anywhere in the repo**
(grep for `beforeunload` → 0 hits) and no router/navigation guard around the
upload. The only protection is a **passive Arabic hint** while uploading
(`video_uploader.tsx:730‑735`): *"الرفع قد يستغرق وقتاً… لا تغلق الصفحة حتى يكتمل
الرفع."* Nothing prevents (or even warns the browser about) the redirect in Q3,
a tab/route change, or an accidental back‑swipe. The buttons are disabled during
upload, but programmatic navigation (middleware redirect) is not blocked.

### Q5 — Wake Lock or keep‑alive during upload?

**No.** No `navigator.wakeLock`, no `WakeLock`, no keep‑alive/heartbeat anywhere
(grep → 0 hits). During a long upload the iPad screen can sleep and the tab can be
backgrounded; WebKit then throttles/suspends timers and can stall the in‑flight
XHR, which both **slows the upload** and **starves the token‑refresh interval**
that prevents the Q3 redirect.

### Q6 — Per‑request size limits, timeouts, body caps on the upload API route

- **Video bytes bypass our server entirely** (UpChunk → Mux direct‑upload URL),
  so Vercel's ~4.5 MB request‑body limit and serverless function timeout **do not
  apply to the upload itself.** This is the right design and is *not* a bottleneck.
- **Server Action body limit:** `next.config.ts:4‑8` sets
  `experimental.serverActions.bodySizeLimit: "100mb"`. Only the *metadata* actions
  (`createMuxUpload`, `getMuxAssetStatus`, `saveCourseVideoToFireStore`) use this,
  and their payloads are tiny — so the cap is irrelevant to upload speed.
- **Mux upload‑URL timeout:** 24h (`timeout: 86400`, `upload_video_actions.ts:110`).
- **Client file cap:** default `maxFileSize = 2 GB` (`video_uploader.tsx:83`);
  allowed types mp4/webm/quicktime/x‑msvideo.
- **Chunk size:** 30 MB, `dynamicChunkSize` on (`useVideoUpload.ts:121,127`).
- **Rate limit:** 10 uploads / 10 min per uid (Upstash, `upload_video_actions.ts:31‑34`).
- **Processing‑poll timeout:** 60 attempts × 10s = **10 min** before
  "Mux processing timed out" (`useVideoUpload.ts:39‑40, 43‑51`). For a very long
  Mux encode this could surface an error even though the upload succeeded.
- **Vercel Hobby:** runtime logs retained only ~1h (per CLAUDE.md) — debug live.

---

## 3. Most‑likely root‑cause ranking

### Symptom 2 — "navigates away to home/login" mid‑upload

1. **(Highest) Middleware auth redirect triggered by the 10s status‑poll Server
   Action.** `getMuxAssetStatus` POSTs to the page route every 10s; that route is
   middleware‑matched; once the Firebase cookie token nears/passes expiry the
   middleware answers with a redirect to `/api/refresh-token` (→ page reload) or to
   `/` (home). iPad/WebKit throttling of the 60s token‑refresh interval
   (`authContext.tsx:44‑70`) is precisely what lets the token lapse, so iPad is
   disproportionately affected. *(Confirm live: watch for the
   "⏰ Token expiring, redirecting to refresh" / "🔄 Token refresh triggered" logs,
   or a 307 on the page URL, while a poll is in flight.)*
2. **Safari ITP / IndexedDB eviction → `onAuthStateChanged(null)` →
   `removeToken()`** clears the cookie, so the next poll hits the no‑token branch
   and redirects to `/` (`authContext.tsx:101‑103`, `middleware.ts:42‑43`).
3. **No `beforeunload`/navigation guard (Q4)** — not a *cause*, but it's why
   nothing intercepts or warns about the redirects in #1/#2; the upload state is
   silently lost.

### Symptom 1 — slow uploads

1. **Sequential 30 MB chunks with no concurrency** (UpChunk by design, noted at
   `useVideoUpload.ts:116‑117`) over a slow/uneven iPad uplink.
2. **No Wake Lock + WebKit background/timer throttling (Q5)** — screen sleep or a
   backgrounded tab stalls the in‑flight chunk XHR; resumes are gated by
   `delayBeforeAttempt: 10`, so each blip costs ≥10s.
3. **Large base chunk on a flaky link** — a 30 MB chunk that fails late wastes the
   whole chunk and waits 10s before retry; `dynamicChunkSize` mitigates but starts
   high.

---

## 4. Notes / guardrails respected

- Read‑only audit. **No files modified, created (other than this doc), or deleted.**
- Protected files were **read only** to answer Q3 and **not edited**:
  `authContext.tsx`, `middleware.ts`, `app/api/refresh-token/route.ts`. Did not
  touch `login-form.tsx`, `register-form.tsx`, `register/action.ts`,
  `forget-password/*`, `playbackToken.ts`, the financial ledger, or
  sectional/accessScope logic.
- Items above are findings for a follow‑up fix discussion, **not** changes made.
</content>
</invoke>
