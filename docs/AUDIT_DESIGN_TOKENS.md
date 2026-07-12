# Audit — Design identity / design tokens (Phase 1)

**Status:** AUDIT ONLY — no code changed. Phase 2 (token definition + migration)
blocked on the §7 OPEN QUESTIONS verdicts.
**Date:** 2026-07-12.
**Scope:** full inventory of color, typography, shape, component styling
approach, and RTL handling across `app/`, `components/`, `lib/`, `hooks/`,
`context/`, `validation/` (137 `.tsx` files), to ground a single design-token
system for Rubik — web now, Expo mobile later.
**Method:** ripgrep aggregate counts over source + file-by-file reads of the
chrome and the top student surfaces + verification against the compiled
`.next` CSS for the font findings.
**Protected surfaces:** `middleware.ts`, `context/authContext.tsx`,
`app/(auth)/login/login-form.tsx`, `app/(auth)/register/register-form.tsx`,
`app/(auth)/register/action.ts`, `app/(auth)/forget-password/*` are
**audit-only — no Phase 2 edits may be planned against them.** They are
flagged inline below wherever relevant.

---

## 0. Headline findings

1. **The Arabic brand font never renders.** `public/fonts/` ships 9 Zain OTFs,
   `app/layout.tsx:81-125` registers 8 weights as `--font-zain` — and it is
   applied **nowhere**. `app/globals.css:37` registers the theme key with a
   double-dash typo (`--font--zain`), and the single class that asks for it
   (`font-zain`, `components/paymentSelector.tsx:66`) is therefore dead —
   confirmed against the compiled CSS: neither `.font-zain` nor `.font--zain`
   is emitted. Nothing else sets a font-family anywhere in source. Body
   resolves to **Geist (latin subset only)**, so all Arabic text — the entire
   product — renders in each OS's default Arabic fallback (Segoe UI /
   SF Arabic / Roboto-Noto). Rubik currently has no Arabic typographic
   identity at all.
2. **A token system exists but is bypassed.** `app/globals.css:73-140` holds
   the full stock-shadcn oklch token set — all **zero-chroma (grayscale)**;
   `--primary` is near-black. Semantic token classes are used ~157 times,
   almost entirely *inside* `components/ui/*` and the auth pages. Product
   surfaces use raw Tailwind palette utilities ~2,000 times (919 `gray-*`,
   347 `blue-*`, …). The token layer and the actual design never meet.
3. **Two competing brand palettes.** Marketing chrome (navbar, hero, CTA) is
   `sky-900` + `emerald-500`; product surfaces (cards, player, dashboard,
   wallet, sectional) are `blue-600`/`indigo` + `green`. `CoursePreview`'s
   hero is a third thing (`gray-900`). The wordmark colors — `#FDD835` yellow
   and `#E53935` red — exist only as hardcoded hex in 4 files and never as a
   reusable token.
4. **Dark mode is dead code.** A full `.dark` token block exists
   (`globals.css:108-140`), `next-themes` is in `package.json`, but no
   `ThemeProvider` is mounted and nothing ever sets the `.dark` class. The 19
   `dark:` variants in source are all inside stock shadcn primitives.
5. **RTL is hand-compensated, not logical.** 130 physical `ml-/mr-/pl-/pr-`
   classes vs **1** logical (`ps-6`); 119 `text-right` vs 0 `text-start`;
   41 physical `left-/right-` offsets; zero `rtl:`/`ltr:` variants. It works
   only because `<html dir="rtl">` is permanent and every class was written
   against that. None of it survives a dir flip or transfers to a
   direction-agnostic mobile token set.

---

## 1. Color inventory

### 1.1 Raw Tailwind palette usage by hue (`app components lib hooks context validation`, `.tsx`)

| Hue | Count | Role observed |
|---|---:|---|
| gray | 919 | de facto neutral scale (body bg `bg-gray-50`, text `gray-400…900`, borders `gray-100…300`) |
| blue | 347 | de facto product primary (`blue-600` CTAs, links, active states, focus rings) |
| red | 196 | errors/destructive (`red-50/200/600/700/800`) |
| green | 193 | success + **money** (prices, wallet, free badges, mark-complete) |
| amber | 99 | warnings, access-expiry chips, upsell notices |
| sky | 75 | **marketing chrome** (`sky-900` navbar/hero/CTA, `sky-950` overlays, legal headings) |
| purple | 50 | ZainCash branding, "premium" badge, misc file icons |
| emerald | 44 | homepage CTA (`emerald-500`), access badges, completion gradients |
| yellow | 34 | bestseller badge `yellow-400`, coming-soon badge, star ratings |
| pink | 26 | favorites icon, promo gradients (`from-pink-500 to-red-500`) |
| zinc | 24 | stray neutrals (should be gray) |
| orange | 21 | course "requirements" accents, file icons |
| slate / neutral / indigo / rose | 7 / 7 / 7 / 3 | strays; indigo only inside player gradients |

