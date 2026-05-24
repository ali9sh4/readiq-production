"use client";

import { toast } from "sonner";
import { Copy, MessageCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TOPUP_PAYMENT_METHODS,
  TOPUP_WHATSAPP_NUMBER,
  topupWhatsappIntl,
  type TopupPaymentMethodId,
} from "../constants";

interface Step3Props {
  methodId: TopupPaymentMethodId;
  onBack: () => void;
  onNext: () => void;
}

export function Step3WhatsApp({ methodId, onBack, onNext }: Step3Props) {
  const method = TOPUP_PAYMENT_METHODS[methodId];

  const prefilledMessage =
    `السلام عليكم، أرسلت إيصال تحويل لشحن محفظتي في تطبيق Rubik عبر ${method.label}.\n` +
    `Hello, I sent a transfer receipt to top up my Rubik wallet via ${method.label}.`;

  const waLink = `https://wa.me/${topupWhatsappIntl()}?text=${encodeURIComponent(prefilledMessage)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(TOPUP_WHATSAPP_NUMBER);
      toast.success("تم نسخ الرقم!");
    } catch {
      toast.error("تعذّر النسخ، انسخ الرقم يدوياً");
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base sm:text-lg font-bold text-gray-900">
        أرسل صورة الإيصال إلى هذا الرقم
      </h2>

      <div className="bg-green-50 border-2 border-green-300 rounded-xl p-3 sm:p-4 space-y-3">
        <div className="bg-white rounded-lg p-3 sm:p-4 border-2 border-green-400">
          <p
            className="text-2xl sm:text-3xl font-bold text-center text-green-700 tracking-wider font-mono"
            dir="ltr"
          >
            {TOPUP_WHATSAPP_NUMBER}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleCopy}
            variant="outline"
            className="flex-1 h-11 text-sm"
          >
            <Copy className="w-4 h-4 ml-2" />
            نسخ الرقم
          </Button>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            فتح واتساب
          </a>
        </div>
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
          أرسلت الإيصال، التالي
          <ArrowLeft className="w-4 h-4 mr-1" />
        </Button>
      </div>
    </div>
  );
}
