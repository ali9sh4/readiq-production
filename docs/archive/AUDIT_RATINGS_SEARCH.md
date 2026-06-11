# Audit — Ratings & Search (current state)

> **SUPERSEDED (2026-06-10).** Planned item (1) shipped in `d87dea0` — the
> fabricated star (and its `studentsCount` "(0)" count) was removed from cards,
> course detail, and the homepage, so the RATINGS render-site tables below
> describe deleted code. Items (2) rating collection and (3) real catalog
> search remain unbuilt (see the Phase 8 backlog in
> `docs/MOBILE_PROJECT_STATE.md`). The SEARCH findings were accurate as of
> 2026-06-08 but are unmaintained here.

Read-only audit. No code changed. Captures the state of star ratings and
course search across web + mobile **before** the planned work:
(1) hide stars on courses with < 10 ratings, (2) maybe build rating
collection, (3) bring mobile search to web parity.

Date: 2026-06-08 · Branch: `main` · Scope: web repo + mobile API contract.

---

## TL;DR

- **The star value is fake.** Every star number on the site is the hardcoded
  fallback `4.7` (cards/detail) or `4.9` (homepage platform stat). No code
  ever writes a `rating` field, so `course.rating` is `undefined` for all
  courses and the `|| 4.7` fallback always wins.
- **The "(N)" count is the wrong field and also always 0.** The number in
  parentheses next to the star is `studentsCount`, **not** `ratingCount`.
  `studentsCount` is never written anywhere either → always `0` → renders
  `(0)`. The detail page even labels this count "تقييم" (ratings) while
  feeding it `studentsCount`.
- **`ratingCount` exists but is dead.** The field is declared on the `Course`
  type and passed through 3 API responses, but is **rendered nowhere** and
  **written nowhere**.
- **There is no student rating write path.** No component, server action, or
  API route lets a student submit a rating. Confirmed absent.
- **No aggregate fields exist.** No `ratingSum`, `ratingAverage`, or any
  per-star breakdown on the course doc. Only flat `rating?: number` and
  `ratingCount?: number`, neither populated.
- **Web search is a client-side filter** over the **first 20** server-loaded
  courses only. Not debounced; no Arabic diacritic/alef normalization.
- **Mobile has no search today.** The API has no search param (documented as a
  deferred Algolia task). Mobile loads courses via `GET /api/courses`.

---

## RATINGS

### 1. Where the star value comes from

There are **two** course-level render sites and **one** platform-level
hardcode. All resolve to a constant — none read a real aggregate.

| Render | File:line | Expression | Resolves to |
|---|---|---|---|
| Course card | `components/CoursesCardList.tsx:330` | `{rating.toFixed(1)}` where `rating = course.rating \|\| 4.7` (defined `:105`) | **`4.7`** (course.rating never set) |
| Detail page | `components/CoursePreview.tsx:268` | `{course.rating?.toFixed(1) \|\| "4.7"}` | **`4.7`** |
| Homepage platform stat (×2) | `app/page.tsx:168`, `app/page.tsx:227` | literal `4.9` | **`4.9`** (hardcoded, not course-level) |

**It is a hardcoded default, not a real aggregate and not a seed.** The
`rating` field is read from Firestore (`c.rating ?? null`) in the API layer,
but no code path in the repo ever writes it. A full-repo grep for `rating`
across `**/*.{ts,tsx}` returns only: the type declaration, the three API
read-mappings, and the two render sites above — **zero writes**. So unless a
course doc was hand-edited in the Firestore console, `course.rating` is
`undefined` and the `4.7` fallback is what every user sees.

### 2. What feeds the "(N)" count next to the star

It is a **different field from the star**, and a semantically wrong one:

| Render | File:line | Count expression | Field used |
|---|---|---|---|
| Course card | `components/CoursesCardList.tsx:334` | `({studentsCount.toLocaleString()})` where `studentsCount = course.studentsCount \|\| 0` (`:106`) | **`studentsCount`** |
| Detail page | `components/CoursePreview.tsx:283` | `({(course.studentsCount \|\| 0).toLocaleString()} تقييم)` | **`studentsCount`** (labelled "تقييم"/ratings) |

