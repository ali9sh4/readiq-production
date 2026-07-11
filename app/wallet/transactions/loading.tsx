import { Skeleton } from "@/components/ui/skeleton";

// Transactions skeleton — card with title + transaction row placeholders,
// matching the page's real row layout (icon + text block + amount).
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="p-6 border-b">
            <Skeleton className="h-6 w-36" />
          </div>
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <Skeleton className="w-9 h-9 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
