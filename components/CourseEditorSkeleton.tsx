import { Skeleton } from "@/components/ui/skeleton";

// Skeleton for the course editor pages (/course-upload/edit/[courseId] and
// /user_dashboard/createdCourses/[courseId]) — h1 + white card wrapping the
// multi-tab CourseDashboard form.
export default function CourseEditorSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Skeleton className="h-9 w-44 mt-6 mb-4" />

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Tabs row */}
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-md" />
          ))}
        </div>

        {/* Form fields */}
        <div className="space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-28 w-full rounded-md" />
          </div>
        </div>

        {/* Save button */}
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
    </div>
  );
}
