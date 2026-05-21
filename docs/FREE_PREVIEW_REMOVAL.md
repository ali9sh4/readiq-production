# Free preview — removal (Step 3.5.E) and partial reversal (Option A)

**Status:** free-preview is **enabled for signed-in users on web + mobile** as of 2026-05-21 (Option A — see "Reversal status" below). Anonymous/unauthenticated free-preview remains deliberately **not** implemented.
**History:** the *web UI* player was removed on `feat/step-3.5-signed-playback`, 2026-05-03 (Step 3.5.E), then restored 2026-05-21. The backend gate and the mobile app were never changed.
**Cross-references:** `docs/MOBILE_PROJECT_STATE.md`, `docs/MANUAL_CLEANUP_DO_NOT_AUTOMATE.md` (Firestore field retention block).

This document records the free-preview removal and its partial reversal. Read it end-to-end before touching anything in this area.

---

## Reversal status — Option A, 2026-05-21

Free-preview was re-enabled on the web for **signed-in visitors** (Option A), restoring consistency with mobile. What this changed and what it did not:

- **Web UI** — `components/CoursePreview.tsx` now plays a course's `isFreePreview` video(s) for a signed-in, non-enrolled visitor (via `SignedMuxPlayer` + `useMuxPlaybackToken`). Signed-out visitors see the thumbnail and a sign-in prompt; **no token is requested for them**.
- **Backend** — unchanged. The playback-token route always granted free-preview to any authenticated user (see correction below); Option A needed no backend change. The route was separately rate-limited (per-user, fail-open) in the PR immediately preceding this one.
- **Mobile** — unchanged. Mobile already showed free-preview (Phase 7b).

**Anonymous free-preview (Option B) was explicitly NOT done.** A visitor who is not signed in cannot play free-preview; they are prompted to sign in. The backend steps 1–5 below (unauthenticated token branch, anon TTL, anon audit logging) remain unimplemented and would only be needed for Option B.

## What changed in Step 3.5.E (2026-05-03)

- The free-preview video player in `components/CoursePreview.tsx` (the **web UI** only) was removed.
- Unenrolled web visitors no longer saw a playable video. The lesson list remained visible; clicking any lesson scrolled to and highlighted the Enroll button.
- **The backend was not touched.** `app/api/mux/playback-token/route.ts` continued to bypass the enrollment check for `isFreePreview` videos for any authenticated caller. The mobile app continued to show free-preview. The removal was scoped to the web UI surface.
- The Firestore `freePreviewVideo` field on course documents is **intentionally retained** as dead data. It is not migrated, not nulled out, and not removed from any types. See `docs/MANUAL_CLEANUP_DO_NOT_AUTOMATE.md` for the explicit AI-agent retention block.

> **Correction (2026-05-21):** earlier revisions of this doc claimed the 3.5.E removal made the API gate "exception-free" — that every signed asset would require an authenticated, *enrolled* user with "zero exception cases." **That was never true.** The `!isFreePreview` bypass in the playback-token route was never removed. 3.5.E removed only the web *UI* that called the route; the backend gate kept its free-preview exception throughout, and mobile kept showing free-preview. The corrected framing: 3.5.E hid free-preview on the web UI, producing an unintended split (backend grants, mobile shows, web hides) that Option A has now closed.

## Why the 3.5.E web-UI removal was done

At ~10–200 user scale, enabling **anonymous** token issuance for the signed Mux pipeline (the 3.5.H upload-policy flip from `["public"]` to `["signed"]`) creates more architectural complexity than it is worth. Specifically:

- The signed pipeline already requires an authenticated caller. An *anonymous* free-preview branch would be a genuinely new exception in the gate (the `isFreePreview` bypass for *authenticated* users always existed and was kept).
- The unauthenticated-token endpoint is an attack surface (catalog scraping, anonymous token enumeration, rate-limit budget burn). Not building it avoids that surface.

These reasons argue only against **anonymous** free-preview (Option B). They never argued against authenticated free-preview, which the backend always allowed — which is why Option A (re-enabling it on the web UI for signed-in users) needed no backend change.

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

> **Option A is done (2026-05-21).** The "Frontend" steps below have been completed for signed-in visitors. The "Backend / Upload flow / Data" steps for an *anonymous* branch (Option B) remain unimplemented and are kept here only as a future playbook. If you are not building anonymous free-preview, you can ignore the Backend section entirely.

**Estimated effort (remaining — Option B / anonymous only):** 1–2 days of focused work.

### Backend — Option B (anonymous) only, NOT implemented

1. **Extend `/api/mux/playback-token`** to support an unauthenticated branch: if the requested `videoId` matches the course document's `freePreviewVideo` field, issue a token without requiring auth or enrollment. The branch must:
   - Look up the course by `courseId`.
   - Confirm `course.freePreviewVideo === videoId` (string equality, exact match).
   - Skip the enrollment check.
   - Mint the token with `aud:"v"` like every other playback token.
