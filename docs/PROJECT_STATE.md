# Web App — Project State / Changelog

Running log of notable web-app (this repo) changes. The mobile board lives in
`docs/MOBILE_PROJECT_STATE.md`; this file is for the Next.js web app.

---

## 2026-07-01 — Fix React #418 hydration mismatch (pin en-US on number formatting)

Branch: `fix/hydration-locale-digits`. Root cause (diagnosed in the prior
post-batch step): `Number.toLocaleString()` called with **no locale** renders
during SSR of client components on public pages — the Vercel Node server emits
Latin digits (`50,000`) while an Arabic-locale browser emits Arabic-Indic
(`٥٠٬٠٠٠`) → text hydration mismatch → React #418 (production/Arabic-only; invisible
in an en-US dev browser).

### Fix
Pinned `"en-US"` on **every** number `.toLocaleString()` call in the codebase so
digits are always Latin and identical server/client. Purely deterministic — no
value, currency symbol, or suffix (`د.ع` / `IQD`) changed; grouping stays
`50,000`. **72 call sites across 26 files** (`app/`, `components/`, `lib/`);
`grep` confirms 72/72 pinned, 0 unpinned. Primary site: `lib/sectional/displayPrice.ts`
`format()` (the shared price formatter behind every card/detail/catalog price).

Pinned everywhere (not just SSR-reachable sites) for consistency, per the rule
"when unsure whether a call is SSR-reachable, pin it; pinning client-only ones is
harmless." SSR-reachable public sites (the ones that actually caused #418):
`lib/sectional/displayPrice.ts`, `components/CoursePreview.tsx` (course detail),
`components/EnrollButton.tsx`, `components/PackageUpsellBanner.tsx` (home),
`components/sectional/*`, `components/paymentSelector.tsx`. Client-only/auth-gated
sites pinned for consistency: `CourseDashboard`, `WalletBalance` (renders `0` on
SSR anyway), `earnings/*`, `admin-dashboard/*`, `wallet/transactions`,
`DeleteAccountClient`, `quick_course_form`, `SectionListEditor`,
`PackageCheckoutDialog`, plus the `wallet_actions.ts` server-action message string.

Not touched (already deterministic — explicit locale): `toLocaleDateString(...)` /
`Intl.DateTimeFormat(...)` calls, which all pass `"en-US"` / `"ar-SA"` / `"ar-IQ"`.

### Verification
- `npx tsc --noEmit`: no new errors (only the known pre-existing
  `admin/sync-enrollments` + `[courseId]` `params` errors).
