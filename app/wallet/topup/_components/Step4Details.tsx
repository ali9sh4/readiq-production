"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  TOPUP_PAYMENT_METHODS,
  type TopupPaymentMethodId,
} from "../constants";

interface Step4Props {
  methodId: TopupPaymentMethodId;
  amount: string;
  senderName: string;
  loading: boolean;
  error: string | null;
  onAmountChange: (raw: string) => void;
  onSenderNameChange: (value: string) => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

function formatNumber(value: string): string {
  const numbers = value.replace(/\D/g, "");
  return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function Step4Details({
  methodId,
  amount,
  senderName,
  loading,
  error,
  onAmountChange,
  onSenderNameChange,
  onBack,
  onSubmit,
}: Step4Props) {
  const method = TOPUP_PAYMENT_METHODS[methodId];
  const numAmount = Number(amount.replace(/,/g, ""));
  const amountValid = numAmount >= 1000 && numAmount <= 5000000;
  const canSubmit = amountValid && senderName.trim().length > 0 && !loading;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          أكمل البيانات
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          سنراجع طلبك خلال 15-60 دقيقة بعد الإرسال
        </p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs sm:text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">طريقة الدفع المختارة</span>
          <span className="font-semibold text-gray-900">{method.label}</span>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-gray-600">رقم الحساب</span>
          <span className="font-mono text-gray-900" dir="ltr">
            {method.number}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount" className="text-sm sm:text-base font-semibold">
          المبلغ الذي تم تحويله (دينار عراقي)
        </Label>
        <div className="relative">
          <Input
            id="amount"
            type="text"
            inputMode="numeric"
            placeholder="10,000"
            value={formatNumber(amount)}
            onChange={(e) => {
              const rawValue = e.target.value.replace(/,/g, "");
              if (/^\d*$/.test(rawValue)) {
                onAmountChange(rawValue);
              }
            }}
            className="text-center text-2xl sm:text-3xl font-bold h-12 sm:h-14 tracking-wide bg-gray-50"
            required
          />
          <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-500 text-base sm:text-lg font-semibold">
            د.ع
          </span>
        </div>
        <p className="text-[11px] sm:text-xs text-center text-gray-600">
          الحد الأدنى: 1,000 د.ع | الحد الأقصى: 5,000,000 د.ع
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="senderName" className="text-sm sm:text-base">
          اسم المرسل <span className="text-red-500">*</span>
        </Label>
        <Input
          id="senderName"
          value={senderName}
          onChange={(e) => onSenderNameChange(e.target.value)}
          placeholder="الاسم الكامل"
          className="h-11 text-sm sm:text-base"
          required
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-medium text-sm">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="h-11 px-4 text-sm"
        >
          <ArrowRight className="w-4 h-4 ml-1" />
          رجوع
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 h-11 sm:h-12 text-sm sm:text-base font-semibold"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              جاري الإرسال...
            </span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              إرسال طلب الشحن
              <ArrowLeft className="w-4 h-4 mr-1" />
            </>
          )}
        </Button>
      </div>

      <p className="text-[11px] sm:text-xs text-gray-600 text-center leading-relaxed bg-blue-50 p-2.5 rounded-lg">
        <strong>ملاحظة:</strong> تتم مراجعة الطلبات خلال 15-60 دقيقة في أوقات
        العمل. يرجى التأكد من صحة جميع المعلومات قبل الإرسال.
      </p>
    </form>
  );
}
