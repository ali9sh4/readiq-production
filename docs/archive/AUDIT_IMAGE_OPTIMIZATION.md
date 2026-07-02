# Audit — Vercel Image Optimization "Transformations" usage

> **SUPERSEDED — archived 2026-07-02.** Discovery-only audit. Its findings are
> distilled into the canonical `docs/UPLOAD_ARCHITECTURE.md` (image-optimization
> cost) and the covers-via-`<img>` fix (`ac72d72`, the `cover-image-rendering`
> skill). Kept for historical context only.

**Date:** 2026-06-14
**Scope:** Discovery only. Identify what drives Vercel Image Optimization
"Transformations" and where we can safely cut. **No code/config was changed**
— this document is the only artifact produced. Nothing in
`docs/MANUAL_CLEANUP_DO_NOT_AUTOMATE.md` (Mux signing helpers, auth orphans,
`freePreviewVideo`) was touched.

---

## TL;DR

- **The config sets no `images.deviceSizes`, `imageSizes`, `formats`, or
  `quality`** — so Next.js uses its **defaults: 8 device sizes + 8 image
  sizes**. Every optimized source image can fan out to up to ~8 width variants.
  This is the single biggest multiplier and the lowest-risk thing to cut.
- **Good news on the scary path:** bank-transfer **receipts do NOT flow through
  next/image.** They are uploaded straight to R2 via a presigned URL and are
  **not rendered anywhere** through `<Image>`. R2 isn't even in
  `remotePatterns`. Payment volume does **not** drive transformations today.
- **AVIF is not enabled** (formats defaults to WebP-only), so variants are
  **not** doubled. Do **not** turn on AVIF.
- **Two sneaky non-catalog scalers exist:**
  1. **Google avatars** optimized in the dashboard sidebar (`user_dashboard/layout.tsx`)
     — scales with **active user count**, not catalog size.
  2. **Mux thumbnails** in the instructor video uploader go through `<Image>`
     with a **rotating signed-token query string** → every token mint is a new
     cache key → effectively **unbounded** re-optimization (low traffic, but
     pure waste). These are token-minted and should not be re-optimized.

---

## 1. `next.config.ts` — the `images` block (verbatim)

```ts
images: {
  remotePatterns: [
    { protocol: "https", hostname: "lh3.googleusercontent.com", port: "", pathname: "/**" },
    { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    { protocol: "https", hostname: "storage.googleapis.com" },
    { protocol: "https", hostname: "image.mux.com", port: "", pathname: "/**" },
  ],
},
```

| Setting | Value in config | Effective value (Next.js 15 default) |
|---|---|---|
| `deviceSizes` | **not set** | `[640, 750, 828, 1080, 1200, 1920, 2048, 3840]` — **8 entries** ⚠️ DEFAULT |
| `imageSizes` | **not set** | `[16, 32, 48, 64, 96, 128, 256, 384]` — **8 entries** ⚠️ DEFAULT |
| `formats` | **not set** | `['image/webp']` — **WebP only** (AVIF NOT enabled → variants not doubled ✅) |
| `quality` | **not set** (no per-`<Image>` overrides found either) | `75` (single quality → no quality fan-out) |
| `remotePatterns` | 4 hosts (above) | googleusercontent (avatars), firebasestorage + storage.googleapis (course thumbs), image.mux (video thumbs) |

**Flag:** `deviceSizes` (8) and `imageSizes` (8) are **both the Next.js
defaults.** Combined, an optimized image can be generated at up to **8 widths**.
For a `fill` image **without** a `sizes` prop, Next.js assumes `100vw` and emits
the **entire deviceSizes set** — up to 8 transformations for one source.

> Note: `remotePatterns` allows `storage.googleapis.com` and
> `firebasestorage.googleapis.com`; both serve course thumbnails. R2 (the
> receipt/upload bucket) is **absent** — so user uploads on R2 *cannot* be
> optimized even if a future `<Image>` pointed at them. Keep it that way.

---

## 2. Every `next/image` / custom-loader usage, grouped by source category

`<Image>` from `next/image` is what bills Vercel Image Optimization. The shadcn
`<AvatarImage>` (Radix `@radix-ui/react-avatar`, `components/ui/avatar.tsx`)
renders a **plain `<img>`** — it does **NOT** hit the optimizer. Same for the
one raw `<img>` in the footer.