Plus: `text-white` 121, `bg-white` 117, `bg-black` 8, ~35 white/black opacity
variants (`bg-white/10`, `bg-black/50`, …).

**Interpretation:** four gray families are in use (gray, zinc, slate,
neutral); two "primary" blues (sky vs blue); two "success" greens (green vs
emerald). Each pair needs collapsing into one token.

### 1.2 Semantic (shadcn) token usage — ~157 total

Top: `text-muted-foreground` 28, `text-foreground` 10, `ring-destructive` 10,
`bg-accent` 10, `bg-primary` 7, `bg-destructive` 7 … — nearly all inside
`components/ui/*` primitives themselves and `app/(auth)/*` pages (the auth
screens are, ironically, the most token-faithful surfaces in the app —
**PROTECTED, audit-only**). Product code overrides primitive variants with
raw palette classes instead (e.g. `<Badge className="bg-blue-600 …">`,
`components/CoursePreview.tsx:233`).

### 1.3 Hardcoded hex / rgb / arbitrary values

17 hex literals in source (excluding SVG brand marks), 7 `rgb()/hsl()`
occurrences, 2 arbitrary Tailwind color values:

| Value | Where | What |
|---|---|---|
| `#FDD835` (brand yellow) ×6 | `app/layout.tsx:142,145` (NextTopLoader color+shadow); `components/navbar.tsx:82` (inline style, wordmark "k"); `components/WalletBalance.tsx:45` (`text-[#FDD835]`); `app/user_dashboard/certificates/page.tsx:74` (`bg-[#FDD835]`) | the only places the brand yellow exists — never a token |
| `#E53935` (brand red) | `components/navbar.tsx:58` (inline style, wordmark "R") | logo accent, never reused |
| `#f3f4f6`, `#d1d5db`, `#9ca3af` | `components/ui/CoursePlayer.tsx:1286-1293` (styled-jsx scrollbar) | gray-100/300/400 as raw hex |
| `#4285F4/#34A853/#FBBC05/#EA4335` | `components/ContWithGoogleButton.tsx:19-31` | Google brand SVG — legitimate, leave alone |
| `rgba(59,130,246,…)` (blue-500) | `app/globals.css:15-30` (`scroll-target-pulse` keyframes) | hand-written pulse animation color |
| `rgba(0,0,0,0.2/0.25)` | `components/CoursesCardList.tsx:138,272` (`[filter:drop-shadow(…)]`) | card hover shadow as arbitrary filter |

### 1.4 Top offender files (raw palette classes per file)

| File | Count |
|---|---:|
| `app/admin-dashboard/page.tsx` | 103 |
| `components/video_uploader.tsx` | 91 |
| `components/ui/CoursePlayer.tsx` | 91 |
| `components/CoursePreview.tsx` | 65 |
| `components/CourseDashboard.tsx` | 58 |
| `components/fileUplaodtoR2.tsx` | 56 |
| `app/user_dashboard/profile/page.tsx` | 55 |
| `components/quick_course_form.tsx` | 46 |
| `components/CoursesCardList.tsx` | 41 |
| `app/user_dashboard/certificates/page.tsx` | 41 |
| `app/page.tsx` | 41 |

### 1.5 Gradients (~32 total)

- 13 × `bg-gradient-to-r`, 14 × `to-br`, 1 × `to-l`, rest vertical.
- Concentrated in `components/ui/CoursePlayer.tsx` (blue→indigo active
  states, green→emerald completion, slate header chrome) and promo CTAs
  (`from-pink-500 to-red-500`, `from-blue-600 to-purple-600`).
- Horizontal gradients (`to-r`/`to-l`, 14 of them) are **not** direction-aware
  — under RTL they still run left→right (deliberate today, but a token/RTL
  decision later).

### 1.6 Per-surface palette map (who uses which brand)

