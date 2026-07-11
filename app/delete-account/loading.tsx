import { Skeleton } from "@/components/ui/skeleton";

// Delete-account skeleton — the server-side eligibility check can be slow on
// weak connections; show the card shape instead of a blank page.
export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-10">
      <div className="max-w-xl mx-auto rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
    </div>
  );
}
