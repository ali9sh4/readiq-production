import { Skeleton } from "@/components/ui/skeleton";

// Course detail skeleton — mirrors CoursePreview (hero cover + title/price/
// enroll column + curriculum accordion rows). This is the heaviest server
// fetch chain in the app, so the skeleton matters most here.
export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main column: cover + title + curriculum */}
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          {/* Meta chips (duration / students / level / language) */}
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
          {/* Curriculum accordion rows */}
          <div className="space-y-3 pt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Side column: price / enroll card */}
        <div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