| Surface | Dominant palette |
|---|---|
| `components/navbar.tsx` | `sky-900` + white glass (`bg-white/10`), wordmark hex red/yellow |
| `app/page.tsx` (hero/stats/catalog) | `sky-900/950` + **emerald-500** CTA + `amber-300` sparkle |
| `components/CTASection.tsx` | mirrors hero (`sky-900`) |
| `components/Footer.tsx` | `gray-950` + scattered emerald/sky/purple accents |
| `components/CoursesCardList.tsx` | white cards, **blue-600** hover/enrolled, badge set: `green-500` free / `yellow-400` bestseller / `purple-600` premium |
| `components/CoursePreview.tsx` | **gray-900 hero** + `blue-600` accents + green pricing + amber/emerald access badges |
| `components/ui/CoursePlayer.tsx` | **blue→indigo gradients** + green/emerald completion + slate chrome |
| `app/user_dashboard/main/DashboardHome.tsx` | **blue-600** welcome banner, pink favorites |
| `app/wallet/topup/**` | blue-600 primary, green success, purple ZainCash tile |
| `components/sectional/*` | blue-600 primary, green wallet/success, purple-700 ZainCash, amber upsell |
| `components/study/QaStudyDeck.tsx` | green mastery + blue clip banner |
| `app/(auth)/*` (**PROTECTED**) | semantic tokens (grayscale) — most token-faithful surfaces |

---

## 2. Typography inventory

### 2.1 Font loading

| Font | How loaded | Subset/weights | Actually renders? |
|---|---|---|---|
| Geist | `next/font/google`, `app/layout.tsx:11-14` → `--font-geist-sans` → `--font-sans` (`globals.css:35`) | latin only | **Yes — it is the default for everything**, including Arabic text it cannot cover (Arabic falls to OS fallback) |
| Geist Mono | `next/font/google`, `layout.tsx:16-19` → `--font-mono` | latin only | Yes, via ~10 `font-mono` uses (payment numbers, codes, watermark) |
| Zain (Arabic) | `next/font/local`, `layout.tsx:81-125`, 8 faces (200/300/300i/400/400i/700/800/900) → `--font-zain` on `<html>` | Arabic + basic Latin | **No — loaded, never applied** (see §0.1) |
| `ZainOutline_Bold.otf` | in `public/fonts/`, **not registered** in the `localFont` src array | — | dead asset |

No Google Fonts `<link>`, no `@font-face` in CSS, no other font-family
declaration anywhere in source. Only one stylesheet exists
(`app/globals.css`); no CSS Modules, no styled-components/emotion — the two
`<style jsx global>` blocks are `components/CoursesCardList.tsx:515` (Safari
fix) and `components/ui/CoursePlayer.tsx:1281` (scrollbar + watermark).

### 2.2 The broken Zain chain (evidence)

1. `globals.css:37` — `--font--zain: var(--font-zain);` (double dash) would
   generate a `font--zain` utility; nothing references it.
2. `components/paymentSelector.tsx:66` uses `font-zain`, which needs a
   `--font-zain` **theme** key that doesn't exist → Tailwind emits no rule
   (verified: no `.font-zain` or `.font--zain` in compiled `.next` CSS).
3. Nothing sets Zain on `body` — so even fixing the typo only revives one
   dead class; making Zain the platform font requires putting it into
   `--font-sans` (or an explicit body class).

### 2.3 Font sizes in use

| Class | Count | | Class | Count |
|---|---:|---|---|---:|
| `text-sm` | 411 | | `text-3xl` | 35 |
| `text-xs` | 204 | | `text-4xl` | 21 |
| `text-base` | 160 | | `text-5xl` | 2 |
| `text-2xl` | 73 | | `text-[11px]` | 11 |
| `text-lg` | 67 | | `text-[10px]` | 3 |
| `text-xl` | 54 | | | |

The 14 arbitrary `text-[10px]/text-[11px]` uses cluster in
`app/wallet/topup/_components/*`, `app/page.tsx`, badges in
`components/PackageCheckoutDialog.tsx` / `PackageUpsellBanner.tsx` — a
missing "caption/2xs" step in the scale.

### 2.4 Font weights in use

