"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Wallet,
  AlertCircle,
  CheckCircle2,
  History,
  Smartphone,
  CreditCard,
} from "lucide-react";
import { createTopupRequest } from "@/app/actions/wallet_actions";

export default function TopUpPage() {
  const auth = useAuth();
  const router = useRouter();

  // Form states
  const [amount, setAmount] = useState("");
  const [senderName, setSenderName] = useState("");

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Format number with thousand separators
  const formatNumber = (value: string): string => {
    const numbers = value.replace(/\D/g, "");
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!auth.user) {
      router.push("/login?redirect=/wallet/topup");
    }
  }, [auth.user, router]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    const numAmount = Number(amount.replace(/,/g, ""));

    if (!amount || numAmount < 1000) {
      setError("الحد الأدنى للإيداع 1,000 دينار عراقي");
      return;
    }

    if (numAmount > 5000000) {
      setError("الحد الأقصى للإيداع 5,000,000 دينار عراقي");
      return;
    }

    if (!senderName.trim()) {
      setError("يرجى إدخال اسم المرسل");
      return;
    }

    setLoading(true);

    try {
      // Upload receipt

      // Get token
      const token = await auth.user?.getIdToken();
      if (!token) {
        throw new Error("يرجى تسجيل الدخول أولاً");
      }

      // Create topup request
      const result = await createTopupRequest(token, {
        amount: numAmount,
        senderName: senderName.trim(),
      });

      if (!result.success) {
        throw new Error(result.error || "فشل في إرسال الطلب");
      }

      setSuccess(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/wallet/transactions");
      }, 2000);
    } catch (error: any) {
      console.error("Topup error:", error);
      setError(error.message || "حدث خطأ أثناء معالجة الطلب");
    } finally {
      setLoading(false);
    }
  };

  // Show nothing while redirecting
  if (!auth.user) {
    return null;
  }

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-emerald-50">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle2 className="w-14 h-14 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900">
                  تم إرسال الطلب بنجاح! ✅
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  سيتم مراجعة طلبك خلال <strong>15-60 دقيقة</strong>
                  <br />
                  وإضافة الرصيد بعد التحقق من التحويل
                </p>
              </div>
              <Button
                onClick={() => router.push("/wallet/transactions")}
                variant="outline"
                className="mt-2"
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

  // Main form
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg border-gray-200">
          {/* Header */}
          <CardHeader className="border-b bg-white">
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Wallet className="w-6 h-6 text-blue-600" />
                  شحن المحفظة
                </CardTitle>
                <CardDescription className="text-gray-600 mt-1.5">
                  قم بتحويل المبلغ إلى أحد حساباتنا ثم أرسل إيصال التحويل الى
                  رقم الواتساب
                </CardDescription>
              </div>
              <Link
                href="/wallet/transactions"
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors hover:underline"
              >
                <History className="w-4 h-4" />
                الدفعات السابقة
              </Link>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {/* Payment Methods */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                💳 طرق الدفع المتاحة
              </h3>

              <div className="grid gap-3 md:grid-cols-2">
                {/* ZainCash */}
                <div className="bg-white rounded-lg p-3 border border-blue-300 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="w-4 h-4 text-purple-600" />
                    <p className="text-xs font-semibold text-gray-700">
                      محفظة زين كاش
                    </p>
                  </div>
                  <p className="font-bold text-purple-700 text-xl text-center tracking-wider font-mono">
                    07886552919
                  </p>
                </div>

                {/* MasterCard */}
                <div className="bg-white rounded-lg p-3 border border-blue-300 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-semibold text-gray-700">
                      ماستر كارد الرافدين
                    </p>
                  </div>
                  <p className="font-bold text-blue-700 text-xl text-center tracking-wider font-mono">
                    8775523072
                  </p>
                  <p className="text-xs text-gray-600 text-center mt-1">
                    Mr. ALI SHIHAB
                  </p>
                </div>
              </div>

              <Alert className="bg-amber-50 border-amber-300">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 text-xs">
                  <strong>تنبيه:</strong> تأكد من إرسال المبلغ للحساب الصحيح قبل
                  رفع الإيصال
                </AlertDescription>
              </Alert>
            </div>
            {/* Receipt Submission */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                إرسال إيصال التحويل <span className="text-red-500">*</span>
              </Label>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-5 h-5 text-green-600" />
                  <h4 className="font-bold text-gray-900">
                    أرسل صورة الإيصال عبر واتساب
                  </h4>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-green-400">
                  <p className="text-3xl font-bold text-center text-green-700 tracking-wider font-mono">
                    07886552919
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText("07886552919");
                      alert("تم نسخ الرقم!");
                    }}
                    variant="outline"
                    className="flex-1"
                    size="sm"
                  >
                    📋 نسخ الرقم
                  </Button>

                  <Button
                    type="button"
                    onClick={() => {
                      window.open("https://wa.me/9647886552919", "_blank");
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    💬 فتح واتساب
                  </Button>
                </div>

                <Alert className="bg-blue-50 border-blue-300">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-xs text-blue-800">
                    <strong>مهم:</strong> يرجى إرسال صورة واضحة للإيصال مع ذكر
                    اسمك في الرسالة
                  </AlertDescription>
                </Alert>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount" className="font-semibold">
                  المبلغ الذي تم تحويلة (دينار عراقي)
                </Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="text"
                    placeholder="10,000"
                    value={formatNumber(amount)}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/,/g, "");
                      if (/^\d*$/.test(rawValue)) {
                        setAmount(rawValue);
                      }
                    }}
                    className="text-center text-3xl font-bold h-14 tracking-wide bg-gray-50"
                    required
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-semibold">
                    د.ع
                  </span>
                </div>
                <p className="text-xs text-center text-gray-600">
                  الحد الأدنى: 1,000 د.ع | الحد الأقصى: 5,000,000 د.ع
                </p>
              </div>

              {/* Sender Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="senderName">
                    اسم المرسل <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="senderName"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="الاسم الكامل"
                    required
                  />
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="font-medium">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري الإرسال...
                  </span>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 ml-2" />
                    إرسال طلب الشحن
                  </>
                )}
              </Button>

              {/* Info Note */}
              <p className="text-xs text-gray-600 text-center leading-relaxed bg-blue-50 p-3 rounded-lg">
                <strong>ملاحظة:</strong> تتم مراجعة الطلبات خلال 15-60 دقيقة في
                أوقات العمل. يرجى التأكد من صحة جميع المعلومات قبل الإرسال.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
