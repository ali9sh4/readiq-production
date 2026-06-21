# Video Upload Pipeline — Architecture & Landmines

Canonical reference for the instructor video-upload path. **Read this before
changing** `hooks/useVideoUpload.ts`, `components/video_uploader.tsx`, or
`app/actions/upload_video_actions.ts`. The non-negotiables also live in the
`upload-resilience` skill (`.claude/skills/upload-resilience/`), which fires
when you open those files.

Every rule below was paid for in production debugging. Each prevents a specific,
confirmed failure. Do not "simplify" them away.

## Architecture

```
Browser picks a file
  → createMuxUpload (server action) mints a Mux direct-upload URL
      via mux.video.uploads.create
  → UpChunk PUTs the file in chunks straight to that URL
      (endpoint resolves to direct-uploads-oci-us-ashburn-1 — OCI Virginia;
       bytes never pass through our server)
  → Mux validates + encodes the asset
  → client polls getMuxAssetStatus until status === "ready"
  → ONLY THEN saveCourseVideoToFireStore writes the video into the course doc
```

Reader-app model: **mobile never uploads.** This pipeline is web / instructor
only. (See `docs/AUDIT_IPAD_UPLOAD.md` for a separate, still-open concern: the
10s status-poll is a Server Action to a middleware-matched page route, so an
auth-token lapse mid-upload can redirect the page away — most visible on iPad.)

## Hard constraints (each prevents a confirmed bug)

1. **Progress bar is driven by committed chunks, never raw in-flight progress.**
   Sum `chunkSuccess` byte sizes into a committed-bytes ref; derive % from that.
   UpChunk's raw `progress` event includes the in-flight chunk's optimistic
   bytes, which collapse back to the committed floor when a chunk fails on a
   flaky link — the bar lurches *backward* (observed live: 88% → 78% → 89% →
   78%). Committed bytes only increase. Never reintroduce a displayed value that
   can decrease.

2. **Fixed 8 MB chunks. `dynamicChunkSize: false`.** With dynamic sizing on, a
   brief fast moment grew the chunk to ~70 MB; then on a degraded link that
   chunk could never finish before a drop, so every retry re-sent ~70 MB and
   committed *nothing* — net-zero progress while burning bandwidth. Small fixed
   chunks commit between drops and lock in progress. `chunkSize: 8192` KB
   (8192 / 256 = 32 ✓).

3. **Detect trouble via "no `chunkSuccess` across N `attemptFailure`s" — NOT
   `navigator.onLine`.** `navigator.onLine` stays `true` on a degraded-but-not-
   dead connection, so the offline event never fires when you need it. The real
   signal that the link can't sustain the upload is: chunks keep failing and
   none commit. Reset the counter on any `chunkSuccess`. (Current threshold:
   `MAX_FAILURES_BEFORE_STALL = 4` → pause + show the restart prompt.)

4. **On a real disconnect: ABANDON and restart fresh. NEVER resume a session
   that lost connection.** A mid-chunk disconnect can leave a partial chunk on
   Mux's side. Resuming re-sends from a chunk boundary and corrupts the byte
   seam; the upload then runs to 100% and Mux rejects it at the
   finalization/size check → **instant failure, no encoding**. A fresh upload of
   the same file works. UpChunk auto-resumes on the `online` event by default —
   **abort the instance on the `offline` event** to kill that path (a dead
   instance has nothing to auto-resume). Recovery = restart from zero, not
   resume. There is deliberately no `resume()`.

5. **Retry / restart = a NEW Mux upload URL. NEVER reuse a dead one.** Reusing
   the old URL after an interruption fails with **400** — the session's server
   offset is already past byte 0, so a fresh PUT from byte 0 conflicts on
   Content-Range. Always call `createMuxUpload` again for a new url + id. New URL
   = empty session = byte 0 valid = no 400.

