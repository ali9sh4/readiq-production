# Course Approval, Publishing & the Admin Dashboard

Canonical doc for how a course goes from "instructor created it" to "the public
can see and buy it", and how the admin dashboard drives that. Read this before
touching `app/admin-dashboard/*`, `lib/courses/visibility.ts`, `publishCourse` /
`approveCourse`, or any catalog/playback access predicate.

Public brand is **Rubik**; "Readiq" is the internal codename.

---

## TL;DR — the dual gate

A course becomes **publicly visible** only when **two independent gates** are both
satisfied:

| Gate | Field(s) | Who controls it | Set by |
|------|----------|-----------------|--------|
| **Publish gate** | `status === "published"` | The **instructor** (or admin) | `publishCourse()` |
| **Approval gate** | `isApproved === true` (and `isRejected !== true`) | An **admin only** | `approveCourse()` |

Plus the course must not be soft-deleted (`isDeleted !== true`).

These two axes are **completely orthogonal**:

- An instructor can publish a course **immediately**, with no approval. It just
  stays invisible to the public until an admin approves it.
- An admin can approve a course while it's still a draft. It stays invisible
  until the instructor publishes it.
- Rejecting an already-published course makes it invisible **without** changing
  its `status` — the publish flag stays `published`, the approval flag flips it off.

The canonical predicate is in **`lib/courses/visibility.ts`**:

```ts
export function isCoursePubliclyVisible(c): boolean {
  return (
    c.status === "published" &&
    c.isApproved === true &&
    c.isRejected !== true &&
    c.isDeleted !== true
  );
}
```

---

## The course lifecycle

```
                 instructor                         admin
                 ──────────                         ─────
  create  ─────────────────────────────────────────────────────────►
  status: "draft"                          isApproved: false
  isApproved: false                        isRejected: false
  isRejected: false                        (appears in admin "pending" queue
  isDeleted: false                          the moment it is created)

  publishCourse() ──► status: "published"  approveCourse(true) ──► isApproved: true
  (requires title,                          approveCourse(false, reason) ──►
   category, price,                          isRejected: true + rejectionReason
   ≥1 video)                                resetCourseStatus() ──► back to pending

         └──────────────► PUBLICLY VISIBLE ◄──────────────┘
                   (needs published AND approved)

  softDeleteCourse() ──► isDeleted: true, status: "archived"  (hidden everywhere)
       └─ restoreDeletedCourse() ──► isDeleted: false, status: "draft"
       └─ permanentlyDeleteCourse() ──► irreversible cascade delete
```

### 1. Creation (instructor) — `app/course-upload/action.ts`
`SaveNewProperty` / `SaveQuickCourseCreation` write the initial doc with:
`status: "draft"`, `isApproved: false`, `isRejected: false`, `isDeleted: false`,
`deletionStatus: "none"`, `createdBy: <uid>`.

There is **no explicit "submit for review" step.** A course is "pending" purely
because `!isApproved && !isRejected` — which is true from the instant it's created.
The admin **pending** queue is approval-state-only and therefore includes drafts
the instructor hasn't published yet.

### 2. Publish (instructor or admin) — `publishCourse()` in `app/actions/basic_info_actions.ts:250`
- Auth: owner (`createdBy === uid`) **or** admin.
- Completeness check: must have ≥1 video, a title, a category, and a price —
  else returns `"الدورة غير مكتملة..."`.
- Sets `status: "published"`, `publishedAt`. **Does not touch approval flags.**
- Runs through `assertCourseMutationAllowed` (the sectional lock).
- `unpublishCourse()` reverses status back to draft; it does **not** reset approval.
- Uploading a file auto-sets `status: "complete"` (an intermediate state,
  independent of publishing).

### 3. Approve / reject (admin) — `approveCourse()` in `app/admin-dashboard/action.ts:10`
- Auth: `verifyIdToken(token).admin === true` only.
- **Approve** (`approve = true`): `isApproved: true`, `isRejected: false`,
  `approvedAt`, `approvedBy: <admin uid>`, clears `rejectionReason`.