2. **Add rate limiting** to the unauthenticated path (by IP via Upstash). Use a tighter bucket than the authenticated path. Suggested starting point: 10 requests / 5 minutes per IP per course.
3. **Use a shorter token TTL** for the unauthenticated branch — e.g. 5 minutes instead of the standard 2 hours. Anonymous viewers don't need long sessions, and shorter TTLs limit the blast radius of a leaked token.
4. **Stronger audit logging** for the unauthenticated path: log IP, `userAgent`, `courseId`, `videoId`, `reason="free-preview-anon"`. The `reason` field already exists in the route audit log (added in Path D).
5. **Signing-key strategy.** Decide whether the unauthenticated branch uses the same Mux signing key as paid content or a separate "preview-only" key for cleaner revocation. **Recommendation:** start with the same key, split only if abuse appears. A separate key adds operational complexity (two rotations, two `.env` entries, two failure modes) that isn't justified pre-incident.

### Frontend — Option A (signed-in), DONE 2026-05-21

6. ✅ **Restored the player block** in `components/CoursePreview.tsx` using the `SignedMuxPlayer` wrapper (no raw `<MuxPlayer>`, no hand-rolled token fetch).
7. ✅ **Reintroduced free-preview selection state** (`selectedPreviewId`) and a lesson-click handler. Free-preview lessons get a green play affordance + "معاينة مجانية" badge and load into the player; non-preview lessons still scroll to the Enroll CTA.
8. ✅ **Signed-out handling** — for a signed-out visitor `CoursePreview` does **not** render `SignedMuxPlayer` at all, so `useMuxPlaybackToken` fires no request (its effect early-returns when `!user`). The visitor sees the thumbnail and a sign-in prompt. No "treat unauthenticated success as happy path" branch was needed — Option A never calls the route while signed out.
   - Note: the route's auth-failure codes are `NO_TOKEN` / `INVALID_TOKEN` / `EXPIRED_TOKEN` / `REVOKED_TOKEN` (from `lib/auth/verifyBearerToken.ts`). There is no `UNAUTHENTICATED` code — an earlier revision of this step named one that does not exist. This only matters for Option B, which would hit those codes for an anonymous caller.
9. **Free-preview signal.** The playable-preview selector keys off the per-video `isFreePreview` boolean — the same field the backend route, `CoursePlayer`, and `lib/sectional/access.ts` (`getLockReason`) all use. The course-level Firestore `freePreviewVideo` field is **not** used by the web player (the pre-3.5.E code also drove its player off per-video flags, not that field). `freePreviewVideo` remains retained dead data; an Option B backend branch could still match against it.

### Upload flow — Option B (anonymous) only, NOT implemented

10. **Policy decision for new free-preview uploads.** Two options:
   - **Public policy:** simpler — same as pre-3.5 — but the asset URL is discoverable and streamable forever once leaked.
   - **Signed policy with anonymous branch:** more secure, matches the rest of the system, requires the backend work in steps 1–5.
   **Recommendation:** signed policy with anonymous branch. Public policy reintroduces the exact "asset URL is permanently leakable" problem 3.5 was built to close, just for a subset of videos. Don't split the model.

### Data / Upload — note (Option A)

11. The course-upload form already supports marking videos as `isFreePreview` (per-video flag), so authors set the playable preview the same way `CoursePlayer` already recognized it. Option A required no upload-form change. The course-level `freePreviewVideo` field stays retained dead data.

### Mobile

12. Already done — the mobile app shows free-preview for signed-in users (Phase 7b). No mobile change was needed for Option A. An anonymous mobile branch would only be relevant under Option B.

## Option B (anonymous free-preview) — when to reconsider

Option A is shipped. Build **Option B** (anonymous, signed-out free-preview — the Backend / Upload-flow steps above) only if **both** conditions are true:

- **Conversion analytics show meaningful drop-off attributable to the lack of an anonymous preview.** Track: course-page-view-to-enroll conversion rate. Note that Option A already gives signed-in visitors a preview, so the remaining question is specifically whether *signed-out* visitors convert worse for lack of one.
- **The platform has 500+ users and revenue justifies the engineering investment.** Below that scale, the work plus the ongoing maintenance burden of an extra unauthenticated token branch is unlikely to pay for itself.

**Do NOT preemptively build the anonymous branch before evidence of the conversion loss exists.** At sub-200-user scale, friction-of-checkout, pricing tuning, and content quality will move the needle far more than an anonymous preview. Reactive product decisions on small-N data are mostly noise.

## Why this doc exists separately from `MOBILE_PROJECT_STATE.md`

`MOBILE_PROJECT_STATE.md` is the running status document for the mobile migration and Step 3.5. It carries a one-line summary of free-preview status so it surfaces when scanning project state. This file is the **focused playbook** — the removal history, the Option A reversal record, and the Option B playbook for anyone considering anonymous free-preview later.
