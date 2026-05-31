"use client";

import { useState } from "react";
import { useAuth } from "@/context/authContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, CheckCircle2, AlertCircle } from "lucide-react";
import { adminManualTopup } from "@/app/actions/wallet_actions";

function formatNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export default function AdminManualTopupPage() {
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(""); // raw digits, no commas
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    amount: number;
    newBalance: number;
  } | null>(null);

  const numAmount = Number(amount);
  const canSubmit =
    !loading &&
    email.trim().length > 0 &&
    Number.isInteger(numAmount) &&
    numAmount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const token = await user?.getIdToken();
    if (!token) {
      setError("يرجى تسجيل الدخول أولاً");
      return;
    }

    setLoading(true);
    try {
      const result = await adminManualTopup(token, {
        email: email.trim(),
        amount: numAmount,
        reason: reason.trim() || undefined,
      });

      if (result.success) {
        setSuccess({ amount: numAmount, newBalance: result.newBalance });
        setEmail("");
        setAmount("");
        setReason("");
      } else {
        setError(result.error || "فشل في شحن المحفظة");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء المعالجة");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div dir="rtl" className="max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-blue-600" />
            شحن محفظة يدوياً
          </CardTitle>
          <CardDescription>
            إضافة رصيد مباشرة إلى محفظة مستخدم عبر بريده الإلكتروني — بدون إيصال
            أو مراجعة.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني للمستخدم</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">المبلغ (د.ع)</Label>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                placeholder="10,000"
                value={formatNumber(amount)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, "");
                  if (/^\d*$/.test(raw)) setAmount(raw);
                }}
                className="h-11 text-lg font-bold tracking-wide"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">
                ملاحظة <span className="text-gray-400">(اختياري)</span>
              </Label>
              <Input
                id="reason"
                type="text"
                placeholder="سبب الشحن اليدوي"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-11"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-medium">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-300 bg-green-50 text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="font-medium">
                  تم شحن {success.amount.toLocaleString()} د.ع بنجاح. الرصيد
                  الجديد: {success.newBalance.toLocaleString()} د.ع
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-11 font-semibold"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  جاري الشحن...
                </span>
              ) : (
                <>
                  <Wallet className="w-4 h-4 ml-2" />
                  شحن المحفظة
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