- **Reject** (`approve = false`, optional `reason`): `isApproved: false`,
  `isRejected: true`, `rejectedAt`, `rejectionReason: reason`.
- Both run through `assertCourseMutationAllowed` (sectional courses with
  enrollments may be locked from mutation — see the sectional-invariants skill).
- `resetCourseStatus()` (`action.ts:77`) clears all approval fields back to the
  pending state — the "undo" for an approval/rejection.
- `getCourseStats()` (`action.ts:138`) returns `{ total, pending, approved, rejected }`
  counts, admin-gated.

---

## The admin dashboard — `app/admin-dashboard/page.tsx`

A single `"use client"` page with **five tabs**, all driven by real-time Firestore
`onSnapshot` listeners:

| Tab (AR) | Meaning | Source filter |
|----------|---------|---------------|
| قيد المراجعة | **Pending** | `!isApproved && !isRejected` |
| معتمدة | **Approved** | `isApproved === true` |
| مرفوضة | **Rejected** | `isRejected === true` |
| طلبات الإيداع | **Wallet top-up requests** | `topup_requests` where `status == "pending"` |
| محذوفة | **Deleted** | `courses` where `isDeleted == true` |

Per-tab actions:
- **Pending:** Approve / Reject (with reason prompt) / View / Edit.
- **Approved:** Reject / View / Edit (lets an admin pull a live course).
- **Rejected:** Approve (re-approve) / View / Edit.
- **Deleted:** Restore (→ draft) / Permanent delete (cascade) / View.
- **Top-ups:** Approve / Reject — these call `approveTopupRequest` /
  `rejectTopupRequest` from `app/actions/wallet_actions.ts`, a separate subsystem
  (wallet credits), not course approval.

Statistics cards at the top show pending / approved / rejected / top-up / deleted
counts. The rejection reason is rendered inline on each rejected course card.

> Note: the dashboard uses native `confirm()` / `prompt()` / `alert()` for
> approve/reject flows — quick and functional, not a polished modal UX.

---

## Admin access control

Three layers, in order of authority:

1. **Middleware (the real gate)** — `middleware.ts`. `/admin-dashboard/*` is in
   the page-route matcher. It verifies the `firebaseAuthToken` cookie against
   Google JWKS, and if `payload.admin` is falsy it **redirects non-admins to `/`**.
   It also sets the `x-user-admin` request header for downstream handlers.
2. **Server actions re-verify** — every admin mutation
   (`approveCourse`, `resetCourseStatus`, top-up, package, payout, deletion
   actions) independently calls `adminAuth.verifyIdToken(token)` and checks the
   `.admin` claim (some helpers also accept an `FIREBASE_ADMIN_EMAIL` match).
   Never trust the client for admin state.
3. **Client context** — `context/authContext.tsx` exposes `isAdmin` for UI only.

**How a user becomes an admin:** there is **no promotion UI**. The admin claim is
granted automatically at token refresh (`context/actions.ts`) when the user's
email matches the `FIREBASE_ADMIN_EMAIL` env var. Revoking that env var only takes
effect on the user's next login/refresh.

> `app/admin-dashboard/layout.tsx` is a plain layout wrapper with **no guard** of
> its own — middleware is the sole blocker. Don't rely on the layout for security.

---

## Where the gate is (and isn't) enforced

The dual-gate is enforced at **every read surface that matters**, but via two
different code paths — be aware of the divergence:

- **Public catalog** (`app/page.tsx`, `components/publicCoursesCardList.tsx`,
  `components/userCourses.tsx`) passes `status: "published"`, `isApproved: true`,
  `isRejected: false` as filters into `getCourses()` (`data/courses.ts`), which
  also defaults `isDeleted == false`. **It does not call `isCoursePubliclyVisible`.**
- **REST API** — `GET /api/courses` (via `getCourses`), `GET /api/courses/[courseId]`,
  `POST /api/enrollments`, and `POST /api/me/favorites` **do** call
  `isCoursePubliclyVisible`.
