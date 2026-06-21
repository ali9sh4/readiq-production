---
name: upload-resilience
description: >-
  Use whenever working on the instructor video-upload path —
  hooks/useVideoUpload.ts, components/video_uploader.tsx, or the upload server
  actions in app/actions/upload_video_actions.ts (createMuxUpload,
  getMuxAssetStatus, saveCourseVideoToFireStore). Covers UpChunk chunking,
  progress, retry/disconnect recovery, and the Mux direct-upload session
  lifecycle. Read it before changing chunk size, progress, retry, offline/stall
  handling, the create-upload call, or when to persist the course-video record.
  Each rule prevents a specific confirmed production bug.
---

# Video Upload Resilience Invariants

The instructor upload path (web only — mobile never uploads) is correct only
because these rules hold. Each was paid for in production debugging and prevents
a specific, confirmed failure. Do not "simplify" them away.

Full architecture, error-signature table, and the real-upload verification
checklist live in **`docs/VIDEO_UPLOAD_PIPELINE.md`** — read it for detail. The
flow in one line: `createMuxUpload` mints a Mux direct-upload URL → UpChunk PUTs
chunks straight to Mux (OCI Virginia) → poll until `ready` → only then
`saveCourseVideoToFireStore`.

## The seven non-negotiables

1. **Bar = committed chunks, never raw in-flight progress.** Sum `chunkSuccess`
   bytes; derive % from that. UpChunk's `progress` event includes in-flight
   bytes that collapse on a failed chunk → the bar jumps *backward*. Never
   display a value that can decrease.

2. **Fixed 8 MB chunks, `dynamicChunkSize: false`** (`chunkSize: 8192`). Dynamic
   sizing grew chunks to ~70 MB; on a degraded link such a chunk never finishes,
   so every retry re-sends it and commits nothing. Small fixed chunks lock in
   progress between drops.

3. **Detect trouble via "no `chunkSuccess` across N `attemptFailure`s", NOT
   `navigator.onLine`.** `onLine` stays `true` on a degraded link. Reset the
   counter on any `chunkSuccess`. (Threshold `MAX_FAILURES_BEFORE_STALL = 4`.)

4. **Real disconnect → ABANDON + restart fresh. Never resume a session that lost
   connection.** A resumed session corrupts the chunk seam; the upload hits 100%
   then Mux rejects it at finalization (instant fail, no encoding). Abort the
   instance on the `offline` event to kill UpChunk's auto-resume. There is
   deliberately no `resume()`.

5. **Retry / restart = a NEW Mux upload URL.** Reusing a dead URL → **400**
   (server offset past byte 0, Content-Range conflict). Always call
   `createMuxUpload` again for a new url + id.

6. **One UpChunk instance live at a time.** `disposeActiveUpload()` aborts the
   prior instance, nulls the ref, best-effort `cancelMuxUpload`s the old
   session, and resets counters — before any new `startUpload`. A zombie attempt
   auto-resumes and overlaps the new one (bar creeps under an error banner).

7. **Write the course-video record ONLY on asset `ready`.** The write runs after
   `startUpload` resolves, which only happens once polling sees `ready`. Never on
   upload-start or on the create-upload call — a failed upload must leave no
   phantom entry.

## Don't touch without reason

- **`createMuxUpload` asset settings**: `playback_policy:['signed']`,
  `mp4_support:'none'`, `encoding_tier:'smart'`, `normalize_audio:true`,
  `timeout:86400`. Deliberate (`smart` + `normalize_audio` slow processing —
  matters for poll-timeout tuning; `timeout:86400` keeps slow-but-alive uploads
  alive).
- **`attempts:12` / `delayBeforeAttempt:10`**: ~2 min in-chunk retry tolerance.
  An online chunk failure re-sends the *full* chunk (no seam) and is safe — only
  the offline→resume path corrupts. Leave these alone.
- Locked files (`docs/MANUAL_CLEANUP_DO_NOT_AUTOMATE.md`):
  `lib/mux/playbackToken.ts`, the financial ledger, sectional / `accessScope`.

## Build-pass is NOT enough

`tsc` + `build` prove compilation, nothing about runtime upload behavior — every
real bug here passed the build. Exercise a **real upload**: happy path (0→100 in
~8 MB steps, asset `ready`), degraded line (bar never decreases, stall prompt
fires), full disconnect+restore (no silent resume; restart shows a NEW upload id
and the asset processes), retry-after-error (NEW upload id). If a change can't be
exercised this way, say so explicitly. Checklist: `docs/VIDEO_UPLOAD_PIPELINE.md`.

## If a change seems to require violating one of these

Stop and surface it. These are load-bearing — breaking one silently reintroduces
a confirmed money/UX bug. A task that genuinely can't be done without breaking
one needs rethinking or explicit human sign-off, not a quiet exception.
