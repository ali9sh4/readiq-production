import { Suspense } from "react";
import CompleteContent from "./CompleteContent";

// Landing page after a ZainCash top-up callback. Reads `?txn=`, fetches the
// stored intent, and finishes any deferred enrollment via the existing
// wallet-pays-enrollment path. Wrapped in Suspense because CompleteContent
// uses useSearchParams.
export default function TopupCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <CompleteContent />
    </Suspense>
  );
}