`font-bold` 163, `font-medium` 144, `font-semibold` 135, `font-extrabold` 10
(sky-900 legal/support headings), `font-normal` 4. **No light weights used**
— yet 3 of the 8 registered Zain faces are ExtraLight/Light/LightItalic
(dead payload if Zain is adopted as-is). Common pairings observed:
`text-3xl/4xl + font-extrabold` (marketing headings), `text-sm + font-medium`
(UI labels/buttons), `text-xs + text-gray-500` (metadata).

---

## 3. Shape inventory

### 3.1 Border radius

| Class | Count | Resolved value today |
|---|---:|---|
| `rounded-lg` | 219 | `--radius-lg` = `--radius` = **0.625rem** (shadcn override) |
| `rounded-full` | 94 | 9999px |
| `rounded-xl` | 80 | `--radius + 4px` ≈ 0.875rem |
| `rounded-2xl` | 45 | Tailwind default 1rem (outside the shadcn token chain) |
| `rounded` (bare) | 44 | 0.25rem |
| `rounded-md` | 37 | `--radius − 2px` |
| `rounded-3xl` | 17 | Tailwind default 1.5rem (hero cards, welcome banners) |
| `rounded-sm/xs/none` | 5/2/1 | — |
| arbitrary | 2 | `rounded-t-[8px] md:rounded-t-[7px] lg:rounded-t-[13px]` — `components/CoursesCardList.tsx:144,277` (pixel-tuned to sit inside the card border; brittle) |

Note the split brain: `sm…xl` flow through the shadcn `--radius` token
(`globals.css:67-70`), while the heavily-used `2xl/3xl` and bare `rounded`
bypass it entirely.

### 3.2 Shadows

`shadow-lg` 81, `shadow-md` 45, `shadow-sm` 43, `shadow-xl` 24, bare `shadow`
16, `shadow-2xl` 11, `shadow-xs` 7 (shadcn primitives). Non-scale shadows:
the two `drop-shadow` arbitrary filters in `CoursesCardList` (§1.3), the
NextTopLoader glow (`layout.tsx:145`), and the `scroll-target-pulse`
keyframes (`globals.css:15-30`). No shadow tokens defined anywhere.

### 3.3 Spacing anomalies (arbitrary values)

198 total `-[…]` arbitrary values; after excluding legitimate ones (Radix
`var(--radix-*)`, `calc()` in shadcn primitives, dynamic widths), the
outliers are small: `p-[3px]`, `mt-[18px]`, `translate-y-[2px]`,
`min-h-[88px]`, a family of `min-w-[160-280px]` dropdown widths, and
viewport caps (`max-h-[90vh]`). Spacing otherwise sticks to the standard
Tailwind scale — **spacing is the healthiest dimension of the system**.

---

## 4. Component styling approach

### 4.1 Primitive adoption

- `components/ui/` holds 23 files: 20 genuine shadcn primitives + 3 misfits —
  `CoursePlayer.tsx` (a 1,442-line app feature), `property-form.tsx` (a full
  course form), `loading-button.tsx` (legit custom wrapper, house convention).
- Of 45 non-`ui` component files: **24 import at least one `@/components/ui/*`
  primitive, 21 use none** (pure one-off Tailwind).
- Notable primitive-free components: `navbar.tsx`, `Footer.tsx`,
  `CTASection.tsx`, `HomeCoursesSection.tsx`, `publicCoursesCardList.tsx`,
  `WalletBalance.tsx`, `courseSearch.tsx`, `video_uploader.tsx`,
  `thumb_nail_uploder.tsx`, `instructorCourse.tsx`, `Authbutton.tsx`.
- Generation drift inside `ui/`: `badge.tsx` is old-gen shadcn (no
  `data-slot`, `ring-offset` focus, `BadgeProps` interface) while
  `button.tsx`/`card.tsx`/`input.tsx` are new-gen. All are otherwise stock —
  **no custom brand variants were ever added**, which is *why* every consumer
  overrides them with raw palette classes.
- 12 inline `style={{…}}` uses; only the navbar wordmark colors (5) and
  `Authbutton.tsx:55` (`direction:"rtl"`) are static styling — the rest are
  dynamic widths (progress bars) and benign.

### 4.2 The 10 highest-traffic student surfaces

