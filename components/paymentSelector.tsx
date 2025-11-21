"use client";

import { Card } from "@/components/ui/card";
import { CreditCard, Clock, CheckCircle2, Wallet } from "lucide-react";
import Image from "next/image";
import WalletBalance from "./WalletBalance";

type PaymentMethod = "zaincash" | "areeba" | "wallet";

interface PaymentSelectorProps {
  price: number;
  onSelect: (method: PaymentMethod) => void;
  loading?: boolean;
  selectedMethod?: PaymentMethod;
}

export default function PaymentSelector({
  price,
  onSelect,
  loading,
  selectedMethod,
}: PaymentSelectorProps) {
  const methods = [
    {
      id: "wallet" as PaymentMethod,
      name: "المحفظة",
      description: "ادفع من رصيد محفظتك",
      icon: <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-white" />,
      color: "bg-green-700",
      disabled: false,
      badge: "متاح الآن",
      badgeColor: "bg-green-600 text-white",
    },
    {
      id: "zaincash" as PaymentMethod,
      name: "ZainCash",
      description: "الدفع عبر المحفظة الإلكترونية",
      icon: (
        <Image
          src="/ZainCashLogo.png"
          alt="ZainCash"
          width={100}
          height={32}
          className="object-contain w-20 h-8 sm:w-28 sm:h-10"
        />
      ),
      color: "bg-purple-700",
      disabled: true,
      badge: "قريباً",
      badgeColor: "bg-yellow-500 text-gray-900",
    },
    {
      id: "areeba" as PaymentMethod,
      name: "بطاقة الدفع",
      description: "فيزا • ماستركارد",
      icon: <CreditCard className="w-6 h-6 sm:w-8 sm:h-8" />,
      color: "bg-blue-700",
      disabled: true,
      badge: "قريباً",
      badgeColor: "bg-yellow-500 text-gray-900",
    },
  ];

  return (
    <div
      className="font-zain space-y-3 sm:space-y-4 p-2 sm:p-0 rounded-lg"
      dir="rtl"
    >
      {" "}
      {/* Header */}
      <div className="text-center space-y-1 sm:space-y-2">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900">
          اختر طريقة الدفع
        </h3>
        <p className="text-xl sm:text-2xl font-bold text-blue-700">
          {price.toLocaleString()} IQD
        </p>
      </div>
      {/* Payment Methods */}
      <div className="grid gap-2 sm:gap-3">
        {methods.map((method) => (
          <Card
            key={method.id}
            onClick={() => !method.disabled && !loading && onSelect(method.id)}
            className={`p-3 sm:p-4 transition-all border-2 ${
              method.disabled
                ? "opacity-60 cursor-not-allowed bg-gray-100 border-gray-300"
                : selectedMethod === method.id
                ? "ring-2 ring-green-600 border-green-600 shadow-xl cursor-pointer bg-green-50"
                : "cursor-pointer hover:shadow-xl hover:border-green-500 border-gray-300 bg-white"
            } ${loading ? "pointer-events-none opacity-70" : ""}`}
          >
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              {/* Icon */}
              <div
                className={`${
                  method.id === "zaincash"
                    ? "w-20 h-10 sm:w-28 sm:h-12"
                    : "w-10 h-10 sm:w-12 sm:h-12"
                } flex items-center justify-center flex-shrink-0 rounded-lg ${
                  method.id === "wallet"
                    ? "bg-green-700"
                    : method.id === "areeba"
                    ? "bg-blue-700"
                    : ""
                } ${method.disabled ? "grayscale" : ""}`}
              >
                {method.icon}
              </div>

              {/* Content */}
              <div className="flex-1 text-right min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 justify-end mb-0.5 sm:mb-1">
                  <span
                    className={`text-xs font-semibold ${method.badgeColor} px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-1`}
                  >
                    {method.disabled ? (
                      <Clock className="w-3 h-3" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    {method.badge}
                  </span>
                </div>

                <p
                  className={`text-xs sm:text-sm font-medium ${
                    method.disabled ? "text-gray-500" : "text-gray-800"
                  }`}
                >
                  {method.description}
                  {method.id === "wallet" && (
                    <span className="block mt-1">
                      <WalletBalance />
                    </span>
                  )}
                </p>
              </div>

              {/* Selected indicator */}
              {selectedMethod === method.id && !loading && (
                <div className="flex-shrink-0">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-700 flex items-center justify-center shadow-md">
                    <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
              )}

              {/* Loading spinner */}
              {loading && selectedMethod === method.id && (
                <div className="flex-shrink-0">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
      {/* Info notices */}
      <div className="space-y-2">
        {/* Wallet info */}
        <div className="bg-green-100 border-2 border-green-500 rounded-lg p-2 sm:p-3">
          <p className="text-xs sm:text-sm text-green-900 font-bold text-center">
            ✅ الدفع عبر المحفظة متاح الآن - رصيد آمن وسريع
          </p>
        </div>

        {/* Coming soon for other methods */}
        <div className="bg-yellow-100 border-2 border-yellow-500 rounded-lg p-2 sm:p-3">
          <p className="text-xs sm:text-sm text-yellow-900 font-semibold text-center">
            ⏳ طرق الدفع الأخرى (زين كاش والبطاقات البنكية) قيد التفعيل
          </p>
        </div>
      </div>
      {/* Security notice */}
      <p className="text-xs text-center text-gray-600 font-medium pt-1">
        🔒 جميع المعاملات مشفرة ومحمية
      </p>
    </div>
  );
}
