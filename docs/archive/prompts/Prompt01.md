Doc + scoping task. Two phases. Phase 1 is doc-only. Phase 2 is implementation but DO NOT START IT until I explicitly say "go on Phase 2" — even if Phase 1 finishes quickly.

CONTEXT (do not paraphrase, treat as given):

The web mobile API surface is complete and committed (Steps 1, 2, 3B, 4, 5, 6 plus Path D, plus Auth Google-only UI, plus the threat-scenarios doc, plus the manual-cleanup-protection doc). 14 endpoints shipped. The latest commit on main is the Path D commit (529b236).

Decision locked in:
1. Step 3.5 ships next (web-side DRM hardening — signed Mux playback wrapper, 3 surface migration, thumbnail signing, upload policy flip).
2. Then Expo mobile app scaffold and feature build in a new repo (readiq-mobile).
3. Step 3.5 + mobile-only viewing + FLAG_SECURE on Android closes Scenario 1 (public link-sharing) and most of Scenario 2 (casual credential sharing).
4. Scenario 3 (competitor scrapes the catalog and rebrands) is deliberately deferred until the platform has 10+ paying customers AND there's evidence of actual abuse. We will not pre-build watermarking, device-binding, concurrent-session caps, or per-user burned-in watermarks. Those are reactive defenses, not preventive ones, for our scale.

Honest threat-model framing (this paragraph belongs in the doc verbatim):

After 3.5 + mobile launch, the DRM posture is: A+ for stopping URL link-sharing (the loud, scalable, embarrassing attack), B+ for stopping casual credential-sharing among friends, C for stopping a determined enrolled paying user with technical knowledge (impossible to fully solve, true for every platform on Earth including Netflix/HBO), F for stopping content repackaging via AI summarization (also impossible, also true everywhere). The goal is not zero piracy. The goal is "leaking is annoying enough that paying is easier." That is a realistic and successful DRM outcome for an Iraqi-market dental/medical e-learning platform.

What 3.5 actually changes for users (verbatim — these claims need to be true after 3.5 ships):

- Existing 10 paying customers: zero perceptible change. Old videos uploaded before 3.5 stay public-policy in Mux and continue playing through the new wrapper component. Maybe a 200-300ms delay on first play of new signed videos. Nothing else.
- Instructors: same upload UI, same flow. Owner branch in /api/mux/playback-token (shipped in Path D) lets them preview their own draft/unpublished course videos.
- Old uploaded videos (the 17 in "From Diagnosis to Extraction", the Exoplan course): stay public-policy permanently. Mux does not allow flipping an existing asset's policy. They are dev/test content per existing project notes; real production content will be uploaded after 3.5 lands.
- New uploads (after 3.5): signed-policy only. No public m3u8 URL exists for them.

What 3.5 does NOT change:

- Old public-policy assets remain leakable via direct Mux URL until they are deleted and re-uploaded.
- A determined enrolled student can still extract video via screen-record or yt-dlp-with-token.
- Friend-credential-sharing (Scenario 2) is reduced by Google-only auth + mobile-only viewing, not eliminated.

PHASE 1 — DOCUMENT (read-only on code, write-only to docs)

Update three docs. After all writes, output a single-line summary of what changed in each.

A. docs/MOBILE_PROJECT_STATE.md

  - Update "Last updated" to today.
  - "Up next" section: replace items 1 and 2 with the new ordered plan:

    1. **Step 3.5 (web — signed Mux playback)**. Build SignedMuxPlayer wrapper + useMuxPlaybackToken hook. Build thumbnail token helper + signed thumbnail URL strategy. Migrate 3 web player call sites: components/video_uploader.tsx (line ~857), components/CoursePreview.tsx (line ~326), components/ui/CoursePlayer.tsx (line ~644). Migrate thumbnail call site at video_uploader.tsx (line ~741) and grep for any other image.mux.com call sites. Last step: flip app/actions/upload_video_actions.ts playback_policy from ["public"] to ["signed"]. Test all three surfaces against both new signed assets AND legacy public-policy assets. Estimate: 1–2 focused days.
    2. **Mobile scaffold (readiq-mobile new repo)**. Fresh Expo managed project. Stack staged in personal notes. First session: project init, navigation skeleton, Firebase Auth ID-token bearer client, apiClient wrapper around the 14 endpoints, /api/health/me smoke screen.
    3. (rest of existing list unchanged)

  - Append a new section titled "DRM strategy and threat scope" placed after "Step 3.5 — audit & decision rationale". Content includes:
    - The "honest threat-model framing" paragraph above, verbatim.
    - The "What 3.5 actually changes for users" bullet list, verbatim.
    - The "What 3.5 does NOT change" bullet list, verbatim.
    - A short closing paragraph: "Scenario 3 mitigations (catalog scraping by a competitor) are deferred until the platform reaches 10+ paying customers AND there is evidence of actual abuse. Pre-building reactive defenses (per-user watermarking, device-binding, concurrent-session caps) at current scale is over-engineering. They will be scoped when there is a real attack to defend against, not before."

