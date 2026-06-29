// Grid-of-cards skeleton used as the <Suspense> fallback around the
// data-fetching InstructorCourse subtree, so the page shell (header, action
// button) paints immediately while the Firestore-backed course list streams
// in. Columns mirror CoursesCardList's grid to minimize layout shift.
export default function CoursesGridSkeleton({
  count = 8,
}: {
  count?: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
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
  );
}
