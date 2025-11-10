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
      id: "wallet" as PaymentMethod, // ✅ NEW
      name: "المحفظة",
      description: "ادفع من رصيد محفظتك",
      icon: <Wallet className="w-8 h-8 text-white" />,
      color: "from-green-600 to-green-700",
      disabled: false,
      badge: "فوري",
      badgeColor: "bg-green-100 text-green-700",
      component: <WalletBalance />,
    },
    {
      id: "zaincash" as PaymentMethod,
      name: "ZainCash",
      description: "الدفع عبر المحفظة الإلكترونية",
      icon: (
        <Image
          src="/ZainCashLogo.png"
          alt="ZainCash"
          width={120}
          height={40}
          className="object-contain"
        />
      ),
      color: "from-purple-600 to-purple-700",
      disabled: false, // ✅ ENABLED
      badge: "متاح الآن",
      badgeColor: "bg-green-100 text-green-700",
    },
    {
      id: "areeba" as PaymentMethod,
      name: "بطاقة الدفع",
      description: "فيزا • ماستركارد",
      icon: <CreditCard className="w-8 h-8" />,
      color: "from-blue-600 to-blue-700",
      disabled: true, // ❌ Still disabled
      badge: "قريباً",
      badgeColor: "bg-yellow-100 text-yellow-700",
    },
  ];

  return (
    <div className="font-zain space-y-4" dir="rtl">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold">اختر طريقة الدفع</h3>
        <p className="text-2xl font-bold text-blue-600">
          {price.toLocaleString()} IQD
        </p>
      </div>

      <div className="grid gap-3">
        {methods.map((method) => (
          <Card
            key={method.id}
            onClick={() => !method.disabled && !loading && onSelect(method.id)}
            className={`p-4 transition-all ${
              method.disabled
                ? "opacity-50 cursor-not-allowed bg-gray-50"
                : selectedMethod === method.id
                ? "ring-2 ring-purple-500 shadow-lg cursor-pointer"
                : "cursor-pointer hover:shadow-lg hover:ring-2 hover:ring-purple-200"
            } ${loading ? "pointer-events-none opacity-70" : ""}`}
          >
            <div className="flex items-center gap-4">
              {/* Icon */}

              <div
                className={`${
                  method.id === "zaincash"
                    ? "w-32 h-12" // ✅ Wider for logo
                    : method.id === "wallet"
                    ? "w-12 h-12 rounded-lg bg-gradient-to-br from-green-600 to-green-700" // Wallet gets green gradient
                    : "w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700"
                } flex items-center justify-center flex-shrink-0 ${
                  method.disabled ? "grayscale" : ""
                }`}
              >
                {method.icon}
              </div>

              {/* Content */}
              <div className="flex-1 text-right">
                <div className="flex items-center gap-2 justify-end">
                  <span
                    className={`text-xs ${method.badgeColor} px-2 py-0.5 rounded-full flex items-center gap-1`}
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
                  className={`text-sm ${
                    method.disabled ? "text-gray-400" : "text-gray-600"
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
                  <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}

              {/* Loading spinner */}
              {loading && selectedMethod === method.id && (
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Info notices */}
      <div className="space-y-2">
        {/* ZainCash info */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-sm text-purple-800 font-medium text-center">
            ✅ زين كاش متاح الآن - ادفع بأمان عبر محفظتك الإلكترونية
          </p>
        </div>

        {/* Coming soon for cards */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800 text-center">
            ⏳ الدفع بالبطاقات البنكية قيد التفعيل
          </p>
        </div>
      </div>

      <p className="text-xs text-center text-gray-500">
        🔒 جميع المعاملات مشفرة ومحمية
      </p>
    </div>
  );
}
