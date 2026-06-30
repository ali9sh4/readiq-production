# Nav & Course-Editor UX/Perf Audit

**Scope:** Audit only — no code was changed. Three instructor/admin web bugs, each investigated to its real root cause (actual lines, not guesses) with fix options proposed but **not** implemented.

**Date:** 2026-06-29
**Surfaces:** Next.js 15 App Router, React 19, Firebase client + admin, cookie-based middleware auth.

---

## Symptom 1 — Navigation is slow and the skeleton is jarring

**Reported behavior:** Clicking a nav button shows a skeleton abruptly; the page takes several seconds to become interactive; the nav buttons themselves feel laggy/unclickable.

### Click-to-interactive path (one transition)

`app/layout.tsx:136` mounts the client `AuthProvider` around `Navbar` + all `children` + `Footer` on every page. Inside `/user_dashboard/*` a **second client-component layout** (`app/user_dashboard/layout.tsx`) renders the sidebar, and one shared `loading.tsx` spinner covers every sub-route. The multi-second stall is the destination Server Component doing **sequential** Firebase-Auth + Firestore awaits while that spinner is shown. A separate `NavigationButton` adds an artificial fixed 1-second spinner on top.

### Root causes (exact lines)

1. **Sequential blocking awaits on the destination route — the real multi-second delay.**
   `app/user_dashboard/createdCourses/page.tsx` (and `app/course-upload/page.tsx`) render `<InstructorCourse>` (`components/instructorCourse.tsx`), a Server Component that awaits **serially**:
   - `instructorCourse.tsx:20` `await searchParams`
   - `instructorCourse.tsx:22` `await cookies()`
   - `instructorCourse.tsx:29` `await getCurrentUser({ token })` — which itself does **two sequential** Firebase-Auth network calls: `data/auth-server.ts:6` `adminAuth.verifyIdToken(token)` **then** `:14` `adminAuth.getUser(...)`.
   - `instructorCourse.tsx:38` `await getCourses(...)` — a Firestore `orderBy("updatedAt")` query.

   That is four serial awaits, two of them auth round-trips that could be one, all blocking route render behind the spinner. `/user_dashboard/page.tsx:40-45` has the same shape (one `verifyIdToken` then three parallel Firestore reads).

2. **A single coarse `loading.tsx` produces the jarring snap.**
   The only `loading.tsx` in the app is `app/user_dashboard/loading.tsx` — a `min-h-[60vh]` centered spinner. It sits at the `user_dashboard` segment, so **every** sub-route navigation hard-swaps the dense `<main>` content (`layout.tsx:192`) for an empty full-height spinner with no transition. The sidebar persists; only the content area snaps. `admin-dashboard` and `course-upload` have **no** `loading.tsx` at all, so those navigations show no route skeleton and instead block silently until the server resolves.

3. **`NavigationButton` forces a fixed 1000 ms spinner and skips prefetch.**
   `components/NavigationButton.tsx:30-43`: `handleClick` calls `router.push(href)` (not a prefetchable `<Link>`) and then `setTimeout(() => setIsLoading(false), 1000)` — the spinner is held for a flat second regardless of whether navigation finished. Used by the "إضافة دورة جديدة" buttons at `createdCourses/page.tsx:54` and `course-upload/page.tsx:54`. This is the direct cause of the "laggy/unclickable" feel on those buttons.

4. **No `prefetch` anywhere.** A repo-wide search for `prefetch` returns nothing — no link sets `prefetch={false}`, but none enables it either. Default prefetch is **disabled in `npm run dev`**, so if the slowness is observed in dev every click is a cold server round-trip. (In production the default is on for `<Link>`, but `NavigationButton` uses `router.push` and never benefits.)

5. **Hydration gate delays first interactivity.** `app/user_dashboard/layout.tsx:147-153` returns a spinner while `!auth.isClient`. `auth.isClient` only flips true in an authContext `useEffect` after mount (`authContext.tsx:39-41`). The entire dashboard layout is `"use client"`, so the sidebar, `Tabs`, `Avatar`, `next/image`, lucide icons, and `NavigationButton` are all in the client bundle and gated behind that hydration spinner.

6. **Admin route loads the whole `courses` collection client-side.** `app/admin-dashboard/page.tsx` is `"use client"` (1000+ lines) and mounts three `onSnapshot` realtime listeners on mount (one over the entire `courses` collection, `orderBy("createdAt","desc")`, lines ~52-58), showing a "جاري التحميل..." text block until done. No loading boundary; slowness here is client-side.

