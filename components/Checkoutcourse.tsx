"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Wallet, CreditCard, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
// 🔥 Import server actions
import { getWalletBalance, purchaseCourseWithWallet } from "@/app/actions/wallet_actions";

interface CourseCheckoutProps {
  courseId: string;
  courseTitle: string;
  coursePrice: number;
  onSuccess?: () => void;
}

export default function CourseCheckout({
  courseId,
  courseTitle,
  coursePrice,
  onSuccess,
}: CourseCheckoutProps) {
  const { user, getToken } = useAuth();
  const router = useRouter();

  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "zaincash">("wallet");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWalletBalance();
    }
  }, [user]);

  const fetchWalletBalance = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      // 🔥 Call server action directly
      const result = await getWalletBalance(token);

      if (result.success) {
        setWalletBalance(result.balance || 0);
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  };

  const handleWalletPurchase = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        setError("يرجى تسجيل الدخول أولاً");
        return;
      }

      // 🔥 Call server action directly
      const result = await purchaseCourseWithWallet(token, courseId);

      if (!result.success) {
        setError(result.error || "فشل في إتمام الشراء");
        return;
      }

      setSuccess(true);
      setWalletBalance(result.newBalance || 0);
      
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        router.push(`/Course/${courseId}?payment=success`);
        router.refresh();
      }, 2000);
    } catch (error: any) {
      setError(error.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  const handleZainCashPurchase = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        setError("يرجى تسجيل الدخول أولاً");
        return;
      }

      // Keep your existing ZainCash API route
      const response = await fetch("/api/payments/zaincash/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, courseTitle, amount: coursePrice, token }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "فشل في إنشاء الدفع");
        return;
      }

      window.location.href = data.redirectUrl;
    } catch (error: any) {
      setError(error.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = () => {
    if (paymentMethod === "wallet") {
      handleWalletPurchase();
    } else {
      handleZainCashPurchase();
    }
  };

  if (!user) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          يرجى{" "}
          <Link href={`/login?redirect=/Course/${courseId}`} className="underline font-medium">
            تسجيل الدخول
          </Link>{" "}
          لشراء الدورة
        </AlertDescription>
      </Alert>
    );
  }

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-green-900">تم الشراء بنجاح!</h3>
            <p className="text-green-700">يمكنك الآن الوصول إلى جميع محتويات الدورة</p>
            {walletBalance !== null && (
              <p className="text-sm text-green-600">
                رصيدك الحالي: {walletBalance.toLocaleString()} د.ع
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasEnoughBalance = walletBalance !== null && walletBalance >= coursePrice;

  return (
    <Card>
      <CardHeader>
        <CardTitle>إتمام الشراء</CardTitle>
        <CardDescription>اختر طريقة الدفع لشراء الدورة</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Course Info */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">الدورة</p>
          <p className="font-medium">{courseTitle}</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {coursePrice.toLocaleString()} د.ع
          </p>
        </div>

        {/* Payment Method Selection */}
        <RadioGroup value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)} className="space-y-3">
          {/* Wallet Option */}
          <div
            className={`flex items-start space-x-3 space-x-reverse border-2 rounded-lg p-4 cursor-pointer transition-all ${
              paymentMethod === "wallet" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}
            onClick={() => setPaymentMethod("wallet")}
          >
            <RadioGroupItem value="wallet" id="wallet" />
            <Label htmlFor="wallet" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Wallet className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">المحفظة الإلكترونية</p>
                  {walletBalance !== null && (
                    <p className="text-sm text-gray-600">رصيدك: {walletBalance.toLocaleString()} د.ع</p>
                  )}
                  {!hasEnoughBalance && walletBalance !== null && (
                    <p className="text-sm text-red-600 mt-1">
                      رصيد غير كافٍ. تحتاج إلى {(coursePrice - walletBalance).toLocaleString()} د.ع إضافية
                    </p>
                  )}
                </div>
              </div>
            </Label>
          </div>

          {/* ZainCash Option */}
          <div
            className={`flex items-start space-x-3 space-x-reverse border-2 rounded-lg p-4 cursor-pointer transition-all ${
              paymentMethod === "zaincash" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}
            onClick={() => setPaymentMethod("zaincash")}
          >
            <RadioGroupItem value="zaincash" id="zaincash" />
            <Label htmlFor="zaincash" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CreditCard className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">زين كاش</p>
                  <p className="text-sm text-gray-600">الدفع عبر بطاقة أو محفظة زين كاش</p>
                </div>
              </div>
            </Label>
          </div>
        </RadioGroup>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Low Balance Warning */}
        {paymentMethod === "wallet" && !hasEnoughBalance && walletBalance !== null && (
          <Alert>
            <AlertDescription className="flex items-center justify-between">
              <span>رصيدك غير كافٍ. شحن المحفظة أولاً</span>
              <Link href="/wallet/topup">
                <Button size="sm" variant="outline" className="gap-2">
                  شحن المحفظة
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Checkout Button */}
        <Button
          onClick={handleCheckout}
          disabled={loading || (paymentMethod === "wallet" && !hasEnoughBalance)}
          className="w-full"
          size="lg"
        >
          {loading ? "جاري المعالجة..." : paymentMethod === "wallet" ? "ادفع من المحفظة" : "متابعة إلى زين كاش"}
        </Button>
      </CardContent>
    </Card>
  );
}