import { Suspense } from "react";
// Reuse the existing error UI. This page fixes a latent 404: redirects across
// the payment flows target "/payments/error", but the only page previously
// living under that name was at "/api/payments/error". Now "/payments/error"
// resolves for real.
import PaymentErrorContent from "@/app/api/payments/error/PaymentErrorContent";

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
