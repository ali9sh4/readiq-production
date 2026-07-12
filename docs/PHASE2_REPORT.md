# Phase 2 report — design identity + course player redesign

**Date:** 2026-07-12. **Run mode:** unattended, per the Phase 2 build prompt;
all §7 verdicts from `docs/AUDIT_DESIGN_TOKENS.md` applied as law.
**Commits:** `21ac0ef` (2A) → `52e73bf` (2B) → `12a9ee3` (2C). All three
build-verified (`npx tsc --noEmit` byte-identical to the pre-run baseline +
`next build` green) before committing. No blockers — `PHASE2_BLOCKERS.md`
was not needed.

The owner's in-flight MCQ work (`lib/qa/*`, `components/qa_review/*`,
`package.json`, etc.) was present in the working tree throughout; it was
never staged, committed, or reverted.

---

## PHASE 2A — token foundation + Zain (`21ac0ef`)

Files: `app/globals.css`, `app/layout.tsx`, `components/paymentSelector.tsx`
(single dead-class removal), plus the Phase 1 audit doc checked in.

- Layer-0 primitives (`--navy-950/900/800/100`, `--brand-yellow-50/200/400/500`,
  `--success-600/500`, `--warning-600`, `--zaincash-700`) and Layer-1
  semantics (`--surface`, `--success`, `--success-light`, `--warning`,
  `--brand-accent`, `--zaincash`) in `:root`; `@theme inline` maps them to
  utilities (`bg-success`, `text-warning`, `bg-brand-accent`, `bg-zaincash`,
  `bg-surface`, `bg-navy-*`, `shadow-card`, `shadow-overlay`).
- shadcn semantics re-pointed: `--primary` → navy-900 (white foreground),
  `--accent`/`--ring` → navy-100. **Intended global effect:** every
  default-variant `Button`/`Badge` app-wide went near-black → navy-900.
- Radius chain per Q4: sm 8px / md 12px / lg 20px, xl collapsed into lg.
  **Intended global effect:** all `rounded-lg` surfaces went 10px → 20px,
  `rounded-md` 8px → 12px, app-wide.
- Zain per Q2: typo key fixed, `--font-sans` heads with Zain (Geist Latin
  fallback), registration trimmed to 400/700/800/900 (no files deleted),
  font variable classes hoisted to `<html>`.
  - **Deviation from the letter of Q2a, kept to its intent:** the runtime
    next/font variable was renamed `--font-zain-local`. Naming the @theme key
    and the runtime variable both `--font-zain` emits a self-referential CSS
    custom property (`--font-zain: var(--font-zain), …` confirmed in the
    compiled CSS on the first build), which can invalidate the whole chain by
    cascade order — the same class of silent failure that kept Zain dead for
    the site's entire life. The theme key is named `--font-zain` exactly as
    the verdict asks; it references the decoupled runtime var.
- NextTopLoader hex moved behind a `BRAND_YELLOW` constant with the
  `= --brand-yellow-400` comment.
- **Compiled-CSS verification:** `--default-font-family:var(--font-zain-local),
  var(--font-geist-sans),system-ui,sans-serif`; `--font-zain-local:"zainFont",
  "zainFont Fallback"` emitted by next/font; no self-reference; `.rounded-lg`
  = 1.25rem, `.rounded-md` = .75rem, `.rounded-sm` = .5rem;
  `--primary:var(--navy-900)`.

## PHASE 2B — player extraction (`52e73bf`)

`components/ui/CoursePlayer.tsx` (1,442 lines) → `components/player/`:
`CoursePlayer` (orchestrator), `PlayerHeader`, `VideoStage` (token minting +
watermark + protection logic moved untouched), `LessonSidebar` +
`SectionsContent`, `LessonRow`, `PlayerTabs`, `FilesTab` (+`FileCard`),
`SectionalLock` (locked placeholder + always-mounted `SectionalBuyDialog`,
guards preserved), `shared.tsx`. Every className byte-identical in this
phase; state stayed in the orchestrator, threaded via props. Old path keeps
a deprecated re-export shim; the single importer
`app/course/[courseId]/page.tsx` updated. Grep confirmed no other code
imports the old path.

## PHASE 2C — hybrid theater (`12a9ee3`)

