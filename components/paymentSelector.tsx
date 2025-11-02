"use client";

import { Card } from "@/components/ui/card";
import { Smartphone, CreditCard, CheckCircle, Loader2, X } from "lucide-react";

type PaymentMethod = "zaincash" | "areeba";

interface PaymentSelectorProps {
  priceIQD: number;
  onSelect: (method: PaymentMethod) => void;
  loading?: boolean;
}

export default function PaymentSelector({
  priceIQD,
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
      popular: true,
    },
    {
      id: "areeba" as PaymentMethod,
      name: "بطاقة الدفع",
      description: "فيزا • ماستركارد",
      icon: <CreditCard className="w-8 h-8" />,
      color: "from-blue-600 to-blue-700",
    },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold">اختر طريقة الدفع</h3>
        <p className="text-2xl font-bold text-blue-600">
          {priceIQD.toLocaleString()} IQD
        </p>
      </div>

      <div className="grid gap-3">
        {methods.map((method) => (
          <Card
            key={method.id}
            className={`p-4 cursor-pointer hover:shadow-lg transition-all ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
            onClick={() => !loading && onSelect(method.id)}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-lg bg-gradient-to-br ${method.color} flex items-center justify-center text-white flex-shrink-0`}
              >
                {method.icon}
              </div>
              <div className="flex-1 text-right">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-lg">{method.name}</h4>
                  {method.popular && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> الأكثر استخداماً
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{method.description}</p>
              </div>
              {loading && (
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              )}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-center text-gray-500">
        🔒 جميع المعاملات مشفرة وآمنة
      </p>
    </div>
  );
}
