import { cn } from "@/lib/utils";

/**
 * Skeleton placeholder block. Matches the repo's existing hand-rolled
 * convention (bg-gray-200 + animate-pulse) used by CoursesGridSkeleton and
 * the route loading.tsx files.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-gray-200 animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
