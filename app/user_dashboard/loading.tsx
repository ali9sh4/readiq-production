import CoursesGridSkeleton from "@/components/CoursesGridSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Dashboard skeleton — mirrors DashboardHome (blue welcome banner + enrolled
// courses card with grid) instead of the old bare spinner, so the page shape
// is visible immediately on slow connections.
export default function Loading() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome banner */}
      <div className="rounded-3xl bg-blue-600 p-6 sm:p-8 space-y-3">
        <Skeleton className="h-7 w-56 bg-blue-500" />
        <Skeleton className="h-4 w-72 bg-blue-500" />
      </div>

      {/* Enrolled courses card */}
      <div className="bg-white rounded-3xl shadow-xl border-2 border-gray-100 p-6 sm:p-8 space-y-6">
        <Skeleton className="h-6 w-44" />
        <CoursesGridSkeleton count={4} />
      </div>
    </div>
  );
}
