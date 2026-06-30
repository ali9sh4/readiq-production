# Cover-Photo Propagation Audit

**Scope:** Audit only — no code/config changed. Supersedes all earlier versions.
**Branch read:** `fix/course-editor-refresh-bounce` (commit `08531b8`, not merged).
**Method:** code reading + a **read-only** live probe — queried the `courses`
Firestore collection with the admin SDK and `fetch()`ed every stored cover URL
(direct + through the Next image optimizer on a local `next start` build of this
exact commit). Tokens are redacted throughout.

---

## TL;DR — what the evidence actually shows

- **Backend is Firebase Storage**, not R2. The cover is uploaded with the
  Firebase **client** SDK and the persisted field is the **`getDownloadURL()`
  result — a tokenized `firebasestorage.googleapis.com/.../o/<encoded path>?alt=media&token=<uuid>`** string. This is the correct, durable form.
- **Every cover URL in the database resolves.** I fetched the `thumbnailUrl` of
  **all 15 course docs** (published, draft, archived). Every doc that has a cover
  returns **HTTP 200 with real image bytes** (jpeg/png/webp), unauthenticated,
  both directly and through `/_next/image`. **Zero** `gs://`, zero token-less
  URLs, zero 403/404 — including the two "book-placeholder" courses and a 40 KB
  `.webp`.
- Therefore the broken display is **not** a non-resolving *persisted* URL, and is
  **not** a Storage-rules / App-Check / missing-token problem (unauthenticated
  reads return 200 → reads are not gated). The break is in the **`next/image`
  optimizer indirection** the app puts between the (valid) Firebase URL and the
  `<img>` — see §1.
- **Symptom A and Symptom B are two different root causes** that merely share the
  cover plumbing. A = rendering/optimizer layer. B = state-binding (the editor
  cover is bound to react-hook-form state, but the delete handler mutates a
  *different* piece of state).

> **Discrepancy stated plainly:** the task brief lists as a confirmed fact that
> "the URL the app uses does not resolve." Against the live data that is only
> true of the **`/_next/image?url=…` optimizer URL**, not the underlying Firebase
> URL — every stored Firebase URL resolved 200 for me. §1 explains how both can
> be true at once, and gives the one-line DevTools check to confirm which layer
> 404s in the instructor's browser.

---

## Section 0 — Storage backend reconciliation

**Course thumbnails use Firebase Storage. Full stop — not R2.** The codebase has
a documented split:

| Asset | Backend | Transport | Evidence |
|---|---|---|---|
| **Course cover / thumbnail** | **Firebase Storage** | client SDK `uploadBytesResumable` → `getDownloadURL()` | `components/CourseDashboard.tsx:287-311` |
| Course files (PDFs, etc.) | Cloudflare R2 | server action streams to R2 | `app/actions/upload_File_actions.ts`, `lib/R2/*` |
| Payment receipts | Cloudflare R2 | presigned PUT | `app/api/wallet/topup/upload-receipt` |

Cover upload path (`onImageSubmit`, `components/CourseDashboard.tsx:271-337`):
```ts
const path = `courses/${course.id}/thumbnail/${Date.now()}-${data.image.file.name}`;
const storageRef = ref(storage, path);                 // storage = getStorage(app), firebase/client.ts:20
const uploadTask = uploadBytesResumable(storageRef, data.image.file);
await new Promise(...);                                  // wait for upload
const downloadURL = await getDownloadURL(storageRef);    // ← tokenized URL
const result = await SaveThumbnail({ courseId, thumbnailUrl: downloadURL }, token);
```
- `firebase/client.ts:10` bucket = `readiq-1f109.firebasestorage.app`.
- `SaveThumbnail` (`app/course-upload/action.ts:161-237`) persists the string
  verbatim into `courses/{id}.thumbnailUrl` (`updateCourseThumbnail`-style
  `.update({ thumbnailUrl, updatedAt })`). No transformation, no hand-building.
