// Route-level loading skeleton for /admin-dashboard. The segment previously had
// no loading.tsx, so navigating in showed no transition state (the page is a
// client component that only renders its own "جاري التحميل..." text after mount
// once its realtime listeners resolve). This skeleton approximates the dashboard
// shell — header band, the stats-card row, and a content card grid — so the
// route transition shows structure that matches the destination layout.
//
// NB: this covers the navigation/RSC phase only. The page's client-side data
// load (the onSnapshot listeners noted in docs/NAV_AND_COURSE_EDITOR_AUDIT.md,
// Symptom 1 root cause #6) is a separate, out-of-scope concern.
export default function Loading() {
  return (
    <div dir="rtl" className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="h-9 w-56 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg p-6"
          >
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
              <div className="space-y-2">
                <div className="h-6 w-12 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + tabs */}
      <div className="space-y-4">
        <div className="h-10 w-full max-w-md bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-28 bg-gray-200 rounded animate-pulse"
            />
          ))}
        </div>
      </div>

      {/* Course list grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden bg-white border border-gray-200"
          >
            <div className="h-40 bg-gray-200 animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
