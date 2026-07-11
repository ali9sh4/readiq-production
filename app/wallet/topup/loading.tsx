import { Skeleton } from "@/components/ui/skeleton";

// Wallet top-up skeleton — centered card with the wizard stepper + fields.
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
          {/* Stepper */}
          <div className="flex items-center justify-center gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-6 w-48 mx-auto" />
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
