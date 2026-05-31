"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, History } from "lucide-react";

import { TopupWizard } from "./_components/TopupWizard";

export default function TopUpPage() {
  const auth = useAuth();
  const router = useRouter();

  const [success, setSuccess] = useState(false);

  // Redirect if not authenticated. Wait for auth to resolve — without
  // the isLoading gate, the initial null-user state (Firebase Auth not
  // yet hydrated) would fire a spurious push to /login, where middleware
  // sees the valid cookie and bounces the user home.
  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      router.push("/login?redirect=/wallet/topup");
    }
  }, [auth.isLoading, auth.user, router]);

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!auth.user) {
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-3 sm:p-4 bg-green-50">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-6 sm:pt-8 pb-6 sm:pb-8 px-4 sm:px-6">
            <div className="flex flex-col items-center text-center space-y-4 sm:space-y-5">
              <div className="p-2.5 sm:p-3 bg-green-100 rounded-full">
                <CheckCircle2 className="w-12 h-12 sm:w-14 sm:h-14 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                  تم! ✅
                </h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  تأكد أنك أرسلت صورة الإيصال عبر واتساب.
                  <br />
                  سيتم إضافة الرصيد إلى محفظتك بعد المراجعة خلال{" "}
                  <strong>15-60 دقيقة</strong>
                </p>
              </div>
              <Button
                onClick={() => router.push("/wallet/transactions")}
                variant="outline"
                className="mt-2 text-sm sm:text-base"
                size="sm"
              >
                <History className="w-4 h-4 ml-2" />
                عرض سجل العمليات
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <TopupWizard onSuccess={() => setSuccess(true)} />;
}