- The count is **`studentsCount`, not `ratingCount`.** The correct-sounding
  field (`ratingCount`) is never used in any render.
- `studentsCount` is **never written** anywhere in the repo (grep: only reads
  in `CoursesCardList`, `CoursePreview` `:283/:291/:810`, and a sort key in
  `FavoriteClient.tsx:90`; the type decl; no writes). → always `0` → renders
  `(0)`.
- Note `enrollmentCount` is a **separate, real** field that *is* populated by
  enrollment flows and is rendered independently on the card
  (`CoursesCardList.tsx:320-324`, "طالب مسجل"). Don't confuse it with
  `studentsCount`.

### 3. Exact Firestore fields for rating on the course doc

Declared on the `Course` type (`types/types.ts:105-108`):

```ts
rating?: number;        // flat average; NEVER written by any code path
ratingCount?: number;   // count; NEVER written; NEVER rendered
enrollmentCount?: number; // real, written by enrollment flow (NOT a rating field)
studentsCount?: number;   // NEVER written; used as the "(N)" next-to-star count
```

- **There is no rating sum/average aggregate pair.** No `ratingSum`,
  `ratingAverage`, `ratingTotal`, or per-star histogram exists. Just the flat
  `rating` and `ratingCount` above.
- Both rating fields are **optional and unpopulated** — in practice they do
  not exist on real course documents (no create/update writes them).

### 4. Student rating write path

**None.** Confirmed absent:

- No rating-submission component (no star-picker / review form anywhere).
- No server action writes `rating`/`ratingCount` (`app/actions/*` grep: no
  matches beyond an unrelated comment).
- No API route writes ratings (`app/api/*` grep: only the read-mappings).
- No `FieldValue.increment` / transaction touching a rating field.

To build rating collection, all of: a write surface (action or `/api/*`
route), the aggregate fields, and the read path would be net-new.

### 5. Every render site that shows a star rating

| # | Surface | File:line | What it shows |
|---|---|---|---|
| 1 | Course card (incl. **search results** — search reuses this card) | `components/CoursesCardList.tsx:330` (number), `:332` (Star icon), `:334` (count) | `4.7` ★ `(0)` |
| 2 | Course **detail** page header | `components/CoursePreview.tsx:268` (number), `:271-280` (5 Star icons, filled by `Math.floor(course.rating \|\| 4.7)`), `:283` (count) | `4.7` ★★★★★ `(0 تقييم)` |
| 3 | Homepage hero stat (platform) | `app/page.tsx:168` | literal `4.9 ★` |
| 4 | Homepage stats grid (platform) | `app/page.tsx:227` | literal `4.9` |

Notes:
- **Search results have no separate render** — `HomeCoursesSection` feeds
  filtered courses into `CoursesCardList`, so site #1 covers search results.
- `components/publicCoursesCardList.tsx` renders **no** star (grep: no
  matches) — it's a different list card.
- Sites #3/#4 are **platform-level hardcodes**, not course ratings; mentioned
  only because they're visible star/number pairs that say "4.9".

### 6. Is rating gated by enrollment anywhere?

