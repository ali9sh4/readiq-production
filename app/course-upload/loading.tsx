// Route-level loading skeleton for /course-upload (and child routes that don't
// define their own loading.tsx). Previously this segment had none, so a
// navigation here blocked silently until the server resolved. The skeleton
// approximates the "your published courses" listing — a header band plus a
// responsive card grid matching CoursesCardList's columns — so the transition
// shows structure instead of a blank/abrupt swap.
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gray-200 rounded-xl animate-pulse" />
            <div className="space-y-2">
              <div className="h-7 w-48 sm:w-64 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-56 sm:w-80 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Courses grid placeholder */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-6">
          <div className="h-1 bg-blue-600" />
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl lg:rounded-2xl overflow-hidden bg-white border border-gray-200"
                >
                  <div className="h-40 sm:h-48 md:h-52 lg:h-44 bg-gray-200 animate-pulse" />
                  <div className="p-3 md:p-4 space-y-2">
                    <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
                    <div className="h-5 w-1/2 bg-gray-200 rounded animate-pulse ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom action button placeholder */}
        <div className="flex justify-center pb-6">
          <div className="h-12 w-56 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