- `DeleteThumbnail` (`app/course-upload/action.ts:387-473`) parses the stored URL
  back to a Storage path and `bucket.file(path).delete()`, then sets
  `thumbnailUrl: null`.

So the displayed URL **points at the same Firebase object that was uploaded**, in
the canonical download-URL form. The bucket path the instructor saw in the
console (`courses/<id>/thumbnail/<file>.webp`) is exactly what this code writes.

---

## Section 1 — The URL (Symptom A)

### 1a. What string is persisted and handed to the image
The persisted `thumbnailUrl` is option **(a)** from the brief — the
**`getDownloadURL()` result**:
```
https://firebasestorage.googleapis.com/v0/b/readiq-1f109.firebasestorage.app/o/courses%2F<id>%2Fthumbnail%2F<ts>-<name>?alt=media&token=<uuid>
```
Not `gs://` (b), not a hand-built `storage.googleapis.com/<bucket>/<path>` (c).
The code calls `getDownloadURL()` and persists **that** — the safe path. Confirmed
in code **and** in the live data (every URL had `alt=media` **and** `token=`).

### 1b. Does it resolve? (live probe, all 15 docs)
Every populated cover returned **200 with image bytes**. Representative rows:

| Course | status | URL form | direct GET | via `/_next/image` |
|---|---|---|---|---|
| From Diagnosis to Extraction | published | firebasestorage +token | **200** `image/png` (1.9 MB) | **200** |
| Exocad course from A to Z | published | firebasestorage +token | **200** `image/jpeg` (5.9 KB) | **200** |
| Orthodontic Fundamentals | published | firebasestorage +token | **200** `image/png` | **200** |
| تعلم البرمجه من الصفر | draft | firebasestorage +token | **200** `image/webp` (the 40 KB webp) | **200** |
| Orthodontist Tips and Tricks | draft | firebasestorage +token | **200** `image/png` | **200** |
| Endodontic course | draft | firebasestorage +token | **200** `image/png` | **200** |

(Empty-cover docs are drafts/archived with no `thumbnailUrl` — they render the
local placeholder by design, not by failure.)

**Implication:** the persisted URL is valid and durable; the token is present; the
object is public-via-token. Symptom A is **not** a wrong/expiring/token-less
persisted URL, and not a path mismatch.

### 1c. Storage rules / App Check
- **No `storage.rules` in the repo** (and no `firebase.json`). Storage rules are
  managed in the Firebase console, not version-controlled here — so I can't quote
  them. But it doesn't matter for diagnosis: **unauthenticated** `fetch()`s of
  these download URLs returned **200**. A tokenized download URL bypasses Storage
  rules by design, so even auth-required rules wouldn't 403 it.
- **App Check:** the console banner is **not enforced on Storage reads** here — if
  it were, my unauthenticated, App-Check-less GETs would have been **403**. They
  were **200**. So App Check is advisory/unconfigured for these reads. **Ruled
  out.**

### 1d. next/image — the actual failing layer
Both surfaces render with **`next/image`**, which does **not** hand the Firebase
URL to the browser directly — it rewrites it to
`/_next/image?url=<firebase URL>&w=<width>&q=75` and the browser loads **that**.

- Editor preview: `components/thumb_nail_uploder.tsx:222`
  `<Image src={image.url} fill className="object-cover …" />` — **`fill` with no
  `sizes`** (defaults to `100vw` → requests the *largest* width variant), **no
  `onError` handler**, not `unoptimized`.
- Catalog card: `components/CoursesCardList.tsx:254` — `<Image>` **with** `sizes`
  **and** `onError={() => setImageError(true)}` → on failure it swaps to the
  `BookOpen` "book placeholder."
- Detail hero: `components/CoursePreview.tsx:402` — `<Image fill>` with no `sizes`,
  src falls back to `/images/course-placeholder.jpg` only when `thumbnailUrl` is
  empty (not on load error).