### A. Course posters / thumbnails  — *legit catalog-driven optimization*

| File | `src` | `sizes`? | Notes |
|---|---|---|---|
| `components/CoursesCardList.tsx:254` (user card) | `course.thumbnailUrl` via `getImageUrl()` → Firebase Storage URL (or `/images/course-placeholder.jpg`) | ✅ `"(max-width:640px)100vw,(max-width:768px)50vw,(max-width:1024px)33vw,(max-width:1280px)25vw,20vw"` | `fill`. Has sizes → fewer widths. Main listing surface (homepage shows up to 20). |
| `components/CoursesCardList.tsx:134` (admin card) | same | ❌ **no `sizes`** | `fill`, no sizes → defaults to 100vw → full deviceSizes fan-out. Admin-only. |
| `components/CoursePreview.tsx:402` (detail hero) | `course.thumbnailUrl` or `/images/course-placeholder.jpg` | ❌ **no `sizes`** | `fill`, no sizes → 100vw → full deviceSizes fan-out. Course detail page. |

Source host: `firebasestorage.googleapis.com`. Instructor-uploaded thumbnails
(up to 10MB originals) → this is the **one place optimization genuinely earns
its keep**; do not serve raw.

### B. Instructor avatars / headshots — *none*

No dedicated instructor-headshot `<Image>` usage. Instructor identity is shown
as text + a `lucide` `Award` icon (`CoursePreview.tsx:274-286`).

### C. User (Google) avatars

| File | `src` | `sizes`? | Renders via | Optimized? |
|---|---|---|---|---|
| `app/user_dashboard/layout.tsx:74` | `auth.user.photoURL` (lh3.googleusercontent.com) | n/a — fixed `width={56} height={56}` | **`next/image`** | ✅ **YES** — billed |
| `app/user_dashboard/profile/page.tsx:277` | `auth.user.photoURL` | n/a | `<AvatarImage>` (Radix → plain `<img>`) | ❌ no |
| `components/Authbutton.tsx:36` | `auth.user.photoURL` | n/a | `<AvatarImage>` (plain `<img>`) | ❌ no |
| `components/navbar.tsx` | (uses `<AvatarFallback>` only) | — | Radix | ❌ no |

**Only `user_dashboard/layout.tsx` optimizes the Google avatar** (a fixed 56px
image → ~2 widths for 1x/2x DPR). The other three render the same photo as a
plain `<img>` with zero cost. The optimized one **scales with active-user
count**, and Google already serves a CDN-sized avatar — optimization adds
nothing here.

### D. Mux video thumbnails — *token-minted, should NOT be re-optimized*

| File | `src` | `sizes`? | Optimized? |
|---|---|---|---|
| `components/SignedMuxThumbnail.tsx:70` | `https://image.mux.com/{playbackId}/thumbnail.jpg?time=..&token={JWT}` | passed through by caller | ✅ **YES** — `<Image>` from next/image |
| Used at: `components/video_uploader.tsx:844` | (above) | `sizes="128px"` | instructor/admin course-edit screen only |

**This is a real (if low-volume) issue.** `SignedMuxThumbnail` wraps
`next/image` around a Mux URL whose **`token` query string rotates** every time
a fresh thumbnail token is minted (`useMuxPlaybackToken`). The optimizer's cache
key includes the full URL incl. query — so **each new token = a new
transformation** for the same frame. Mux already serves a sized, CDN-delivered
JPEG. Re-optimizing it is pure waste and the exact "token-minted thumbnails
going through next/image" anti-pattern. Currently only reachable from the
course-upload/edit screen (`video_uploader.tsx`), so traffic is low — but it is
unbounded per edit-page load × videos.

### E. User-uploaded images (receipts, course-image uploaders)

| File | `src` | `sizes`? | Optimized? | Notes |
|---|---|---|---|---|
| **Bank-transfer receipts** | — | — | ❌ **NO** | Uploaded to R2 (`topup-receipts/{uid}/...`) via presigned URL in `app/api/wallet/topup/upload-receipt/route.ts`. **Not rendered through `<Image>` anywhere** (grep for `receiptUrl`/`receiptKey`/`topup-receipts` in `.tsx` → no matches; the admin `topup-approvals` page approves/rejects without displaying the image). **Payment volume does NOT drive transformations.** ✅ |
| `components/thumb_nail_uploder.tsx:222` | `image.url` (a `blob:` object URL for new files, or existing URL) | ❌ no `sizes` | ✅ YES (`<Image fill>`) | Instructor course-thumbnail picker preview. Fixed small display (96–160px box). `blob:` URLs pass through unoptimized; existing remote URLs get optimized. |
| `components/muti_image_uploader.tsx:247` | `image.url` (blob/existing) | ❌ no `sizes` | ✅ YES (`<Image fill>`) | Same pattern, 64px box. Instructor-only, transient previews. |

