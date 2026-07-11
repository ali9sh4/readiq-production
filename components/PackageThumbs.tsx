"use client";

// Stacked / overlapping course thumbnails — the at-a-glance "this is several
// courses, not one" signal shared by the package banner and checkout modal.
//
// Plain <img> on purpose: course thumbnails can sit on hosts not pinned in
// next.config.ts `images.remotePatterns`, and a UI-polish pass should not
// touch image config. Thumbnails are tiny here, so <img> is fine.

// Course thumbnail value → render-safe URL. Mirrors the helper in
// CoursesCardList.tsx: absolute URLs pass through, bare storage paths are
// wrapped, missing values fall back to the shared placeholder.
export function thumbSrc(url: string | null | undefined): string {
  if (!url) return "/images/course-placeholder.jpg";
  if (url.startsWith("http")) return url;
  return `https://firebasestorage.googleapis.com/v0/b/readiq-1f109.firebasestorage.app/o/${encodeURIComponent(
    url
  )}?alt=media`;
}

export function StackedThumbs({
  thumbnails,
  size = "md",
}: {
  thumbnails: string[];
  size?: "sm" | "md";
}) {
  const max = 4;
  const shown = thumbnails.slice(0, max);
  const extra = thumbnails.length - shown.length;
  const dim = size === "sm" ? "h-9 w-9" : "h-12 w-12";

  return (
    <div className="flex shrink-0 items-center">
      {shown.map((t, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={thumbSrc(t)}
          alt=""
          style={{ zIndex: max - i }}
          className={`${dim} ${
            i > 0 ? "-mr-3" : ""
          } rounded-lg border-2 border-white object-cover shadow-sm`}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/images/course-placeholder.jpg";
          }}
        />
      ))}
      {extra > 0 && (
        <div
          className={`${dim} -mr-3 flex items-center justify-center rounded-lg border-2 border-white bg-amber-100 text-xs font-bold text-amber-800 shadow-sm`}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