`next.config.ts` (current committed values — **the image-optimization "leak fix"
is NOT applied here**; `docs/AUDIT_IMAGE_OPTIMIZATION.md` was discovery-only):
```ts
images: {
  remotePatterns: [
    { protocol: "https", hostname: "lh3.googleusercontent.com", port: "", pathname: "/**" },
    { protocol: "https", hostname: "firebasestorage.googleapis.com" },   // ← host IS allowed
    { protocol: "https", hostname: "storage.googleapis.com" },
    { protocol: "https", hostname: "image.mux.com", port: "", pathname: "/**" },
  ],
}
// minimumCacheTTL: not set (default)   deviceSizes: not set (default 8)
// imageSizes: not set (default 8)      formats: not set (WebP only)
```
On a local `next start` of this commit, the optimizer **succeeded (200)** for
these URLs at every width (w=640 cached ~32 ms; w=1080/2048/3840 each ~2.4–3.4 s —
the optimizer caps at the source's intrinsic width). So **in this committed
config the optimizer works**.

**Conclusion for A:** the bytes are in the bucket, the persisted Firebase URL is
valid (200), but the app displays it **through the `next/image` optimizer**. The
broken icon is the **`/_next/image?url=…` request failing in the instructor's
running environment** — not the Firebase URL. The two surfaces differ in fallback:
the editor `<Image>` has **no `onError`**, so a failed optimizer request shows a
**raw broken-image icon**; the card has `onError`, so the same failure shows the
**book placeholder**. This single mechanism explains *both* observations.

Why the optimizer would fail there but 200 here (could not be reproduced from the
audit sandbox — flagged, ranked by likelihood):
1. **Deployed config divergence** — the *running* deployment's `images`
   config differs from this branch (e.g. the "transformation-leak fix" narrowed
   `remotePatterns` / dropped `firebasestorage.googleapis.com`, or added a
   restrictive `loader`/`minimumCacheTTL`). A host missing from `remotePatterns`
   makes `/_next/image` return **400** → broken icon. **Most likely** given the
   brief keeps citing a recent image-config change that is *not* in this branch.
2. **Vercel Image Optimization limits/quota** — the `fill`-without-`sizes`
   preview requests the largest width of a multi-MB original (e.g. the 1.9 MB PNG)
   on every load; transform timeouts/quota exhaustion return non-200.
3. **Stale CDN/browser cache** of a previously-broken `/_next/image` response.

**One-line confirmation for the instructor:** open DevTools → Network, reload the
broken cover, click the failing image request. If the failing URL is
`/_next/image?url=…` → it's the optimizer (causes 1–3). If it's the raw
`firebasestorage.googleapis.com/...` request that 403/404s → re-check that exact
course's token in Firestore (none did in my sweep).

---

## Section 2 — Display binding (Symptom B: delete needs a hard refresh)

### 2a. Every editor surface that shows the current cover
There is exactly **one** cover surface in the editor:
`components/CourseDashboard.tsx:1160-1166`
```tsx
<ThumbNailUploader
  onImageChange={(image) => field.onChange(image)}
  image={field.value}          // ← bound to the react-hook-form "image" field
  onDelete={handleDeleteThumbnail}
  isDeleting={deletingThumbnail}
/>
```
It is rendered inside `<FormField name="image" render={({field}) => …}>`, so the
displayed cover reads from **react-hook-form state (`field.value`)** — *not* from
the server prop and *not* from the local `course` state.

| Surface | Reads from | Updated by delete today? |
|---|---|---|
| Editor uploader (`field.value`) | **RHF form state** | ❌ no — handler updates `course`, not the form |
| (no other cover surface exists in the editor) | — | — |
| Catalog card / detail hero / "my courses" list | **server RSC prop** (`fetchCourseDetails` / `getCourses`) | ❌ no — no `revalidatePath` in the action |

### 2b. Why `setCourse({…, thumbnailUrl: undefined})` does NOT clear the cover
This is the crux. The delete handler (`components/CourseDashboard.tsx:339-381`,
as changed by 08531b8) does:
```ts
setCourse((prev) => ({ ...prev, thumbnailUrl: undefined }));   // line 370
```
But the visible cover is bound to **`field.value`** (the form's `image` field),
**not** to `course.thumbnailUrl`. `course.thumbnailUrl` is only read at *mount* to
seed the form (`:152`, `:188`) — it is **never** the live render source for the
uploader. So mutating `course` state cannot clear a cover whose display is bound
to form state. **The handler updates the wrong source.**

Before 08531b8, `router.refresh()` re-ran the editor route → `fetchCourseDetails`
returned `thumbnailUrl: null` → the `[defaultValues]` effect (`:169-196`) ran
`form.reset({ image: undefined })`, which **did** clear the bound form field.
Removing the refresh removed that `form.reset` path, exposing the gap.

### 2c. Does `ThumbNailUploader.removeImageLocally` clear what the user sees?
In principle it should; in practice it's the unreliable half of the chain.
`components/thumb_nail_uploder.tsx:141-156`:
```ts
const images = image ? [image] : [];               // derived from the prop each render
const removeImageLocally = (imageId) => {
  ...
  handleImagesChange(images.filter((img) => img.id !== imageId));  // → onImageChange(undefined)
};
const handleDeleteImage = async (image) => {
  if (image.isExisting && onDelete) {
    await onDelete();            // parent handleDeleteThumbnail (confirm + server delete + setCourse)
    removeImageLocally(image.id); // → field.onChange(undefined)
  } else { removeImageLocally(image.id); }
};
```
`removeImageLocally` calls `onImageChange(undefined)` → `field.onChange(undefined)`,
which *is* the form field the uploader renders — so it operates on the right
surface. But it is the **child's** responsibility, fired *after* `await onDelete()`,
and it is the only thing now clearing the field (the parent no longer does). Given
the instructor still sees the cover until a hard refresh, this child-only
`field.onChange(undefined)` is **not reliably re-binding the visible cover** (it
runs after an `await`, in a closure, and passing `undefined` through
`Controller.onChange` is the brittle case in react-hook-form). The robust source
of truth is the parent handler, which today clears `course` (unrendered) instead
of the form field (rendered).

**The display source that must re-bind:** the **react-hook-form `image` field**
(`field.value`). The delete handler must clear *that* (e.g. `form.setValue("image",
undefined)` / `form.reset({ image: undefined })`) — and the upload handler already
correctly sets it (`form.setValue("image", {…})`, `:321-325`). We cannot
reintroduce `router.refresh()` (that is the Symptom-2 bounce).

> Server-rendered surfaces (catalog card, detail hero, "my courses" list) are a
> **separate** propagation gap: `SaveThumbnail` and `DeleteThumbnail` call **no
> `revalidatePath`** (unlike `publishCourse`/`unpublishCourse`, which do). So a
> cover change/delete never invalidates those caches — they stay stale until TTL
> / redeploy / hard navigation regardless of any client state. This is why the
> cover also "doesn't clear on the course."

---

## Section 3 — Catalog placeholders ("From Diagnosis…" / "Exocad…")

Both are **published, populated, and resolve 200**:

| Course | `thumbnailUrl` populated? | URL form | resolves |
|---|---|---|---|
| From Diagnosis to Extraction | **Yes** | firebasestorage +token | **200** `image/png` (~1.9 MB) |
| Exocad course from A to Z | **Yes** | firebasestorage +token | **200** `image/jpeg` (~5.9 KB) |

So they are **not** an empty-field/third case, and the persisted URL is **not**
broken. If they render as book placeholders, that is the **catalog card's
`onError` fallback firing because the `/_next/image` optimizer request failed** —
the **same** root cause as Symptom A (§1d), not a separate bug. (The large 1.9 MB
PNG is the most likely to trip an optimizer limit under the `fill`/no-`sizes` →
largest-width path.)

---

## Closing

### One cause or two? — **Two distinct root causes, shared plumbing.**

- **Symptom A (broken cover, editor + cards) — rendering/optimizer layer.** The
  Firebase object exists and its persisted download URL resolves 200. The break is
  the **`next/image` optimizer indirection** (`/_next/image?url=…`) failing in the
  deployed environment — most likely a **deployed `next.config` `images` mismatch**
  (host not in `remotePatterns`) and/or optimizer limits on the `fill`-without-
  `sizes` large-width request. Editor shows a raw broken icon (no `onError`); cards
  show the book placeholder (`onError`). Not a storage/URL/token/rules/App-Check
  bug — all ruled out by 200 responses.
- **Symptom B (delete needs hard refresh) — state-binding.** The editor cover is
  bound to react-hook-form `field.value`, but the delete handler mutates local
  `course.thumbnailUrl` (an unrendered source). Removing `router.refresh()` (08531b8)
  removed the `form.reset` path that used to clear the bound field. Independent of A.

### Fix options (not implemented)

**Symptom A — make the valid Firebase URL actually render:**
- **A1 (recommended, deterministic): bypass the optimizer for Firebase covers.**
  Add `unoptimized` to the cover `<Image>`s (`thumb_nail_uploder.tsx:222`,
  `CoursesCardList.tsx:254`, `CoursePreview.tsx:402`) — or render a plain `<img>`.
  Since the raw `getDownloadURL` URL is already 200, this makes the cover load
  regardless of optimizer/config state, and matches `docs/AUDIT_IMAGE_OPTIMIZATION.md`
  Rank 3. *Cost note:* this **removes** optimizer transformations for covers, so it
  does **not** reintroduce the transformation cost the leak-fix targeted — it
  reduces it. Trade-off: covers are served at full size (originals up to 10 MB), so
  pair with an upload-time resize if bandwidth matters.
- **A2 (keep the optimizer): make the deployed config match this branch.** Verify
  the *running* deployment's `images.remotePatterns` includes
  `firebasestorage.googleapis.com` (it does in this branch) and add accurate `sizes`
  to the `fill` covers so the optimizer stops requesting the largest width of
  multi-MB originals. Lower-confidence until the DevTools check (§1d) confirms the
  failing request is `/_next/image`.
- **A3 (always, cheap): add `onError` fallback to the editor `<Image>`** so the
  uploader degrades to a placeholder like the card instead of a raw broken icon.
  Cosmetic, not a root-cause fix.

> If any cache-bust is added as part of A, key it on `updatedAt` / the new object
> path (`?v={updatedAt}`), **not** a random value, so unchanged covers keep their
> cache entry and don't re-trigger transformations. With unique-per-upload paths
> (`…/${Date.now()}-${name}`) the URL already changes per upload, so no manual
> cache-bust is needed.

**Symptom B — re-bind the delete to the source the cover actually renders from:**
- **B1 (recommended): clear the form field in the handler.** In
  `handleDeleteThumbnail` success, replace/augment the `setCourse(… thumbnailUrl:
  undefined)` with `form.setValue("image", undefined)` (or `form.reset({ image:
  undefined })`). That updates **`field.value`**, the source the uploader renders —
  clearing the cover instantly with no refresh and no reliance on the child's
  post-`await` `field.onChange(undefined)`. (The upload handler already sets the
  form field correctly.)
- **B2 (server surfaces): add `revalidatePath` to the cover actions.** Have
  `SaveThumbnail` and `DeleteThumbnail` call `revalidatePath(\`/course/${courseId}\`)`
  (mirroring `publishCourse`/`unpublishCourse`) so the catalog card / detail hero /
  "my courses" list reflect a cover change without a hard refresh — without any
  client `router.refresh()`.
