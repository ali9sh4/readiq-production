"use client";

import { Card } from "@/components/ui/card";
import { Smartphone, CreditCard, Clock } from "lucide-react";

type PaymentMethod = "zaincash" | "areeba";

interface PaymentSelectorProps {
  price: number;
  onSelect: (method: PaymentMethod) => void;
  loading?: boolean;
}

export default function PaymentSelector({
  price,
  onSelect,
  loading,
}: PaymentSelectorProps) {
  const methods = [
    {
      id: "zaincash" as PaymentMethod,
      name: "زين كاش",
      description: "المحفظة الإلكترونية",
      icon: <Smartphone className="w-8 h-8" />,
      color: "from-purple-600 to-purple-700",
      disabled: true, // ✅ Disabled
    },
    {
      id: "areeba" as PaymentMethod,
      name: "بطاقة الدفع",
      description: "فيزا • ماستركارد",
      icon: <CreditCard className="w-8 h-8" />,
      color: "from-blue-600 to-blue-700",
      disabled: true, // ✅ Disabled
    },
  ];

  return (
    <div className="space-y-4" dir="rtl">
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
            className={`p-4 transition-all ${
              method.disabled
                ? "opacity-50 cursor-not-allowed bg-gray-50"
                : "cursor-pointer hover:shadow-lg"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-lg bg-gradient-to-br ${
                  method.disabled ? "from-gray-300 to-gray-400" : method.color
                } flex items-center justify-center text-white flex-shrink-0 ${
                  method.disabled ? "grayscale" : ""
                }`}
              >
                {method.icon}
              </div>
              <div className="flex-1 text-right">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-lg text-gray-500">
                    {method.name}
                  </h4>
                  {method.disabled && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" /> قريباً
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">{method.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {/* ✅ Coming Soon Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
        <p className="text-sm text-yellow-800 font-medium">
          ⏳ بوابات الدفع قيد التفعيل - ستكون متاحة قريباً
        </p>
      </div>

      <p className="text-xs text-center text-gray-500">
        🔒 جميع المعاملات مشفرة وآمنة
      </p>
    </div>
  );
}