| # | Surface | Route / file | Approach |
|---|---|---|---|
| 1 | Homepage (hero + catalog) | `/` — `app/page.tsx` + `HomeCoursesSection` + `CTASection` | one-off Tailwind, `Button` only |
| 2 | Course detail (preview) | `/course/[courseId]` — `components/CoursePreview.tsx` | `Card`/`Badge` + heavy one-off; badge variants overridden with raw color |
| 3 | Video player | same route, enrolled — `components/ui/CoursePlayer.tsx` | one-off + gradients; styled-jsx scrollbar |
| 4 | Catalog cards | `components/CoursesCardList.tsx` (home, dashboard, favorites) | `Badge`/`Button` + elaborate one-off card shell, arbitrary radii/filters |
| 5 | User dashboard | `/user_dashboard` — `app/user_dashboard/main/DashboardHome.tsx` | `Card`/`Button` + one-off blue banner |
| 6 | Wallet top-up wizard | `/wallet/topup` — `_components/TopupWizard.tsx` + steps | **best shadcn adoption** of the product surfaces |
| 7 | Checkout (full course) | `components/EnrollButton.tsx` + `paymentSelector.tsx` | `Button`/`Dialog`, green/blue raw CTAs |
| 8 | Checkout (sectional) | `components/sectional/SectionalCoursePurchase/BuyButtons/BuyDialog.tsx` | `Button`/`Dialog`, consistent blue/green/purple/amber |
| 9 | Study deck | `components/study/QaStudyDeck.tsx` | `Button` + one-off green/blue |
| 10 | **Auth screens — PROTECTED** | `app/(auth)/login`, `register`, `forget-password` | clean shadcn + semantic tokens. **Audit-only: no edits may be planned here.** They will pick up token changes only passively, through the `ui/*` primitives and token values they already reference. `login-form.tsx` is orphaned (Google-only flow) — still do not touch. |

Traffic reasoning: 1–4 are on every visitor's path; 5–8 on every paying
student's path; 9 is the flagship AI feature; 10 gates everything but is
frozen.

---

## 5. RTL handling

Global `dir="rtl"` on `<html>` (`app/layout.tsx:133`); scattered redundant
local `dir="rtl"` wrappers; deliberate `dir="ltr"` islands for phone numbers,
codes, and English legal text (`app/support/page.tsx`, wallet steps,
`lib/legal/LegalPage.tsx:86`).

| Pattern | Count | Verdict |
|---|---:|---|
| Physical `ml-/mr-/pl-/pr-` | **130** (top: `ml-2` ×48, `ml-1` ×27, `mr-2` ×9) | every one is a dir-flip violation |
| Logical `ms-/me-/ps-/pe-` | **1** (`ps-6`) | effectively unused |
| `text-right` / `text-left` | 119 / 9 | should be `text-start`/`text-end` |
| Physical `left-/right-` offsets | 41 | badges, close buttons, decorative blobs |
| `border-l/r`, `rounded-l/r-*` | 8 | e.g. active-lesson `border-r-4` (`CoursePlayer.tsx:702`) |
| `space-x-*` without `space-x-reverse` | 1 | `navbar` |
| `rtl:` / `ltr:` Tailwind variants | 0 | never used |
| `flex-row-reverse` | 0 | — |

Top physical-direction files: `components/CourseDashboard.tsx` (31),
`app/admin-dashboard/page.tsx` (20), `components/sectional/SectionListEditor.tsx`
(17), `components/qa_review/QaReviewTab.tsx` (16). Also directionally
hardcoded: `ChevronRight` = previous / `ChevronLeft` = next in the player
(`CoursePlayer.tsx:1080,1091`) — correct for RTL, wrong the moment anything
renders LTR.

**Consequence:** the styling is not direction-agnostic; it is RTL-by-
convention. Fine for an RTL-only web app, but it means (a) class recipes
can't be shared with any LTR context, and (b) a mobile app that respects
device locale (or a future English UI) can't reuse these patterns. Token
work is the natural moment to adopt logical properties, since every migrated
class gets touched anyway.

---

## 6. PROPOSED TOKEN ARCHITECTURE

No code here — this is the recommendation Phase 2 would implement after §7
verdicts.

### 6.1 Where tokens live

Keep the mechanism the repo already has — **CSS variables in
`app/globals.css` + Tailwind v4 `@theme inline` mapping** — and make it real:

```
Layer 0 (primitive):   --brand-navy-900, --brand-yellow-400, --success-600, …
                       (raw values, one per hue step actually needed)
Layer 1 (semantic):    --primary, --primary-foreground, --accent, --success,
                       --warning, --destructive, --surface, --border, …
                       (:root { --primary: var(--brand-…); })
Layer 2 (utilities):   @theme inline { --color-primary: var(--primary); … }
                       → bg-primary, text-success, border-warning, …
```