6. **One UpChunk instance live at a time. Dispose before creating a new one.**
   `disposeActiveUpload()` must abort the prior instance and null the ref before
   any new `startUpload` (it also fire-and-forget `cancelMuxUpload`s the
   abandoned session and resets the committed/failure counters). Otherwise a
   zombie attempt auto-resumes and overlaps the new one (symptom: bar creeping
   under an error banner).

7. **Course-video record is written ONLY on asset `ready`.** The write
   (`saveCourseVideoToFireStore`) runs after `startUpload` resolves, and that
   only resolves once polling sees `ready`. Never write a record on
   upload-start or on the create-upload call — a failed/interrupted upload must
   leave no phantom entry.

## Current deliberate config

In `createUpload(...)` (`hooks/useVideoUpload.ts`):

- `chunkSize: 8192` (KB = 8 MB) — constraint 2.
- `dynamicChunkSize: false` — constraint 2.
- `attempts: 12`, `delayBeforeAttempt: 10` — ~2 min of in-chunk retry
  tolerance. A chunk that fails while still **online** re-sends the *full*
  chunk (no partial seam) and produces a valid file — that's the safe recovery.
  Only the offline → resume path corrupts. Leave these alone.

## `createMuxUpload` asset settings — deliberate, don't touch

`playback_policy: ['signed']`, `mp4_support: 'none'`, `encoding_tier: 'smart'`,
`normalize_audio: true`, `timeout: 86400`. `smart` + `normalize_audio` make
processing slower (relevant to poll-timeout tuning). `timeout: 86400` (24h)
keeps slow-but-alive uploads from being cut.

## Error signatures (read symptoms correctly)

| Symptom | Meaning | NOT |
|---|---|---|
| `Server responded with 0`, `ERR_INTERNET_DISCONNECTED` | Network dropped | — |
| `Server responded with 400` on the upload URL | Session-state rejection — a reused/stale Mux session | Not network, not auth (token is not expired) |
| Upload hits 100% then fails **instantly, no processing** | Mux rejected at finalization — the file is corrupt, almost always a **resumed** session | Not an encode failure |
| "Mux processing timed out" | Your own poll loop gave up. Check the asset's dashboard status: `ready`/`preparing` → poll timeout too short; `errored` → real failure | Not necessarily a Mux problem |
| Firestore `WebChannelConnection ... transport errored` | Harmless reconnect noise | Ignore — not an upload bug |

## Verifying upload changes — build-pass is NOT enough

`npm run build` and `tsc` passing prove the code compiles. They prove **nothing**
about runtime upload behavior — every real bug this subsystem has had passed the
build. An upload change is not done until these are eyeballed with a **real
upload**:

1. **Happy path** — bar climbs 0 → 100 in ~8 MB steps; asset reaches `ready`.
   (Catches unit bugs: bar snapping to 100% or `NaN%` = wrong byte/KB math.)
2. **Degraded line** (DevTools → Network → Slow 3G / custom throttle) — bar
   never decreases; stall prompt appears after the failure threshold.
3. **Full disconnect + restore** — upload does NOT silently resume to
   completion; restart works: **new upload id** in the network tab, bar from
   0%, asset processes.
4. **Retry after error** — network tab shows a **new** upload id, not the
   failed one.
5. Confirm the actual **Mux asset reaches `ready`** — not just that the client
   said success.

If a change cannot be exercised by one of the above, say so explicitly.

## Locked files — don't touch without reason

Per `docs/MANUAL_CLEANUP_DO_NOT_AUTOMATE.md`: `lib/mux/playbackToken.ts`, the
financial ledger, sectional / `accessScope` logic.

## Known limitation / roadmap

Short-term, a full disconnect restarts the whole file from zero — expensive on
slow Baghdad lines (Mux ingest is OCI Virginia; ~2–8 Mbps single-stream
ceiling). The real fix is **Phase B**: browser → Cloudflare R2 multipart
(per-part checksums = genuinely resumable, no seam corruption) → Mux pulls from
R2 server-side. Also planned: replace browser polling for processing status with
Mux webhooks (`video.asset.ready` / `video.asset.errored`).
