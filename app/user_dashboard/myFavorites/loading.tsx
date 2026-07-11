import CoursesGridSkeleton from "@/components/CoursesGridSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Favorites skeleton — header + course card grid (FavoritesClient layout).
export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <CoursesGridSkeleton count={8} />
    </div>
  );
}