- **Single course page** (`app/course/[courseId]/page.tsx`) has **no** approval/status
  gate itself — it gates on admin / owner / `enrollment.status === "completed"`.
- **Mux playback-token route** (`app/api/mux/playback-token/route.ts`) is the real
  per-video gate: owner/admin bypass; everyone else must pass
  `isCoursePubliclyVisible` **then** enrollment (or `isFreePreview`). This is the
  sectional access gate — see the sectional-invariants skill.

**Net effect:** an unapproved/unpublished course can't be discovered, can't be
enrolled in, and its videos won't play for the public — even though the bare
course page component will render for someone who deep-links to it.

---

## Deletion lifecycle — `app/actions/course_deletion_action.ts`

Soft-delete → restore-or-permanent, surfaced in the dashboard "deleted" tab.

- **`softDeleteCourse`** — owner or admin. Sets `isDeleted: true`,
  `deletedAt`, `deletedBy`, and locks `status: "archived"`. Hidden everywhere
  (catalog defaults to `isDeleted == false`; `getById` returns null). Runs the
  sectional lock.
- **`restoreDeletedCourse`** — **admin only**. Requires `isDeleted === true`.
  Always restores to `status: "draft"` (regardless of pre-deletion status), so the
  instructor must re-publish — and it remains subject to the approval gate.
- **`permanentlyDeleteCourse`** — **admin only**, **irreversible**. Requires the
  course already be soft-deleted. Cascades: deletes Mux assets, R2 files,
  thumbnail, all enrollments, all favorites, then the course document. The UI
  shows a hard confirmation listing the counts to be destroyed.

---

## Known gaps / sharp edges (verify before relying)

These were observed during the audit; treat as "things to check", not guarantees.

- **Two visibility code paths.** The catalog filters in `getCourses()` and the
  `isCoursePubliclyVisible` helper are maintained separately. Change one, change
  both — or they drift. (`getCourses` uses `isRejected === false`; the helper uses
  `isRejected !== true` — a difference only for `undefined` values.)
- **Enrolled-user / favorites read endpoints** (`GET /api/me/enrollments`,
  `GET /api/me/favorites`) filter only `isDeleted` — they do **not** re-check
  approval/publish. A user who enrolled or favorited before a course was
  unpublished/rejected may still see it in their lists (playback still gated by
  the Mux token route, so content isn't exposed).
- **Sitemap** (`app/sitemap.ts`) filters `status === "published"` and `isDeleted`
  only — it omits the approval check, so an unapproved-but-published course could
  be emitted to search engines.
- **`deletionStatus`** has type hints for `"requested"`/`"rejected"` (an
  instructor-deletion-request flow) that are **not implemented** — only
  `"none"`/`"approved"` are used today.

---

## File map

| Concern | File |
|---------|------|
| Visibility predicate (canonical) | `lib/courses/visibility.ts` |
| Approve / reject / reset / stats | `app/admin-dashboard/action.ts` |
| Admin dashboard UI (5 tabs) | `app/admin-dashboard/page.tsx` |
| Instructor publish / unpublish | `app/actions/basic_info_actions.ts` |
| Course creation (initial state) | `app/course-upload/action.ts` |
| `status` transitions helper | `app/course-upload/action.ts` (`updateCourseStatus`) |
| Deletion lifecycle | `app/actions/course_deletion_action.ts` |
| Per-video access gate | `app/api/mux/playback-token/route.ts` |
| Public catalog query | `data/courses.ts` (`getCourses`, `getById`) |
| Admin route gating | `middleware.ts`, `context/actions.ts` |
| Sectional mutation lock | `lib/courses/assertCourseMutationAllowed.ts` |

## Related docs / skills
- `sectional-invariants` skill — the access/lock invariants the approval flow
  must not violate.
- `docs/INSTRUCTOR_PAYOUTS.md` — earnings recorded on sale (separate from approval).
- `docs/MOBILE_API_MIGRATION.md` — the REST contract that mirrors these gates.
</content>
</invoke>
