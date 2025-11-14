import { Suspense } from "react";
import PaymentErrorContent from "./PaymentErrorContent";


export default function PaymentErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-orange-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
      }
    >
      <PaymentErrorContent />
    </Suspense>
  );
}