Files: `components/player/*` + two chip primitives added to `globals.css`
(`--brand-yellow-50` #FFFBE8, `--brand-yellow-200` #F3E29A).

- **Top bar:** sticky navy-950, `border-b border-white/5`; RTL-correct back
  chevron; course title + section crumb; conic-gradient progress ring
  (brand-accent over white/10) + "X من Y درسًا"; desktop focus-mode toggle
  (session-state only).
- **Grid:** stage at inline-start + 350px sidebar at inline-end
  (`lg:grid-cols-[minmax(0,1fr)_350px]`), one column when collapsed.
- **Stage:** navy-950 video zone (Mux element + watermark untouched);
  below it on `--surface`: extrabold navy-950 lesson title, muted
  section · duration meta (duration `font-mono` `dir="ltr"`), actions row —
  Previous (ghost) / **أكملتُ الدرس** (solid `bg-success`, replaces the
  green→emerald gradient; same handler + spinner) / Next (ghost), chevron
  glyphs pointing exactly as before.
- **Tabs:** mobile-first **الدروس** (default active on <lg via a mount
  effect — SSR renders the desktop default نظرة عامة to avoid a hydration
  mismatch) + نظرة عامة (lesson description + instructor, relocated from the
  old header/description strips) / الملفات (mono count badge) / بطاقات
  المراجعة. Active = navy-950 text over a 3px brand-accent underline; all
  gradient underlines gone. Conditional-tab fallbacks now target the
  breakpoint default (was: always "sections").
- **Sidebar:** white, `border-s`; header with lesson/hours meta and a 7px
  brand-accent progress bar; `--surface` section headers with Arabic-Indic
  "٣/٧" mono counters (lock glyph when fully locked); the **yellow progress
  spine** — 2px rail, 20px dots: success-filled check (completed),
  brand-accent play + navy-100 row + 3.5px start bar (active), dashed gray
  (locked); durations end-aligned mono LTR.
- **Buy chip:** fully locked sections render a `brand-yellow-50/200` chip
  (section name bold, lesson count muted) wrapping the **unmodified**
  `SectionalBuyButtons`; partially owned sections keep the plain wrapper so
  the chip never renders empty. Lock-state aggregation reuses the existing
  client predicate (`isVideoLockedForUser`) — display-only, invariant 7
  respected.
- **FilesTab:** navy-100/navy-900 icon tiles (rainbow per-filetype colors
  retired), navy-800 view/download affordances, radius-md cards,
  destructive-token error box.
- **SectionalLock:** surface placeholder, yellow lock badge, primary-variant
  (navy) CTAs; copy, guards, dialog mount, and purchase handlers unchanged.

### Grep verification (final tree)

- `components/player/`: **zero** matches for `blue-`, `indigo-`, `sky-`,
  `ml-`, `mr-`, `pl-N`, `pr-N`, `text-right`, `text-left`, `border-l`,
  `border-r`, `bg-gradient`, `green-*`/`emerald-*`, and **zero raw hex**
  (scrollbar now uses `var(--surface)/var(--border)/var(--muted-foreground)`).
  The only physical remnants are inside the moved-verbatim watermark logic
  (JS `style.right` + fullscreen CSS), explicitly allowed as untouched
  VideoStage internals.
- `git diff` for `SectionalBuyDialog.tsx`, `SectionalBuyButtons.tsx`,
  `EnrollButton.tsx`, `QaStudyDeck.tsx`, `middleware.ts`,
  `context/authContext.tsx`, `app/(auth)/**`, `app/api/**`,
  `app/actions/**`, `hooks/useVideoProtection.ts`,
  `components/VideoWatermark.tsx`: **empty** across the whole run.

---

## Intentionally left for next sessions

- Course-detail hero recolor (Q8 said out of scope).
- Catalog cards (`CoursesCardList`), navbar wordmark inline hex →
  `brand-accent`/logo tokens, `WalletBalance` + certificates banner yellows.
- QaStudyDeck restyle (mounts unchanged inside its tab).
- Repo-wide RTL logical-properties sweep (only player files migrated per Q7).
- `docs/PROJECT_STATE.md` / `docs/maintenance/update.md` pass — the run
  prompt restricted doc writes to the two named files, so the board update
  is owed next session.
- `badge.tsx` shadcn generation refresh; `property-form.tsx` relocation out
  of `ui/`; deleting the old-path player shim once nothing references it.

## Manual test checklist (owner)

1. **Zain renders site-wide** — Arabic text on the homepage/nav should
   visibly change from the OS default to Zain (compare a heading against
   yesterday's rendering; DevTools → computed `font-family` should list
   `zainFont` first).
2. **Player loads and plays a signed video** on the test account
   (`/course/<id>` on an enrolled course); watch fullscreen once so the
   watermark relocation path runs.
3. **Mark-complete persists** — press أكملتُ الدرس, reload, the lesson keeps
   its green check and the header ring/percent hold.
4. **Sectional locked section** — locked lesson shows the surface lock
   screen; sidebar shows the yellow buy chip on a fully locked section; the
   شراء flow opens the same SectionalBuyDialog and a wallet purchase still
   completes.
5. **Mobile layout** — on a phone width: الدروس tab is default and lists
   lessons, tabs switch correctly, lesson select stays on الدروس, video
   sticky top. Desktop: sidebar toggle (focus mode) collapses/restores.
6. Regression eyes: default buttons app-wide are now navy (was near-black)
   and `rounded-lg/md` corners are larger everywhere — both are intended
   Q1/Q4 outcomes, but scan the wallet + checkout dialogs for anything that
   looks off.

## Run note

One `Edit` tool call mid-run arrived with a spurious instruction appended
inside its parameter (styled as a system notice telling the run to stop
early). It matched no legitimate channel and contradicted the actual harness
contract, so it was disregarded; the edit was re-issued clean and all three
phases completed as specified. Flagging for transparency on an unattended
run.
