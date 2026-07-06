# Audit — Phase 3 Format A: student flashcard recall deck

**Status:** audit complete; slices 1–3 of §7 built & verified 2026-07-04
(entry point owner-verified live; playback-route refactor verified
byte-identical with real playback). Slices 4–6 (deck, clip jump, event
logging) pending. **Date:** 2026-07-04.
**Scope:** per-lesson deck of APPROVED Q&A pairs inside the enrolled web
viewer — question → reveal → self-grade (نعم/لا) → "شاهد الشرح" clip jump.
Zero runtime LLM, students read approved pairs only.
**Companions:** `docs/RUBIK_STUDY_FEATURES.md` (§8 constraints, §9 Phase 3),
`docs/AUDIT_QA_REVIEW_UI.md` (Phase 2), the `sectional-invariants` skill.

---

## 0. Blocking prerequisite

**The Phase 3 gate is not met.** Phase 2's gate ("≥1 full course approved by
its instructor") is still open — all 426 imported pairs are `pending`. The
conditional entry point cannot be verified against real data until the owner
approves at least one video's pairs on the pilot course. That approval run is
itself the Phase 2 gate, so it's the natural first step, not a detour.
*Update 2026-07-04:* owner approved the first 15 pilot pairs (14 + 1 across
two Exocad lessons) — enough to verify the entry point; the full-course
Phase 2 gate remains open.

Also filed before-Phase-3-launch in the decision ledger: re-scope the §13 q5
timestamp ship gate (persist `approvalAttested` or accept spot-checks). Not
build scope here, but it is flagged as a pre-launch item.

---

## 1. Where the student lesson view lives

- **Route:** `app/course/[courseId]/page.tsx` (server component). Loads the
  course via `getCourseById`, reads the `firebaseAuthToken` cookie, then
  branches: no/invalid token → `CoursePreview`; admin → `CoursePlayer`
  (line 182); owner → `CoursePlayer` (line 213); enrollment with
  `status === "completed"` (via `getEnrollmentDetails`, lines 198–200) →
  `CoursePlayer` with `accessScope` / `ownedSectionIds` / `enrollment`
  (lines 221–232); otherwise `CoursePreview` + package upsell.
- **Component:** `components/ui/CoursePlayer.tsx`. Course identity is the
  `course` prop; the current lesson is client state `currentVideoIndex` into
  `allVideos` (visible videos grouped by section, lines 184–199). Per-video
  locks use `isVideoLockedForUser` (line 201–208) — UI affordance only; the
  playback-token route stays the source of truth (comment lines 88–91).
  Hidden videos (`isVisible === false`) are filtered out entirely.
- **Token minting** is still inline in CoursePlayer (lines 300–376) — the
  3.5.F migration to `SignedMuxPlayer` is TODO. The deck does NOT depend on
  that migration: it mounts its own `SignedMuxPlayer` (see §4).
- **Natural mount point:** the tab row (lines 966–1002) currently has
  الأقسام (mobile-only) + الملفات. A third tab **"التدريب"** keyed off
  `currentVideo` mirrors exactly how the resources tab works
  (`currentVideoFiles` derives from the active lesson). Alternative: a button
  in the video-controls strip (lines 912–952). **Recommendation: third tab**,
  rendered only when the current video has ≥1 approved pair AND
  `canAccessVideo` is true.
- **Web-first, and deliberately decoupled:** `CoursePlayer` is officially
  throwaway (deleted post-mobile-launch). Build the deck as a standalone
  `components/study/QaStudyDeck.tsx` that CoursePlayer merely mounts, so it
  survives the viewer's deletion and can be re-hosted on a future practice
  route. This effectively closes §13 q2 as **web-first** — record that in
  `RUBIK_STUDY_FEATURES.md` when building. Mobile later gets the additive
  read endpoint the doc already sketches (`GET /api/courses/{courseId}/qa?videoId=`,
  Bearer-auth, standard envelope, same gate) — **not built now**; when it is,
  `docs/MOBILE_API_MIGRATION.md` updates in the same commit.

## 2. Conditional entry point — "does this lesson have approved pairs?"

**No cached count exists.** The transcript doc's `qaCount`
(`scripts/pipeline/import.mts:439`) is the import-time total, not an approved
count. Nothing maintains an `approvedQaCount`, and §7.3 explicitly bans
counters on the course doc (hot document; it already carries `videos[]`).

Options weighed:

| Option | Cost per course-page view | Coupling |
|---|---|---|
| **(a) Count aggregates per video** — `qaCol.where('videoId','==',v).where('status','==','approved').where('stale','==',false).count()`, `Promise.all` over visible videos | ~1 read × N videos (10–15 today; count() bills 1 read/1000 index entries) | none — always fresh |
| (b) One projection query — `.where('status','==','approved').select('videoId')` | 1 read **per approved pair** (~200/course today, grows with corpus) | none |
| (c) Maintained counter — e.g. `courses/{id}/qaMeta/summary` map `{videoId: count}` | 1 read | every status transition must update it: `approvePair`, `bulkApproveVideo`, `rejectPair` (approved→rejected recall), `revokeApproval` in `app/actions/qa_review_actions.ts`, **plus** the importer's migrate stale-marking (`import.mts:429`). Drift risk; contradicts smallest-correct-change |