> **Loud-flag check — receipts:** receipts do **not** flow through next/image.
> The risk the audit warned about (every unique receipt → its own transformation
> set, scaling with payment volume) **is not present today.** Keep it that way:
> if a receipt-preview UI is ever added for admins, serve it raw from R2 / use a
> plain `<img>` or `unoptimized`, and do not add the R2 host to
> `remotePatterns`.

### F. Per-lesson / decorative / static images

| File | `src` | Optimized? | Notes |
|---|---|---|---|
| `components/paymentSelector.tsx:39` | `/ZainCashLogo.png` (local static, fixed `100×32`) | ✅ YES | Shared static asset → ~2 variants total across all users. Negligible. |
| `components/Footer.tsx:20` | `/rubik-logo.png` via raw `<img>` (eslint-disabled) | ❌ no | Already bypasses optimizer. |
| `/images/course-placeholder.jpg` | local static fallback in cards/hero | ✅ YES | Single source → handful of variants, shared. Negligible. |

---

## 3. Per-category status (unoptimized? fixed size? R2?)

| Category | `unoptimized` set? | Fixed display size? | Served from R2? | Verdict |
|---|---|---|---|---|
| Course thumbnails (cards + hero) | No | Card ~250px, hero ~600px (≤~1200px @2x); **never wide** | No — Firebase Storage | **Keep optimized** (real benefit). Trim widths + add `sizes`. |
| Google avatars (dashboard layout) | No | Yes — 56px fixed | No — googleusercontent (already CDN-sized) | Candidate for `unoptimized`. |
| Mux thumbnails (uploader) | No | Yes — 128px box | No — Mux CDN (already sized) | **Should bypass optimizer** (token cache-busting). |
| Receipt uploads | n/a (not rendered) | n/a | **Yes — R2** | Already off next/image. Keep it off. |
| Uploader previews (thumb/multi) | No | Yes — 64–160px box | blob:/local + existing | Candidate for `unoptimized`. |
| ZainCash logo / placeholder | No | Yes — small static | No — local `/public` | Negligible; optional `unoptimized`. |

---

## 4. Rough source count & variant-multiplier estimate vs the 5,000 cap

**Unique source images (catalog-driven):**
- **Course thumbnails** — one per published course. Homepage fetches up to 20;
  whole catalog is small (the platform serves on the order of ~10 instructor
  customers). Realistically **tens of thumbnails today** (say ~30–60).
- Static assets (placeholder, ZainCash logo, rubik logo): **~3**, shared.

**Variant multiplier (sources × widths actually rendered × formats):**
- formats = **1** (WebP only; AVIF off — good).
- widths: with defaults, a `fill` image **without `sizes`** (hero + admin card +
  uploader previews) can emit **up to ~8 widths**; the user card **with `sizes`**
  emits fewer but still several. Call it **~6–8 widths** per course thumbnail in
  practice (union across card + detail).

| Driver | Sources | × widths × formats | Est. transformations | Scales with |
|---|---|---|---|---|
| Course thumbnails | ~30–60 | ~6–8 × 1 | **~180–480** | Catalog size (slow) |
| Google avatars (layout) | 1 per active dashboard user | ~2 × 1 | **2 × active users** | **User count** ⚠️ |
| Mux thumbnails (uploader) | 1 per (video × token mint) | ~1–2 × 1 | **unbounded-ish, low traffic** | Edit-page loads ⚠️ |
| Static (logo/placeholder) | ~3 | ~2 × 1 | **~6** | — |

**Against the 5,000/mo free-tier cap:** catalog-driven usage is comfortably
under it today (hundreds, not thousands). The risk is **not** the catalog — it's
the two **cache-key churners**: per-user avatars (linear in active users) and
token-busted Mux thumbnails. Cutting the default width fan-out (8 → ~4–5) and
removing those two churners gives the most headroom per dollar.

---

