# Free preview removal — Step 3.5.E (reversible)

**Status:** removed on `feat/step-3.5-signed-playback`, 2026-05-03.
**Reversible:** yes — see "How to reverse" below.
**Cross-references:** `docs/MOBILE_PROJECT_STATE.md` ("Free preview: removed in 3.5.E"), `docs/MANUAL_CLEANUP_DO_NOT_AUTOMATE.md` (Firestore field retention block).

This document is the single source of truth for the free-preview removal. If you are picking this up months from now to bring the feature back, read this end-to-end before touching any file.

---

## What changed

- The free-preview video player in `components/CoursePreview.tsx` was removed.
- Unenrolled visitors on a course catalog page no longer see a playable video. The lesson list remains visible; clicking any lesson scrolls to and highlights the Enroll button.
- The Firestore `freePreviewVideo` field on course documents is **intentionally retained** as dead data. It is not migrated, not nulled out, and not removed from any types. See `docs/MANUAL_CLEANUP_DO_NOT_AUTOMATE.md` for the explicit AI-agent retention block.

## Why the decision was made

At ~10–200 user scale, enabling anonymous token issuance for the signed Mux pipeline (the 3.5.H upload-policy flip from `["public"]` to `["signed"]`) creates more architectural complexity than it is worth. Specifically:

- All paid content is gated behind enrollment. Removing free preview means there are zero exception cases in the API gate logic — every signed asset requires an authenticated, enrolled user.
- DRM posture becomes uniform: every signed asset is gated identically. No "almost-public" branch to reason about.
- The unauthenticated-token endpoint is an attack surface (catalog scraping, anonymous token enumeration, rate-limit budget burn). Removing the branch removes the surface.

## What it trades off

The product loses a marketing/conversion tool. Visitors can no longer "try before they buy" with a sample video. This is a real cost — preview videos are a standard e-learning conversion lever.

Mitigations available without bringing free preview back:

- Course description (already present)
- Syllabus / lesson list (still rendered post-removal)
- Instructor bio
- Course thumbnail
- Testimonials / reviews
- Screenshots / promo image

If conversion data later shows the loss is meaningful, free preview can be reintroduced. The reversal is bounded — see below.

## How to reverse this

**Estimated effort:** 1–2 days of focused work.

### Backend

1. **Extend `/api/mux/playback-token`** to support an unauthenticated branch: if the requested `videoId` matches the course document's `freePreviewVideo` field, issue a token without requiring auth or enrollment. The branch must:
   - Look up the course by `courseId`.
   - Confirm `course.freePreviewVideo === videoId` (string equality, exact match).
   - Skip the enrollment check.
   - Mint the token with `aud:"v"` like every other playback token.
2. **Add rate limiting** to the unauthenticated path (by IP via Upstash). Use a tighter bucket than the authenticated path. Suggested starting point: 10 requests / 5 minutes per IP per course.
3. **Use a shorter token TTL** for the unauthenticated branch — e.g. 5 minutes instead of the standard 2 hours. Anonymous viewers don't need long sessions, and shorter TTLs limit the blast radius of a leaked token.
4. **Stronger audit logging** for the unauthenticated path: log IP, `userAgent`, `courseId`, `videoId`, `reason="free-preview-anon"`. The `reason` field already exists in the route audit log (added in Path D).
5. **Signing-key strategy.** Decide whether the unauthenticated branch uses the same Mux signing key as paid content or a separate "preview-only" key for cleaner revocation. **Recommendation:** start with the same key, split only if abuse appears. A separate key adds operational complexity (two rotations, two `.env` entries, two failure modes) that isn't justified pre-incident.

### Frontend

6. **Restore the `<MuxPlayer>` block** in `components/CoursePreview.tsx`. Use the `SignedMuxPlayer` wrapper component from 3.5.B — do not reintroduce a raw `<MuxPlayer>` element.
7. **Reintroduce `selectedVideo` state** and the lesson-click handler for free-preview videos in the same file. Lessons that aren't the free preview must still scroll to and highlight the Enroll button (the post-removal behavior for non-preview lessons stays).
8. **Update `SignedMuxPlayer` or `useMuxPlaybackToken`** to handle the unauthenticated case gracefully. The current implementation surfaces `error.code === "UNAUTHENTICATED"` for any unauthenticated caller, and the wrapper has no render branch for it. Add a branch that, when free preview is enabled for the requested video but no user is signed in, still calls the endpoint and treats success as the happy path. The unauthenticated request must include `courseId` and `videoId` so the backend branch from step 1 can match against `course.freePreviewVideo`.

### Upload flow

9. **Policy decision for new free-preview uploads.** Two options:
   - **Public policy:** simpler — same as pre-3.5 — but the asset URL is discoverable and streamable forever once leaked.
   - **Signed policy with anonymous branch:** more secure, matches the rest of the system, requires the backend work in steps 1–5.
   **Recommendation:** signed policy with anonymous branch. Public policy reintroduces the exact "asset URL is permanently leakable" problem 3.5 was built to close, just for a subset of videos. Don't split the model.

### Data

10. **Existing courses retain `freePreviewVideo`.** The field was intentionally not migrated when removal shipped. Existing courses with the field set will "just work" once steps 1–9 are done — no data backfill required.
11. **New courses uploaded between removal and reversal won't have the field set.** Instructors will need to set it again via the upload UI on a per-course basis. There is no automated way to retroactively pick a free-preview lesson; this is a content decision.
12. **Re-add the `freePreviewVideo` input field to the course-upload form** if it was removed during 3.5.E. Verify the form's current state when reintroducing — do not assume the field is or isn't there without checking.

### Mobile

13. If free preview should work on mobile too, replicate the unauthenticated token branch in the mobile app's playback flow. Otherwise ship as "preview only on web" — simpler product decision, and the mobile app's primary audience is already-enrolled students.

## When to reconsider

Reintroduce free preview only if **both** conditions are true:

- **Conversion analytics show meaningful drop-off attributable to the lack of preview.** Track: course-page-view-to-enroll conversion rate. You need a baseline (the few weeks before removal, if telemetry was already in place) AND several months of data after removal to attribute the change with any confidence.
- **The platform has 500+ users and revenue justifies the engineering investment.** Below that scale, the 1–2 days of work plus the ongoing maintenance burden of an extra token branch is unlikely to pay for itself.

**Do NOT preemptively rebuild free preview before evidence of the conversion loss exists.** At sub-200-user scale, friction-of-checkout, pricing tuning, and content quality will move the needle far more than preview videos. Reactive product decisions on small-N data are mostly noise.

## Why this doc exists separately from `MOBILE_PROJECT_STATE.md`

`MOBILE_PROJECT_STATE.md` is the running status document for the mobile migration and Step 3.5. It carries a summary of this decision so it surfaces when scanning project state. This file is the **focused playbook** for the reversal, designed to be read end-to-end if and only if someone is actively bringing the feature back. Splitting it keeps the project-state doc scannable and gives the reversal work a single canonical reference.
