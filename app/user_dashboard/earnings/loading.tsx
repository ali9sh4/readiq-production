import { Skeleton } from "@/components/ui/skeleton";

// Earnings skeleton — h1 + three totals cards + ledger table rows.
export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-5 space-y-3"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <Skeleton className="h-5 w-36" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