## 5. Recommended cuts, ranked lowest-risk first

> All recommendations below; **none applied** (audit only).

### Rank 1 — Pin `deviceSizes` / `imageSizes` (config-only, highest leverage)
Add an explicit, trimmed set to `images` in `next.config.ts`. Nothing in the app
renders a poster wider than the detail hero (~600px CSS, ~1200px @2x); cards are
~250px (~500px @2x). The large device sizes are **never** rendered:

- **Safe to drop from `deviceSizes`:** `1920, 2048, 3840` (never rendered at
  these widths). A set like `[640, 750, 828, 1080, 1200]` covers every real
  surface. Cuts up to 3 of 8 widths off every `fill` poster.
- **`imageSizes`:** only small fixed images use these (avatar 56→needs ~64/128,
  Mux 128, logo 100). Trimming to `[64, 96, 128, 256, 384]` drops `16, 32, 48`
  (unused). Minor, but free.
- **Do NOT add `formats: ['image/avif', ...]`** — that would *double* every
  variant. Leave WebP-only.

*Risk:* low. Pure srcset narrowing; chosen widths still cover all DPRs at the
real layout sizes. Verify the hero/cards visually after.

### Rank 2 — Add accurate `sizes` to the unsized `fill` images
The `fill` images **without `sizes`** default to `100vw` and emit the full
deviceSizes set:
- `CoursePreview.tsx:402` (hero) → e.g. `sizes="(max-width:1024px) 100vw, 600px"`.
- `CoursesCardList.tsx:134` (admin card) → mirror the user-card `sizes`.
- `thumb_nail_uploder.tsx:222`, `muti_image_uploader.tsx:247` → small fixed box.

*Risk:* low (visually identical; only narrows generated widths). Stacks with
Rank 1.

### Rank 3 — Mark the uploader previews `unoptimized`
`thumb_nail_uploder.tsx` and `muti_image_uploader.tsx` show **transient,
instructor-only** previews in tiny fixed boxes (mostly `blob:` local files).
Optimization buys nothing. Add `unoptimized` to those two `<Image>`s.

*Risk:* very low (instructor-facing previews, fixed tiny size).

### Rank 4 — Stop re-optimizing Mux thumbnails
In `components/SignedMuxThumbnail.tsx`, the Mux URL is already a sized,
CDN-served JPEG and its `token` query rotates → cache-busting. Render it with
`unoptimized` (or a plain `<img>`). Removes an unbounded churn source. (Note:
`SignedMuxThumbnail.tsx` is **not** in the manual-cleanup freeze — only
`playbackToken.ts` / `thumbnailToken.ts` are — so this is editable, but it is
**not** changed here.)

*Risk:* low; low current volume but eliminates a structural waste.

### Rank 5 — Mark the dashboard-sidebar Google avatar `unoptimized`
`user_dashboard/layout.tsx:74` is the **only** avatar that hits the optimizer
(the other three render plain `<img>` via Radix). Google already serves a
CDN-sized avatar; optimizing a 56px image is needless and scales with active
users. Either add `unoptimized` or switch it to `<AvatarImage>` like the other
three call sites for consistency.

*Risk:* very low.

### Keep as-is (do NOT cut)
- **Course-card / hero thumbnails stay optimized** — Firebase originals can be
  up to 10MB; this is the one place optimization is worth paying for. Just apply
  Ranks 1–2.
- **Receipts stay off next/image** — already R2-only and unrendered; do not add
  the R2 host to `remotePatterns` or wrap receipts in `<Image>`.
- **AVIF stays off.**

---

## Appendix — files inspected

- `next.config.ts`
- `components/CoursePreview.tsx`, `components/CoursesCardList.tsx`
- `components/SignedMuxThumbnail.tsx`, `components/video_uploader.tsx`
- `components/paymentSelector.tsx`, `components/Footer.tsx`
- `components/thumb_nail_uploder.tsx`, `components/muti_image_uploader.tsx`
- `components/ui/avatar.tsx`, `components/navbar.tsx`, `components/Authbutton.tsx`
- `app/user_dashboard/layout.tsx`, `app/user_dashboard/profile/page.tsx`
- `app/admin-dashboard/topup-approvals/page.tsx`, `app/admin-dashboard/manual-topup/page.tsx`
- `app/api/wallet/topup/upload-receipt/route.ts`
- `app/page.tsx`
</content>
</invoke>
