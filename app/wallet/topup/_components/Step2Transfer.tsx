"use client";

import { toast } from "sonner";
import { AlertCircle, Camera, Copy, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  TOPUP_PAYMENT_METHODS,
  type TopupPaymentMethodId,
} from "../constants";

interface Step2Props {
  methodId: TopupPaymentMethodId;
  onBack: () => void;
  onNext: () => void;
}

export function Step2Transfer({ methodId, onBack, onNext }: Step2Props) {
  const method = TOPUP_PAYMENT_METHODS[methodId];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(method.number);
      toast.success("تم نسخ الرقم!");
    } catch {
      toast.error("تعذّر النسخ، انسخ الرقم يدوياً");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          حوّل المبلغ
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          استخدم الرقم أدناه لإجراء التحويل من تطبيقك
        </p>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 sm:p-4 space-y-3">
        <p className="text-xs sm:text-sm font-semibold text-gray-700">
          {method.label}
        </p>
        <div className="bg-white rounded-lg p-3 sm:p-4 border border-blue-300">
          <p
            className="text-2xl sm:text-3xl font-bold text-center text-blue-700 tracking-wider font-mono"
            dir="ltr"
          >
            {method.number}
          </p>
          {method.holder && (
            <p className="text-xs sm:text-sm text-gray-600 text-center mt-1.5">
              {method.holder}
            </p>
          )}
        </div>
        <Button
          type="button"
          onClick={handleCopy}
          variant="outline"
          className="w-full h-11 text-sm"
        >
          <Copy className="w-4 h-4 ml-2" />
          نسخ الرقم
        </Button>
        <p className="text-[11px] sm:text-xs text-center text-gray-600">
          الحد الأدنى: 1,000 د.ع &nbsp;|&nbsp; الحد الأقصى: 5,000,000 د.ع
        </p>
      </div>

      <Alert className="bg-amber-50 border-amber-300">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-xs sm:text-sm">
          <strong>تنبيه:</strong> تأكد من إرسال المبلغ للحساب الصحيح قبل رفع
          الإيصال
        </AlertDescription>
      </Alert>

      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
        <Camera className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <span>لا تنسَ التقاط صورة لإيصال التحويل قبل المتابعة</span>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-11 px-4 text-sm"
        >
          <ArrowRight className="w-4 h-4 ml-1" />
          رجوع
        </Button>
        <Button
          type="button"
          onClick={onNext}
          className="flex-1 h-11 text-sm sm:text-base font-semibold"
        >
          حوّلت المبلغ، التالي
          <ArrowLeft className="w-4 h-4 mr-1" />
        </Button>
      </div>
    </div>
  );
}
