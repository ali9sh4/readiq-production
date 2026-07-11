import CoursesGridSkeleton from "@/components/CoursesGridSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Root segment skeleton — mirrors the homepage (sky hero + course grid) so
// slow connections see the page shape instantly instead of a blank screen.
// Also the fallback for any child segment without its own loading.tsx.
export default function Loading() {
  return (
    <div>
      {/* Hero band */}
      <section className="bg-sky-900">
        <div className="container mx-auto px-4 py-14 sm:py-20">
          <div className="max-w-2xl space-y-4">
            <Skeleton className="h-6 w-40 rounded-full bg-sky-800" />
            <Skeleton className="h-10 w-3/4 bg-sky-800" />
            <Skeleton className="h-10 w-1/2 bg-sky-800" />
            <Skeleton className="h-4 w-2/3 bg-sky-800" />
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-11 w-36 rounded-lg bg-sky-800" />
              <Skeleton className="h-11 w-36 rounded-lg bg-sky-800" />
            </div>
          </div>
        </div>
      </section>

      {/* Courses grid */}
      <section className="container mx-auto px-4 py-10">
        <Skeleton className="h-8 w-48 mb-6" />
        <CoursesGridSkeleton />
      </section>
    </div>
  );
}