B. docs/MOBILE_API_MIGRATION.md

  - Find the existing Step 3.5 scope section. Update its status header from "DEFERRED" to "ACTIVE — next milestone". Do not change the migration gotchas list (it is correct and tested against the codebase as of yesterday's audit).
  - At the bottom of the Step 3.5 section, add a "Test plan before merging" subsection with this content:

    Before merging Step 3.5, manually verify all six of these flows on a local dev server:

    1. Instructor uploads a NEW video to a draft course → preview card plays the video correctly (uses owner branch on /api/mux/playback-token, signed token, ~200-300ms first-play delay).
    2. Instructor uploads a NEW video to a published course → preview card plays correctly.
    3. Public visitor opens the course detail page → free-preview videos play correctly (uses free-preview branch on /api/mux/playback-token).
    4. Enrolled student opens a paid course → CoursePlayer plays paid videos correctly (uses enrollment branch).
    5. Enrolled student opens a course with mixed legacy + new videos → both types play (wrapper handles unsigned legacy AND signed new).
    6. After all of the above, the watermark stays positioned correctly across fullscreen transitions in CoursePlayer (the DOM-walking quirk noted in the migration gotchas).

    If any of those six fail, do NOT flip upload policy to ["signed"]. The flip is the LAST step and should be done in a separate commit after the wrapper is proven across all surfaces.

C. docs/MOBILE_PROJECT_STATE.md "Re-evaluation triggers" section

  - Add a new bullet to the existing list:

    - Scenario 3 mitigations (per-user watermarking, device-binding, concurrent-session caps) are reactive defenses. Scope them ONLY when: (a) the platform has 10+ paying customers AND (b) there is documented evidence of catalog scraping or sharing-ring abuse. Do not pre-build at current scale.

PUSH BACK if any of the following:
- You think the file paths or line numbers I gave are wrong (verify against the current code).
- You think 3.5 should NOT be the next milestone (audit your own MOBILE_PROJECT_STATE.md and disagree productively).
- You find any pre-existing doc content that contradicts the strategy above.
- You think the test plan is missing a critical case.

PHASE 2 — IMPLEMENTATION (do not start without explicit "go")

After I say "go on Phase 2", begin building Step 3.5 incrementally. Order:

  Step 3.5.A — Build hooks/useMuxPlaybackToken.ts. Test against /api/mux/playback-token. Output: a hook that takes (courseId, videoId), fetches a signed token, handles loading/error/expiry/refresh. NO consumer yet.

  Step 3.5.B — Build components/SignedMuxPlayer.tsx wrapper. Wraps <MuxPlayer>. Uses the hook. Forwards refs. Passes className, metadata, onEnded, streamType through cleanly. Handles legacy public-policy fallback (no token → no playbackToken prop → wrapper acts as bare MuxPlayer). NO consumer yet.

  Step 3.5.C — Build thumbnail token signing. Either extend the existing /api/mux/playback-token endpoint to also return a thumbnailToken in its response (preferred — one round-trip), or build a separate /api/mux/thumbnail-token endpoint. Decide based on which is less invasive to the existing route shape.

  Step 3.5.D — Migrate components/video_uploader.tsx (line ~857) to use SignedMuxPlayer. Test instructor preview on a draft course AND on a published course. Migrate thumbnail at line ~741.

  Step 3.5.E — Migrate components/CoursePreview.tsx (line ~326). Test public free-preview on a published course.

  Step 3.5.F — Migrate components/ui/CoursePlayer.tsx (line ~644). This is the highest-risk migration because of the watermark DOM relocation. Test enrolled student playback. Test fullscreen transitions. Test onEnded firing correctly (saves progress + auto-next).

  Step 3.5.G — Grep the entire codebase for any remaining `image.mux.com` call sites. Migrate each. Common locations: course cards, catalog listings, search results, admin surfaces.

  Step 3.5.H — Flip app/actions/upload_video_actions.ts playback_policy from ["public"] to ["signed"]. This is the only commit that changes Mux's behavior for new uploads. Do this LAST. Do this in its own commit.

Between each substep: stop, summarize what you built, what you tested, what works, what's pending. Wait for me to confirm before moving to the next substep. We are not racing.

If at any substep you discover something that contradicts the migration gotchas in the existing docs, surface it as a blocker before proceeding.

Stop after Phase 1 doc updates. Output the one-line summary per file. Do not start Phase 2 until I say "go on Phase 2".