**No.** Both course-level render sites (#1 card, #2 detail) draw the star
unconditionally — no enrollment/auth check guards the rating display. The
detail-page header stats row (`CoursePreview.tsx:264-294`) renders for any
visitor.

### Implication for "hide stars below 10 ratings"

With no real `ratingCount` ever written, a naive `ratingCount >= 10` gate
would hide the star on **every** course (all are `undefined`/`0`). The gate
can't become meaningful until rating collection populates a real count. Until
then, the planned change effectively removes the (fake) star everywhere —
which may in fact be the desired interim behavior, but should be a conscious
decision. Also decide whether the gate reads `ratingCount` (currently the
intended-but-dead field) vs `studentsCount` (the field actually wired to the
on-screen count today).

---

## SEARCH

### Web — client-side filter

**Component:** `components/courseSearch.tsx` (used only by
`components/HomeCoursesSection.tsx:38`).

- **Client-side filter, not a server/API query.** It filters an
  in-memory array via `useMemo` (`courseSearch.tsx:42-65`). No fetch, no API
  call on keystroke.
- **Coverage is the first 20 courses only.** `app/page.tsx:48` loads
  `getCourses({ pagination: { pageSize: 20 } })` server-side and passes that
  batch as `initialCourses` to `HomeCoursesSection`, which hands it straight
  to `CourseSearch` (`:39`). There is no "load more" wired on the homepage
  (`hasMore: false` hardcoded, `HomeCoursesSection.tsx:81`). **So search only
  ever sees ~20 courses** — anything beyond the first page is unsearchable.
- **Fields matched** (`courseSearch.tsx:54-60`), all OR'd:
  `title`, `description`, `subtitle`, `instructorName`, `category` — each via
  `.toLowerCase().includes(query)`.
- **Category filter:** separate exact-match dropdown
  (`selectedCategory === c.category`, `:46-48`), with Arabic category labels
  (`CATEGORY_LABELS`, `:6-20`).
- **Debounced?** **No.** State updates on every `onChange` keystroke
  (`:81`) and the `useMemo` recomputes immediately. Fine at 20 items;
  would need debounce at scale.
- **Arabic case/diacritic handling?** **None.** Only `.toLowerCase()` (a
  no-op for Arabic). No diacritic (tashkīl) stripping, no alef/hamza
  normalization (أ/إ/آ/ا), no taa-marbuta (ة/ه) or yaa (ي/ى) folding. Search
  is exact-substring on raw Arabic, so "احمد" won't match "أحمد".

### Mobile — no search today

The mobile app is a **separate repo** (`readiq-production-mobile`,
view-only); this repo only owns its API contract. From the contract:

- **No search exists.** `docs/MOBILE_API_MIGRATION.md:433-443` explicitly
  states searching courses/instructors by name is **not** in the API surface,
  deferred as a **post-mobile-v1 Algolia task**; "mobile v1 ships with
  category/level filters only, **no search bar**."
- **Course list load:** via the **API endpoint** `GET /api/courses`
  (`app/api/courses/route.ts`), paginated (`pageSize` default 20, max 50,
  cursor-based). Mobile does **not** hit Firestore directly — it's the
  view-only REST client.
- **Query params today:** `category`, `level`, `language` (Zod schema
  `lib/validation/api/courses.ts:4-10`). **No `search` param exists** — the
  migration doc lists `search` as "(later)" (`:85`). Caveat: `category`
  filtering currently 500s without a composite index
  (`MOBILE_API_MIGRATION.md:414-430`); mobile v1 only uses `level`.

### Parity assessment

- **Web is NOT a model to copy for scale.** Web "search" is a client-side
  substring filter over only the first 20 courses. Replicating it on mobile
  client-side would inherit the same "only searches the loaded page" ceiling.
- **True parity / correct parity needs API work.** To search the full catalog
  (not just a page), add a `search` param to `GET /api/courses` +
  `listCoursesQuery`. Firestore can't do efficient free-text search
  (acknowledged in the doc) — options are a dedicated service (Algolia, the
  doc's stated direction) or a limited prefix-match. A pure client-side mobile
  filter would only reach parity with web's *behavior* (substring over the
  loaded page), not with a genuinely useful catalog search.
- **Arabic normalization is missing on both** — if search is rebuilt, fold
  diacritics + alef/hamza/taa-marbuta/yaa before matching, server-side, so web
  and mobile share one normalization.

---

## Pointers (files referenced)

- `components/CoursesCardList.tsx` — card star (`:105`, `:330-335`),
  `enrollmentCount` (`:320-324`)
- `components/CoursePreview.tsx` — detail star (`:268`, `:271-283`)
- `app/page.tsx` — homepage load (`:48`), platform `4.9` (`:168`, `:227`),
  `HomeCoursesSection` mount (`:273`)
- `components/HomeCoursesSection.tsx` — wires search → card list
- `components/courseSearch.tsx` — client-side filter
- `types/types.ts:105-108` — `rating`/`ratingCount`/`enrollmentCount`/`studentsCount`
- `app/api/courses/route.ts`, `app/api/courses/[courseId]/route.ts`,
  `app/api/me/favorites/route.ts` — rating fields passed through, never written
- `lib/validation/api/courses.ts` — list query params (no `search`)
- `docs/MOBILE_API_MIGRATION.md:414-443` — filters + deferred search
