"use client";

import { MessageCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/authContext";
import {
  TOPUP_PAYMENT_METHODS,
  TOPUP_WHATSAPP_NUMBER,
  topupWhatsappIntl,
  type TopupPaymentMethodId,
} from "../constants";

interface Step3Props {
  methodId: TopupPaymentMethodId;
  onBack: () => void;
  // الإيصال is now the final step — opening WhatsApp + the instruction line is
  // the finish. `onNext` (which fired the done screen) is intentionally left in
  // the contract but unused, so re-adding a terminal button is a one-line revert.
  onNext: () => void;
}

export function Step3WhatsApp({ methodId, onBack }: Step3Props) {
  const method = TOPUP_PAYMENT_METHODS[methodId];
  const { user } = useAuth();
  const userEmail = user?.email ?? "";

  const prefilledMessage =
    `السلام عليكم، أرسلت إيصال تحويل لشحن محفظتي في تطبيق روبيك عبر ${method.label}. ` +
    `البريد الإلكتروني: ${userEmail}`;

  const waLink = `https://wa.me/${topupWhatsappIntl()}?text=${encodeURIComponent(prefilledMessage)}`;

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

        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          فتح واتساب
        </a>

        <p className="text-xs sm:text-sm text-green-800 text-center leading-relaxed">
          افتح واتساب وأرسل صورة الإيصال. سيتم إضافة الرصيد إلى محفظتك بعد
          المراجعة خلال ١٥–٦٠ دقيقة.
        </p>
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
      </div>
    </div>
  );
}