- This is exactly the existing shadcn wiring (`globals.css:32-71`) — Phase 2
  re-points the grayscale values at brand values and **adds the semantics the
  app demonstrably needs but lacks**: `success` (193 green + 44 emerald raw
  uses), `warning` (99 amber), `brand-accent` (the #FDD835 yellow),
  `zaincash` (purple, a payment-brand constant), and a `surface`/`surface-alt`
  neutral pair to replace the gray-50/white/gray-100 trio.
- Fonts: fix `--font--zain` → `--font-zain`, and (pending Q2) set
  `--font-sans: var(--font-zain), var(--font-geist-sans), system-ui, …` so
  Arabic renders in Zain with Geist covering Latin glyphs. Numerals/codes
  keep `--font-mono`.
- Radius: keep the `--radius` base var; decide the scale in Q4 and pull
  `2xl/3xl` uses into the token chain (`--radius-2xl` etc. in `@theme`).
- Shadows: add `--shadow-card` / `--shadow-overlay` tokens to `@theme` to
  replace the two arbitrary drop-shadow filters and standardize the
  sm/md/lg/xl spread.
- **No `tailwind.config.*` file should be introduced** — Tailwind v4 CSS-first
  config is already in place; adding a JS config would split the source of
  truth.

### 6.2 Feeding the Expo app later

- Create `design/tokens.json` (flat, platform-neutral names:
  `color.primary`, `color.surface`, `radius.md`, `font.sans`,
  `space.4`…) as the **single source of truth**, checked into this repo.
- Web: a ~50-line generator script (run via npm script, same pattern as
  `scripts/pipeline/`) emits the `:root`/`.dark` variable block of
  `globals.css` from the JSON. Until the generator exists, hand-sync — the
  JSON is still the contract.
- Mobile: the same JSON is copied (or published) into
  `readiq-production-mobile` and consumed as a typed `tokens.ts` object —
  NativeWind theme or plain `StyleSheet` constants. RN has no CSS variables,
  which is exactly why the JSON, not `globals.css`, must be canonical.
- Semantic names must stay direction- and platform-neutral (`start`/`end`,
  never `left`/`right`; no `hover-*` tokens — hover is a web concern layered
  in the web mapping).

### 6.3 Migration order (lowest risk → highest traffic)

Each step is independently shippable and visually verifiable; the owner's
checkpoint style (verify each slice live before continuing) applies.

| Step | Surface | Risk | Why this order |
|---|---|---|---|
| 0 | `globals.css` token block + Zain wiring | none-to-low | pure addition; grayscale values re-pointed only where identical. The single visible change — body font becomes Zain — is deliberate and owner-verified (Q2 first) |
| 1 | Legal/support pages (`lib/legal/LegalPage.tsx`, `app/support`) | trivial | static text, sky-900 headings → `text-primary` |
| 2 | `components/Footer.tsx` | trivial | isolated chrome, no logic |
| 3 | `components/navbar.tsx` + `WalletBalance.tsx` | low | replace wordmark inline hex + `text-[#FDD835]` with `brand-accent` tokens; sticky chrome, test on mobile widths |
| 4 | `app/user_dashboard/**` (DashboardHome, profile, certificates) | low-med | logged-in but read-mostly; kills the `bg-[#FDD835]` certificate banner |
| 5 | Wallet/top-up wizard | medium | money-adjacent UI, but already the best primitive user |
| 6 | Checkout dialogs (`EnrollButton`, `paymentSelector`, `components/sectional/*`) | medium | purchase-critical — colors only, no flow logic; sectional invariants untouched (styling only) |
| 7 | `CoursesCardList.tsx` + `HomeCoursesSection` | med-high | every catalog view; also normalize the arbitrary `rounded-t-[Npx]` hack |
| 8 | `CoursePreview.tsx` | high | main conversion surface |
| 9 | `components/ui/CoursePlayer.tsx` + `QaStudyDeck.tsx` | high | densest file, gradients, styled-jsx; do last with a real playback verification |
| 10 | `app/page.tsx` hero + `CTASection` | high visibility | first impression — do once the palette is proven everywhere else |
| — | `app/(auth)/*`, `middleware.ts`, `authContext.tsx` | **FROZEN** | never edited; they inherit token values passively via the primitives they already use |

Admin/instructor surfaces (`admin-dashboard`, `video_uploader`,
`CourseDashboard` — the three worst raw-color offenders) trail after step 10;
they're high-count but internal-facing.

Recommended micro-step inside each: replace *color* classes with token
classes only; leave spacing/radius churn for a second pass. RTL
logical-property adoption (Q7) piggybacks on whichever files a step already
touches.

### 6.4 Hygiene flags surfaced by this audit (not token work, listed for the backlog)

- `components/ui/CoursePlayer.tsx` and `components/ui/property-form.tsx` are
  app features misfiled under `ui/` — relocation candidates.
- `badge.tsx` is a shadcn generation behind its siblings.
- `ZainOutline_Bold.otf` ships unreferenced; 3 registered Zain light faces
  are unused by any class.
- `next-themes` is an unused dependency unless Q3 lands on "yes".
- `login-form.tsx` is orphaned (Google-only auth) — noted, PROTECTED, no
  action.

---

## §7 OPEN QUESTIONS — owner verdicts needed before Phase 2

**Q1 — Primary brand color.** The codebase disagrees with itself: marketing
chrome says `sky-900` (+`emerald-500` CTA), product surfaces say `blue-600`
(+`indigo` gradients), `CoursePreview`'s hero says `gray-900`. Pick ONE
primary (and one hue for its gradients/hovers). Sub-question: what is
`#FDD835` yellow allowed to be — wordmark-only, or a first-class
`brand-accent` token used on content surfaces (it already leaks onto the
certificates banner and wallet icon)? And is `#E53935` red logo-only?

**Q2 — Font pairing.** Zain is shipped but never renders; all Arabic text is
OS-fallback today. (a) Should Zain become the platform Arabic UI font
(`--font-sans` head)? (b) Keep Geist as the Latin/numeral companion, or pick
something else? (c) Which Zain weights survive — the app uses only
400/500-ish/700/800 patterns today; the light faces (200/300) are unused
payload. (d) Keep Geist Mono for codes/amounts?

**Q3 — Dark mode: yes or no.** The `.dark` token block and `next-themes` are
dead code today. "Yes" roughly doubles the token-value work and adds a
theme toggle + QA per surface; "no" means deleting the `.dark` block and the
dependency for honesty. (Mobile can still make its own call later if tokens
carry paired values.)

**Q4 — Radius scale.** De facto: `rounded-lg` (0.625rem, 219×) for
controls/cards, `rounded-xl/2xl/3xl` (80/45/17×) for feature cards and
banners, `rounded-full` for pills. Verdict needed: the base `--radius` value
and how many steps the scale keeps (proposal: 3 steps + full — e.g.
`radius-sm ~6px` inputs, `radius-md ~10px` cards/buttons, `radius-lg ~16-24px`
hero/banner — collapsing bare `rounded`, `2xl`, `3xl`, and the
`rounded-t-[Npx]` hack into them).

**Q5 — One green or two.** `green-*` (193×) and `emerald-*` (44×) both mean
success/money/completion. Collapse into a single `success` token? And does
"price/money" get its own token or share `success`?

**Q6 — Status/badge color semantics.** Freeze a semantic set for: free
(`green-500`), bestseller (`yellow-400`), premium (`purple-600`), enrolled
(`blue-600`), expiring (`amber`), expired (`red`), plus purple = ZainCash.
Are these the intended meanings, and is purple allowed to mean both
"premium" and "ZainCash"?

**Q7 — RTL strategy.** Adopt logical properties (`ms-/me-/ps-/pe-`,
`text-start/end`, `start-/end-`) opportunistically during token migration
(recommended — near-zero visual risk per file, unlocks mobile/LTR reuse), or
keep physical classes and accept RTL-only styling forever?

**Q8 — Course-detail hero.** `CoursePreview`'s `gray-900` hero is neither
brand navy nor product blue. Recolor to the Q1 primary during step 8, or is
the neutral hero intentional (content photography contrast)?

**Q9 — Zain asset trim.** May Phase 2 delete `ZainOutline_Bold.otf` and drop
unused light faces from the `localFont` registration (smaller font payload),
or keep all faces for future marketing use?

---

*Audit performed 2026-07-12. No files modified other than creating this
document. Phase 2 does not begin until the §7 verdicts land.*