### authContext is NOT the per-navigation culprit (checked)
`context/authContext.tsx` registers `onAuthStateChanged` once (`:73-109`, deps `[isClient, router]`, both stable) — it does **not** refetch on route change. It does rebuild its context value object unmemoized each render (`:199-211`), so consumers re-render whenever any auth field changes, but that is triggered by auth events, not navigation. The per-nav auth cost is indirect: the hydration gate (#5) and each server page independently re-verifying the token (#1).

### Severity & nature
**High severity, mostly structural** (data-fetch architecture), with **two quick wins** embedded.
- Quick wins: remove the artificial 1000 ms timeout in `NavigationButton` (#3); add `loading.tsx` to `course-upload` / `admin-dashboard` and make the dashboard skeleton mirror content shape (#2).
- Structural: collapse the serial auth chain and parallelize/cache reads (#1).

### Fix options (not implemented)
- **Option A (targeted, low-risk):** (a) In `NavigationButton`, drop the `setTimeout(...,1000)` and either clear loading on route change or replace the component with a plain prefetchable `<Link>`. (b) Collapse `data/auth-server.ts` to a single `verifyIdToken` and read custom claims off the decoded token instead of a second `getUser` call. (c) Replace the single coarse `user_dashboard/loading.tsx` with per-route skeletons that match content layout (cards/sidebar) to kill the snap, and add `loading.tsx` to `course-upload` and `admin-dashboard`.
- **Option B (structural):** Move the dashboard layout off `"use client"` / the `isClient` hydration gate so the shell renders on the server (read auth from the request headers the middleware already sets — `x-user-id`, etc.), and introduce Suspense boundaries around the data-heavy `InstructorCourse` so the shell paints instantly while data streams. Migrate the admin dashboard off the full-collection `onSnapshot` to a paginated server fetch.

---

## Symptom 2 — Deleting the cover photo bounces to the home page

**Reported behavior:** In the course editor, deleting the cover (thumbnail) photo sends the user back to `/` instead of staying in the editor.

### Confirmed root cause
The delete **succeeds and does not redirect**. The bounce is the `router.refresh()` fired after a successful delete: it re-issues an RSC request for the current `/course-upload/edit/[courseId]` route, that request passes through `middleware.ts`, and when the `firebaseAuthToken` cookie is stale/expired the middleware redirects to `/`.

### The full chain (exact lines)

1. **Delete button → parent handler.** Existing cover is marked `isExisting: true` (`CourseDashboard.tsx:188-194`), so the X button routes through `components/thumb_nail_uploder.tsx:149-152`: `if (image.isExisting && onDelete) { await onDelete(); ... }`. `onDelete` is wired to `handleDeleteThumbnail` at `CourseDashboard.tsx:1134`.

2. **After success → `router.refresh()`.** `components/CourseDashboard.tsx:343-350`:
   ```
   const result = await DeleteThumbnail(course.id, token);
   if (result.success) {
     toast.success("تم حذف صورة الغلاف بنجاح!");
     await new Promise((resolve) => setTimeout(resolve, 100));
     router.refresh();   // line 350 — the trigger
   }
   ```

3. **The server action does not navigate.** `app/course-upload/action.ts:387-473` `DeleteThumbnail` only deletes the Storage object and sets `thumbnailUrl: null` (`:440-462`), returning `{ success: true }`. No `redirect()`, `revalidatePath`, or `notFound()`.

4. **`router.refresh()` re-runs the route through middleware → `/`.** `middleware.ts` matcher includes `/course-upload/:path*` (`:97`). With a stale cookie it redirects to `/` via any of:
   - `middleware.ts:42-43` — missing token → `redirect("/")`.
   - `middleware.ts:59-78` — `jwtVerify` throws on an expired/invalid token → catch → `redirect("/")` (`:78`).
   - `middleware.ts:47-57` — token within 300 s of expiry → redirect to `/api/refresh-token?redirect=...`, which itself falls back to `/` if the refresh cookie is missing (`app/api/refresh-token/route.ts:11-12`) or the refresh fetch fails (`:62-64`).

   The `firebaseAuthToken` cookie has a 1-hour `maxAge` (`route.ts:50`). During a long edit session the cookie expires while the **client** SDK token (`auth.user.getIdToken()` used by the action) stays fresh — so the delete succeeds, but the follow-up `router.refresh()` hits middleware with a dead cookie and bounces to `/`. Recent commit `0227f90` ("stop long-session listener freeze") confirms long-session auth staleness is a live problem in this codebase.

### Ruled out (with evidence)
- **Page-level guard:** `app/course-upload/edit/[courseId]/page.tsx:36-37` only throws `if (!Course)`. The course still exists after delete (only `thumbnailUrl` nulled), and on throw it renders an **inline** error block (`:70-86`) — never a redirect.
- **Error boundary:** the file is misnamed `erro.tsx` (`app/course-upload/edit/[courseId]/erro.tsx`), not `error.tsx`, so Next.js never registers it as a boundary — and it contains no redirect anyway.

### Same latent bug elsewhere
The identical `router.refresh()`-after-success pattern is in `onImageSubmit` (`CourseDashboard.tsx:316`), `handlePublish` (`:379`), and `handleUnPublish` (`:412`). All bounce identically once the cookie is stale; deleting the cover is just where it was noticed.

### Severity & nature
**High severity (data-loss-adjacent UX: user is ejected mid-edit), structural-ish.** The trigger line is trivial, but the real fix is the cookie/session staleness that makes any `router.refresh()` on a protected route unsafe mid-session.

### Fix options (not implemented)
- **Option A (local, quick):** After a successful mutation, update local state instead of `router.refresh()` — `handleDeleteThumbnail` already has `setCourse`/`form.reset` available, so set `thumbnailUrl: null` in state (mirroring how `handlePublish` does `setCourse(prev => ...)`) and skip the route refresh entirely. Removes the middleware round-trip and the bounce. Apply the same to the other three call sites.
- **Option B (root, structural):** Fix client-cookie staleness so `router.refresh()` is always safe: proactively refresh the `firebaseAuthToken` cookie before it expires (the authContext interval at `authContext.tsx:44-70` refreshes the SDK token but the cookie write path can lag), and/or make middleware treat a near-expiry cookie on RSC/refresh requests by transparently refreshing rather than redirecting to `/`. This also resolves the latent bounces in publish/unpublish/image-upload.

---

## Symptom 3 — Small-screen constraint blocks the "إنشاء دورة" (Create Course) flow

**Reported behavior:** A guard blocks/breaks entering the Create Course flow on small screens.

### Confirmed location — it's a navbar `window.confirm` interstitial, not a route guard
There is exactly **one** screen-size guard, and it lives in the **navbar**, gating the link click — not in the course-upload route or form.

**File:** `components/navbar.tsx`

1. **Mobile detection (`:13-23`)** — breakpoint `< 768px` (Tailwind `md`):
   ```
   const [isMobile, setIsMobile] = useState(false);
   useEffect(() => {
     const checkMobile = () => { setIsMobile(window.innerWidth < 768); };
     checkMobile();
     window.addEventListener("resize", checkMobile);
     ...
   }, []);
   ```

2. **The guard handler (`:25-35`)** — fires `e.preventDefault()` and a blocking confirm when `isMobile`:
   ```
   const handleCreateCourseClick = (e: React.MouseEvent) => {
     if (isMobile) {
       e.preventDefault();
       const confirmed = window.confirm(
         "💡 للحصول على أفضل تجربة في إنشاء الدورات، يُنصح باستخدام جهاز iPad أو كمبيوتر محمول.\n\nهل تريد المتابعة على الهاتف؟"
       );
       if (confirmed) { window.location.href = "/course-upload"; }
       // if NOT confirmed → nothing happens; navigation stays blocked
     }
   };
   ```

   Wired at both entry points: desktop link `onClick={handleCreateCourseClick}` (`:105`) and mobile-menu link `onClick={(e) => { setOpen(false); handleCreateCourseClick(e); }}` (`:161-164`).

### Exact condition / breakpoint
- Trigger: `window.innerWidth < 768` (the Tailwind `md` breakpoint).
- Below 768px, clicking "إنشاء دورة": cancels the normal `ProtectedLink` navigation (`e.preventDefault()`), shows a confirm recommending an iPad/laptop, and **only** navigates if the user clicks OK. If they cancel, navigation is **silently blocked** — the reported symptom.
- Note: when confirmed, it uses `window.location.href` (a full page reload, not client navigation) — slower than the rest of the app's client routing.

### No other guards
`app/course-upload/page.tsx`, `app/course-upload/new/page.tsx`, `app/course-upload/new/new-property-form.tsx`, and the create form itself have **no** `innerWidth`/`matchMedia`/"larger screen" guard — only cosmetic `sm:`/`lg:` Tailwind classes. The route `/course-upload` is therefore reachable directly by URL on any screen size; the only constraint is this navbar confirm. (`Monitor` is imported at `navbar.tsx:4` but unused.)

### Severity & nature
**Low–medium severity, quick fix.** It is a single intentional interstitial; the bug is that "Cancel" silently dead-ends and that it uses a hard reload.

### Fix options (not implemented)
- **Option A (keep the nudge, fix the dead-end):** Always navigate to `/course-upload` (let the link proceed) and show the iPad/laptop recommendation as a non-blocking dismissible banner on the create page for small screens, instead of `preventDefault` + `window.confirm`. Replace `window.location.href` with client navigation (`router.push`) so it stays in-app.
- **Option B (remove the guard):** If the create form is in fact usable on phones, delete `handleCreateCourseClick` and its wiring entirely and let `ProtectedLink` navigate normally. The existing `PhoneNudgeBanner` (already rendered on the edit page, `app/course-upload/edit/[courseId]/page.tsx:61`) could surface the same advice without blocking.

---

## Shared causes across symptoms

- **`middleware.ts` + cookie/session staleness is implicated in both Symptom 1 and Symptom 2.** Every protected-route navigation and every `router.refresh()` re-runs the cookie verification in `middleware.ts`; a near-expiry or dead `firebaseAuthToken` cookie either adds a refresh round-trip (slowness — Symptom 1) or redirects to `/` (the editor bounce — Symptom 2). A robust cookie-refresh strategy would improve both. The `authContext.tsx` token-refresh interval (`:44-70`) and recent commit `0227f90` show this session-staleness area is already known-fragile.
- **`components/navbar.tsx` owns both Symptom 3 and part of the "laggy nav" feel in Symptom 1** — it is a `"use client"` component subscribed to `useAuth` and to `window.resize`, and it hosts the blocking `window.confirm` for create-course.
- **`NavigationButton` is purely a Symptom 1 contributor** (artificial 1 s spinner, `router.push` without prefetch) and is not shared with the others.