- `npm run build`: 54/54 pages.
- Grep proof: 72/72 code `.toLocaleString(` calls pinned to `"en-US"`; 0 unpinned.
  (#418 is Arabic-locale/production-specific, so verification is "every
  SSR-reachable call is pinned," not a local repro.)

---

## 2026-06-30 — Create Course enterable on all screen sizes (Symptom 3)

Branch: `fix/create-course-small-screen-access`. Implements **only** Symptom 3
from `docs/NAV_AND_COURSE_EDITOR_AUDIT.md`. Closes out the nav/course-editor audit
batch (Symptoms 1, 2, 3 now all fixed).

### Root cause
`components/navbar.tsx` `handleCreateCourseClick` was a **small-screen-only**
interstitial: on viewports `< 768px` it ran `e.preventDefault()` + a
`window.confirm()` recommending an iPad/laptop, and **cancelling silently
dead-ended** navigation into the "إنشاء دورة" (Create Course) flow.

### Change (guard-only handler — removed)
Discovery: the handler did nothing but the confirm guard, and the `isMobile`
state + its resize-listener `useEffect` existed solely to feed it. All three
removed (kept commented for reversibility). The "إنشاء دورة" links now navigate
natively via `ProtectedLink`, exactly like every other nav item:
- Desktop link: dropped `onClick={handleCreateCourseClick}` entirely.
- Mobile-menu link: reduced `onClick={(e) => { setOpen(false);
  handleCreateCourseClick(e); }}` to `onClick={() => setOpen(false)}` —
  **preserving** the hamburger-menu close (shared by every other mobile link),
  removing only the guard call.

No screen-size block remains on the Create Course route/form (verified: no
`innerWidth`/`matchMedia` guard in `app/course-upload/*` or the create form;
`/course-upload` was already reachable by direct URL on any viewport). The
unrelated `window.innerWidth < 1024` in `components/ui/CoursePlayer.tsx` is the
video-watching UI, not the create flow.

### Verification
- `npx tsc --noEmit`: no new errors (only the known pre-existing
  `admin/sync-enrollments` + `[courseId]` `params` errors). `noUnusedLocals` off,
  so the now-unused `useEffect`/`Monitor` imports left in `navbar.tsx` don't error.
- `npm run build`: 54/54 pages.
- Manual (owner, narrow viewport): clicking **إنشاء دورة** navigates straight into
  `/course-upload` — **no confirm dialog, no dead-end** — on phone-width screens.

---

## 2026-06-30 — Course covers bypass the Next image optimizer + delete-clear fix

Branch: `fix/course-editor-refresh-bounce` (same branch as Symptom 2; this folds
the cover-editor follow-up). Root cause confirmed in
`docs/COVER_PHOTO_PROPAGATION_AUDIT.md`: on the **Vercel Hobby tier the Next image
optimizer (`/_next/image`) returns HTTP 402** (transformation quota), so every
course cover rendered through `next/image` broke — raw broken icon in the editor
(no `onError`), book placeholder on catalog cards (`onError` fired). The **raw
Firebase Storage download URLs return 200** with real bytes; the bytes and the
persisted URL were never the problem — only the optimizer indirection.

### Step 1 — render course covers with a plain `<img>` (bypass the optimizer)
Course covers/thumbnails ONLY. Each `<Image>` (next/image) replaced with a plain
`<img>` pointing at the raw Firebase URL — zero `/_next/image`, zero
`remotePatterns` dependency, works regardless of deployed config. Visuals
preserved (`fill` → `className="absolute inset-0 h-full w-full object-cover …"`),
`onError` fallbacks kept, `loading="lazy"` added. Old `<Image>` kept commented for
reversibility. Surfaces changed:
- `components/thumb_nail_uploder.tsx` — instructor editor cover preview.
- `components/CoursesCardList.tsx` — **both** card variants (admin + user). This
  one component backs the public catalog (`publicCoursesCardList`), the home grid
  (`HomeCoursesSection`), and the instructor/admin "my courses" lists.
- `components/CoursePreview.tsx` — course detail hero.

Left on `next/image` (out of scope — not course covers): Google avatar
(`user_dashboard/layout.tsx`), ZainCash logo (`paymentSelector.tsx`), Mux video
thumbnails (`SignedMuxThumbnail.tsx`), and the legacy/unused `muti_image_uploader`
(only imported by the unreferenced `ui/property-form.tsx`; the live create flow
uses `quick_course_form`, which renders no remote cover).

### Step 2 — delete cover now clears without a hard refresh
`components/CourseDashboard.tsx` delete handler: the visible editor cover is bound
to the react-hook-form **`image`** field (`ThumbNailUploader image={field.value}`),
not to `course.thumbnailUrl`. 08531b8 cleared `course.thumbnailUrl` (an unrendered
source), so the cover lingered until a hard refresh. Added
`form.setValue("image", undefined)` alongside the existing `setCourse` (kept,
harmless). No `router.refresh()` reintroduced (that is the Symptom 2 bounce).

### Verification
- `npx tsc --noEmit`: no new errors (only the known pre-existing
  `admin/sync-enrollments` + `[courseId]` `params` errors). `noUnusedLocals` is
  off, so the now-unused `Image` imports (left for reversibility) don't error.
- `npm run build`: 54/54 pages.
- **Structural proof** (local `next start`, fresh build): served HTML of `/`
  (catalog cards) and `/course/<id>` (hero) contains raw
  `<img src="https://firebasestorage.googleapis.com/...">` with `0` `data-nimg`
  and no `/_next/image?url=` for covers. (Local optimizer returns 200, so local
  can't reproduce the 402; this check only proves the bypass is in effect.)

### New skill
Extracted `.claude/skills/cover-image-rendering/` capturing the 402 constraint,
the plain-`<img>` rule for covers, the Firebase-Storage cover plumbing, and the
RHF form-field binding gotcha.

---

## 2026-06-30 — Course-editor delete/publish bounce fix (Symptom 2)

Branch: `fix/course-editor-refresh-bounce`. Implements **only** Symptom 2 from
`docs/NAV_AND_COURSE_EDITOR_AUDIT.md` (deleting a cover photo — and publishing /
unpublishing / uploading a cover — bounced the user to `/`). Symptoms 1 and 3
untouched.

### Root cause (not fixed here, by design)
The bounce's true root cause is middleware + `firebaseAuthToken` cookie staleness
mid-session: a client `router.refresh()` re-issues the editor route's RSC request,
which passes through `middleware.ts` and gets redirected to `/` when the cookie
has expired. Per instructions we did **not** touch middleware or the
refresh-token route — instead we removed the client-side `router.refresh()` calls
that re-ran the protected route, so the bounce is impossible regardless of cookie
state.

### Changes — all in `components/CourseDashboard.tsx`
Replaced `router.refresh()` with a local-state update in four handlers. Each old
line is left commented for reversibility.
- **`handleDeleteThumbnail`** (primary reported bug): now
  `setCourse({ ...prev, thumbnailUrl: undefined })`. The server delete already
  persisted `thumbnailUrl=null`; the `ThumbNailUploader` clears the form image
  field itself after `onDelete()` resolves, so the cover disappears immediately.
- **`onImageSubmit`** (cover upload): `setCourse` already set the new URL; added
  `form.setValue("image", { id, url, isExisting: true })` so the form image
  matches a post-refresh state. Dropped the refresh.
- **`handlePublish` / `handleUnPublish`**: local `setCourse({ status })` already
  drove the editor badge; dropped the refresh. The public course page is still
  revalidated server-side via `revalidatePath()` inside `publishCourse` /
  `unpublishCourse`, so no server revalidation is lost.

### Left as `router.refresh()` (flagged, out of scope)
- `SectionListEditor`'s `onSaved={() => router.refresh()}` (~line 1086). It is
  not one of the three audit-named latent spots, and a section save returns
  server-derived data the client does not already hold, so a local-state mirror
  isn't a safe drop-in. Left unchanged; will bounce too on a stale cookie until
  the middleware/cookie root cause is addressed separately.

### Verification
- `npx tsc --noEmit`: no new errors (only the pre-existing `admin/sync-enrollments`
  and `[courseId]` `params` errors). Note `Course.thumbnailUrl` is
  `string | undefined`, so the delete mirror uses `undefined` (the typed
  equivalent of the server's `null`; both falsy to every consumer).
- `npm run build`: compiled successfully, 54/54 pages.
- Behavioral expectation (can't reproduce the original bounce — it only fired on
  a stale cookie; removing the refresh makes it deterministically impossible):
  delete/upload/publish/unpublish update the editor UI immediately and persist on
  a manual reload.

---

## 2026-06-29 — Navigation slowness + jarring skeleton fix (Symptom 1)

Branch: `perf/nav-and-route-loading`. Implements **only** Symptom 1 from
`docs/NAV_AND_COURSE_EDITOR_AUDIT.md`. Symptoms 2 (cover-photo delete bounce)
and 3 (small-screen create-course guard) are intentionally untouched — separate
branches/sessions.

### Step 1 — `NavigationButton` no longer feels laggy
- `components/NavigationButton.tsx`: removed the fixed `setTimeout(..., 1000)`
  fake spinner (it was decoupled from real navigation). The component is now a
  styled, **prefetching** `next/link` instead of `router.push`, and the pending
  spinner is driven by `useLinkStatus` (Next 15.3+) so it reflects the actual
  App Router transition. Old implementation preserved in a trailing comment.
- `app/user_dashboard/createdCourses/page.tsx` and `app/course-upload/page.tsx`:
  dropped the redundant `<Button asChild>` wrapper around `NavigationButton`
  (was nested buttons); the single styled link-button carries the classes.

### Step 2 — route-level loading skeletons (kills the jarring snap)
- Added `app/course-upload/loading.tsx` and `app/admin-dashboard/loading.tsx`
  (segments previously had no `loading.tsx`). Both approximate the destination
  layout (header band + card grid) rather than a bare centered spinner.
- Added `app/user_dashboard/createdCourses/loading.tsx` so that slow grid route
  shows a content-shaped skeleton instead of the global centered spinner in
  `app/user_dashboard/loading.tsx` (left in place for the other sub-routes).

### Step 3 — stop the multi-second blocking stall
- `data/auth-server.ts`: wrapped `getCurrentUser` in React `cache()` to dedupe
  its two Firebase-Auth round-trips across layout + page in one request. Auth
  semantics unchanged (still `verifyIdToken` then `getUser`; the two are a real
  dependency so they remain sequential).
- `components/instructorCourse.tsx`: the independent `searchParams` and
  `cookies()` awaits now resolve concurrently via `Promise.all`. The
  `getCurrentUser → getCourses` dependency chain stays sequential.
- `components/CoursesGridSkeleton.tsx` (new): shared grid skeleton used as a
  `<Suspense>` fallback. Both course-listing pages now wrap `<InstructorCourse>`
  in `<Suspense>`, so the page shell paints immediately and the Firestore-backed
  course list streams in.

### Verification
- `npx tsc --noEmit`: no new errors (only pre-existing `admin/sync-enrollments`
  non-default-export and `[courseId]` non-Promise-`params` errors, unrelated).
- `npm run build`: compiled successfully, 54/54 pages generated.
- Manual route-load check (prod server): `/`, `/login`, `/register` → 200;
  protected routes (`/course-upload`, `/user_dashboard/*`, `/admin-dashboard`)
  → 307 redirect to `/` (expected, no auth cookie); no 500s.

### Flagged / intentionally untouched
- `app/user_dashboard/layout.tsx:147` hydration gate (`if (!auth.isClient)`)
  was **left as-is**. It is a client hydration gate, not the auth gate (auth is
  enforced by middleware), but removing it from a `"use client"` layout risks a
  hydration-mismatch flash and is outside the low-risk envelope of this change.
  Noted for a future pass per audit Symptom 1 root cause #5.
- Admin dashboard's client-side full-collection `onSnapshot` load (audit root
  cause #6) is out of scope here; the new `loading.tsx` only covers the
  navigation/RSC phase, not the post-mount client data load.
- Protected files (`authContext.tsx`, `middleware.ts`, auth form/actions) were
  not modified.