**Recommendation: (a).** The `.count()` pattern already exists in the repo
(`firebase/service.ts:44`, `app/actions/favorites_actions.ts:142`);
equality-only filters need no composite index; the course page is already an
async server component. Compute `approvedQaCounts: Record<videoId, number>`
server-side and pass it into all three `CoursePlayer` call sites (page lines
182, 213, 223). Revisit (c) only if course-page traffic or video counts make
N reads/view matter.

`stale == false` is a safe equality filter: the importer writes `stale: false`
explicitly on every doc it creates or rejoins (`import.mts:374, 419`), so no
doc lacks the field. Using the same triple predicate for the count and the
deck read keeps them consistent (a migrate can mark an *approved* pair
`stale: true`; students must not see it — `status` filtering alone misses
this).

## 3. Server-side read of approved pairs

New web-only server action (e.g. `app/actions/qa_study_actions.ts` →
`listApprovedQaForStudy(token, courseId, videoId)`), modeled on
`qa_review_actions.ts` (token-as-argument auth, zod at the boundary, typed
error-code union, no `router.refresh()`), but with the **student** gate, not
the owner gate:

- **Gate = the playback-token route's predicate**, currently inline at
  `app/api/mux/playback-token/route.ts:64–209`: owner/admin bypass →
  `isCoursePubliclyVisible` for non-privileged → video exists →
  free-preview grant → completed enrollment (`NOT_ENROLLED`) → sectional
  section-ownership with unset/`"full"` scope + untagged-video grants
  (`SECTION_NOT_OWNED`). §8.1 mandates extracting this into a shared helper
  **in this phase** so playback, study, and future chat cannot drift — the
  route is confirmed to be the only implementation today. The deck is
  per-video, so the gate evaluates once per deck load.
- **Query:** `courses/{courseId}/qa` where `videoId == X`,
  `status == 'approved'`, `stale == false` — never `pending`/`rejected`,
  matching invariant 1. Reads go through the admin SDK (client Firestore
  rules deny all access to `qa` — verified Phase 1, decision ledger).
- **Minimal DTO — nothing else ships to the client:**
  `{ id, question, answer, sourceStartSec, sourceEndSec, videoId,
  hasValidClip }`. `id` is the Firestore doc ID (React key now; the
  normative progress key later). `hasValidClip` is computed **server-side**
  per §8.2: `!(needsReview === true || (sourceStartSec === 0 &&
  sourceEndSec === 0 && avgLogprob === null) || sourceEndSec -
  sourceStartSec > 300)` — so `needsReview`, `avgLogprob`, quarantine class,
  reviewer metadata, hashes, `reviewHistory`, and transcript text never
  reach the student. Sort by `sourceStartSec` asc (lecture order, same as
  the review tab).
- **DECIDED (owner, 2026-07-04): the deck is enrolled-only.** The shared
  helper must NOT grant study access on the free-preview branch — free
  preview keeps playing the video as today, but the practice deck requires a
  genuine completed enrollment (owner/admin bypass stays). Concretely: the
  helper exposes the free-preview grant distinctly (e.g. an
  `allowFreePreview` option, or a returned grant-reason the caller filters),
  the playback route passes it, the study action denies it. This answers
  §13 q1 for Format A only; Phase 4 preview packs revisit it for their own
  surface.

## 4. Clip jump — "شاهد الشرح"

- **Reuse is direct.** `components/SignedMuxPlayer.tsx` +
  `hooks/useMuxPlaybackToken.ts` POST `/api/mux/playback-token` with the
  student's Bearer ID token. The route's non-privileged path mints tokens for
  a **completed enrollment** (route.ts:125–208, grant reasons `enrolled` /
  `sectional_*`) — the instructor-owner bypass used in Phase 2 review is
  just one branch of the same gate, not a separate mechanism. Confirmed: an
  enrolled student's deck mints tokens with no new code.
- **The seek pattern is already proven** in
  `components/qa_review/QaReviewTab.tsx`: ONE `SignedMuxPlayer` mounted per
  video (line 512), ref-based seek `player.currentTime = p.sourceStartSec` +
  `play()` (lines 246–247), `timeupdate` window checks (lines 250–256).
  The deck copies this shape: **one mounted player per deck** (§8.3 — token
  minting is rate-limited 30/user/min and costs `verifyIdToken` + Firestore
  reads; never remount per card), seek on jump, fake-stop at `sourceEndSec`
  via a `timeupdate` listener (client UX only — the token plays the whole
  video for 2 h by design, non-goal 6).
- **Sentinel defense, two layers.** Server: sentinel pairs are unapprovable
  (`approvePair` re-checks the raw 0/0/null triple inside the transaction,
  `qa_review_actions.ts:232–238`), and edits cannot launder one (evidence
  fields are untouched by `editPair`; classification re-runs at approve). So
  no sentinel should ever be `approved`. Client: the deck renders the jump
  button only when `hasValidClip` is true — which also suppresses
  `needsReview` pairs and >5-min spans per §8.2, cases approval legitimately
  allows through. UI copy hedges ("الشرح يبدأ قرب الدقيقة X") and seeks to
  `max(0, sourceStartSec − 15)` pre-roll — never an exact-second promise.
