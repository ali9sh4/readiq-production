"use client";

import { CreditCard, Smartphone, ChevronLeft } from "lucide-react";
import {
  TOPUP_PAYMENT_METHODS,
  type TopupPaymentMethodId,
} from "../constants";

interface Step1Props {
  selectedMethod: TopupPaymentMethodId | null;
  onSelect: (method: TopupPaymentMethodId) => void;
}

export function Step1PaymentMethod({ selectedMethod, onSelect }: Step1Props) {
  const methods = [
    {
      ...TOPUP_PAYMENT_METHODS.zaincash,
      icon: Smartphone,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      accent: "border-purple-300 hover:border-purple-500",
      numberColor: "text-purple-700",
    },
    {
      ...TOPUP_PAYMENT_METHODS.rafidain,
      icon: CreditCard,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      accent: "border-blue-300 hover:border-blue-500",
      numberColor: "text-blue-700",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-gray-900">
          اختر طريقة الدفع
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          سنعرض لك تفاصيل الحساب في الخطوة التالية
        </p>
      </div>

      <div className="grid gap-3">
        {methods.map((m) => {
          const Icon = m.icon;
          const isSelected = selectedMethod === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id as TopupPaymentMethodId)}
              className={`w-full min-h-[88px] bg-white rounded-xl border-2 ${m.accent} ${
                isSelected ? "ring-2 ring-blue-500" : ""
              } p-3 sm:p-4 text-right transition-all hover:shadow-md active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-500`}
              aria-pressed={isSelected}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-lg ${m.iconBg} flex-shrink-0`}
                >
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${m.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-bold text-gray-900">
                    {m.label}
                  </p>
                  <p
                    className={`text-xs sm:text-sm font-mono ${m.numberColor} mt-0.5`}
                    dir="ltr"
                  >
                    {m.number}
                  </p>
                  {m.holder && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {m.holder}
                    </p>
                  )}
                </div>
                <ChevronLeft className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
