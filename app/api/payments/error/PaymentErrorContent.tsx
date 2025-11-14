"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, RefreshCcw, HelpCircle } from "lucide-react";

export default function PaymentErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState("");

  useEffect(() => {
    const errorCode = searchParams.get("message") || "unknown";

    const errorMap: Record<string, { title: string; details: string }> = {
      missing_token: {
        title: "خطأ في التحقق",
        details:
          "لم يتم التحقق من هويتك. يرجى تسجيل الدخول والمحاولة مرة أخرى.",
      },
      invalid_token: {
        title: "رمز التحقق غير صالح",
        details: "انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.",
      },
      enrollment_not_found: {
        title: "طلب الدفع غير موجود",
        details:
          "لم نتمكن من العثور على طلب التسجيل الخاص بك. قد تكون العملية قد انتهت أو تم إلغاؤها.",
      },
      processing_error: {
        title: "خطأ في معالجة الدفع",
        details: "حدث خطأ أثناء معالجة دفعتك. لم يتم خصم أي مبلغ من حسابك.",
      },
      payment_cancelled: {
        title: "تم إلغاء الدفع",
        details: "قمت بإلغاء عملية الدفع. لم يتم خصم أي مبلغ.",
      },
      payment_timeout: {
        title: "انتهت مهلة الدفع",
        details: "انتهت صلاحية جلسة الدفع. يرجى المحاولة مرة أخرى.",
      },
      unknown: {
        title: "خطأ غير متوقع",
        details: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى أو الاتصال بالدعم.",
      },
    };

    const error = errorMap[errorCode] || errorMap.unknown;
    setErrorMessage(error.title);
    setErrorDetails(error.details);
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-12 h-12 text-orange-600" />
          </div>
        </div>

        <div className="text-center space-y-3 mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{errorMessage}</h1>
          <p className="text-gray-600 leading-relaxed">{errorDetails}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">ماذا حدث؟</p>
              <p className="text-blue-700">
                لم يتم خصم أي مبلغ من حسابك. يمكنك المحاولة مرة أخرى بأمان.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => router.back()}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <RefreshCcw className="w-5 h-5 ml-2" />
            المحاولة مرة أخرى
          </Button>

          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <Home className="w-5 h-5 ml-2" />
            العودة للرئيسية
          </Button>
        </div>
      </div>
    </div>
  );
}