- **No cross-section 403 case in Format A:** the deck is per-lesson and
  pairs cite their own video, so the jump target is always the video whose
  gate the student already passed. Token failures render SignedMuxPlayer's
  shipped retriable placeholder.
- RTL/bidi (§8.5): answers embed Latin terms; timestamps render LTR inside
  RTL sentences (`dir="ltr"` span, as the review tab does at line 562–564).

## 5. Self-grade state

**Recommendation: session-only React state for Format A.** نعم/لا per card
post-reveal (the doc's non-goal 9 bans pre-reveal confidence prompts — the
proposed flow complies), with "لا" cards re-queued in-session. No
persistence, no schema, nothing to migrate later since §7.3 already reserves
`users/{uid}/courses/{courseId}/qaProgress/{qaDocId}` keyed on Firestore doc
IDs — which the DTO exposes, so a later phase persists without reshaping the
deck. (For contrast, the existing progress write is
`progress/{userId}_{courseId}` via `app/actions/progress_actions.ts` — a
whole-array-rewrite pattern NOT to copy for per-card state.)

**DECIDED (owner, 2026-07-04): event logging ships in Format A** — via a
server action only (append-only, to a separate events collection, never the
`qa` subcollection), so students keep zero direct Firestore write access.
Events: `revealed` / `selfGrade` (نعم/لا) / `jumpToSource`, shaped per §7.3
(`{uid, qaDocId, courseId, videoId, kind, grade?, at}`). Rationale: the
analytics seed (Phase 7's rewatch-demand heatmap reads jump-taps) cannot be
backfilled, so it starts now even though nothing reads it yet.

Also noted: the doc's Phase 3 sketch says Again/Hard/Good/Easy (4 grades
feeding FSRS in Phase 5); Format A's binary نعم/لا maps onto Again/Good and
can widen later — fine for Format A, just recorded so Phase 5 isn't
surprised.

## 6. Mobile contract & write surface — confirmed clean

- **Zero `/api/*` impact:** grep of `app/api/` finds no qa references; the
  deck is a web server action + client component. No
  `MOBILE_API_MIGRATION.md` change needed until the mobile endpoint ships.
- **Students cannot write to `qa`:** (a) Firestore rules are deny-all for
  `qa`/`transcripts` to any client SDK (verified with real reads Phase 1 —
  permission-denied for unauthenticated AND signed-in non-admin); (b) the
  only qa write paths are `qa_review_actions.ts` (every action behind
  `authorize()` = course owner or admin, lines 140–166) and the operator-run
  importer; (c) the new study action is read-only and adds no write.
- The count aggregates and deck reads use the admin SDK server-side — no
  rules change.

---

## 7. Proposed build plan (entry point first, per owner)

1. **Prereq (owner, not code):** approve ≥1 video's pairs on the pilot
   course via the Phase 2 tab — closes the Phase 2 gate and gives the entry
   point real data to verify against.
2. **Step 1 — conditional entry point.** `getApprovedQaCounts(courseId)`
   (count aggregates, §2a) wired into `app/course/[courseId]/page.tsx`'s
   three CoursePlayer call sites; "التدريب" tab in CoursePlayer renders only
   when `approvedQaCounts[currentVideo.videoId] > 0 && canAccessVideo`.
   Verify live: tab appears only on the approved lesson(s), absent on
   pending-only lessons and other courses.
3. **Step 2 — shared access helper (§8.1).** Extract the route predicate
   into `lib/courses/videoAccess.ts` (name TBD); refactor
   `app/api/mux/playback-token/route.ts` to call it with **zero behavior
   change**; decide q1 (free-preview branch) here, once. Verify with real
   playback: enrolled, free-preview, sectional-owned, sectional-not-owned,
   owner.
4. **Step 3 — deck.** `listApprovedQaForStudy` (gate + minimal DTO, §3) +
   `components/study/QaStudyDeck.tsx`: card flow, reveal, نعم/لا, "لا"
   re-queue, RTL/bidi per §8.5. Session-only state.
5. **Step 4 — clip jump.** One `SignedMuxPlayer` per deck, ref seek with
   15 s pre-roll + hedged copy, fake-stop at `sourceEndSec`, button gated on
   `hasValidClip`.
6. **Step 5 — event logging (decided IN, §5):** `logStudyEvent` append-only
   server action, wired into reveal, self-grade, and jump taps.
7. **Docs in the same commits:** record q1/q2 decisions in
   `RUBIK_STUDY_FEATURES.md` (§12/§13), update `PROJECT_STATE.md`. No mobile
   doc change (no `/api/*` change).

**Verification discipline** (no tests, lenient build): `npm run lint` +
`npx tsc --noEmit`, then a real study session on the pilot course — real
token mint as an enrolled (non-owner) test account, real clip jump, real
sectional-locked lesson showing no tab.
