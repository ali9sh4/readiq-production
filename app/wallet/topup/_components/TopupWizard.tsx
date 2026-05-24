"use client";

import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { History, Wallet } from "lucide-react";
import NavigationButton from "@/components/NavigationButton";
import { useAuth } from "@/context/authContext";
import { createTopupRequest } from "@/app/actions/wallet_actions";

import { WalletTopupStepper } from "./WalletTopupStepper";
import { Step1PaymentMethod } from "./Step1PaymentMethod";
import { Step2Transfer } from "./Step2Transfer";
import { Step3WhatsApp } from "./Step3WhatsApp";
import { Step4Details } from "./Step4Details";
import type { TopupPaymentMethodId } from "../constants";

type StepNum = 1 | 2 | 3 | 4;

interface WizardState {
  selectedMethod: TopupPaymentMethodId | null;
  currentStep: StepNum;
  amount: string;
  senderName: string;
}

type WizardAction =
  | { type: "selectMethod"; method: TopupPaymentMethodId }
  | { type: "goToStep"; step: StepNum }
  | { type: "setAmount"; value: string }
  | { type: "setSenderName"; value: string };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "selectMethod":
      return { ...state, selectedMethod: action.method, currentStep: 2 };
    case "goToStep":
      return { ...state, currentStep: action.step };
    case "setAmount":
      return { ...state, amount: action.value };
    case "setSenderName":
      return { ...state, senderName: action.value };
    default:
      return state;
  }
}

interface TopupWizardProps {
  onSuccess: () => void;
}

export function TopupWizard({ onSuccess }: TopupWizardProps) {
  const auth = useAuth();
  const router = useRouter();

  const [state, dispatch] = useReducer(wizardReducer, {
    selectedMethod: null,
    currentStep: 1,
    amount: "",
    senderName: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    const numAmount = Number(state.amount.replace(/,/g, ""));

    if (!state.amount || numAmount < 1000) {
      setError("الحد الأدنى للإيداع 1,000 دينار عراقي");
      return;
    }
    if (numAmount > 5000000) {
      setError("الحد الأقصى للإيداع 5,000,000 دينار عراقي");
      return;
    }
    if (!state.senderName.trim()) {
      setError("يرجى إدخال اسم المرسل");
      return;
    }

    setLoading(true);
    try {
      const token = await auth.user?.getIdToken();
      if (!token) {
        throw new Error("يرجى تسجيل الدخول أولاً");
      }

      const result = await createTopupRequest(token, {
        amount: numAmount,
        senderName: state.senderName.trim(),
      });

      if (!result.success) {
        throw new Error(result.error || "فشل في إرسال الطلب");
      }

      onSuccess();
      setTimeout(() => {
        router.push("/wallet/transactions");
      }, 2000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "حدث خطأ أثناء معالجة الطلب";
      console.error("Topup error:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-4 sm:py-6 md:py-8 px-3 sm:px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg border-gray-200">
          <CardHeader className="border-b bg-white p-4 sm:p-6">
            <div className="flex justify-between items-start flex-wrap gap-2 sm:gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  شحن المحفظة
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-1.5">
                  اتبع الخطوات لإتمام عملية الشحن
                </CardDescription>
              </div>
              {state.currentStep === 1 && (
                <NavigationButton
                  href="/wallet/transactions"
                  variant="outline"
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium transition-colors hover:underline"
                >
                  <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  الدفعات السابقة
                </NavigationButton>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 px-3 sm:px-6 pb-4 sm:pb-6">
            <WalletTopupStepper currentStep={state.currentStep} />

            {state.currentStep === 1 && (
              <Step1PaymentMethod
                selectedMethod={state.selectedMethod}
                onSelect={(method) => dispatch({ type: "selectMethod", method })}
              />
            )}

            {state.currentStep === 2 && state.selectedMethod && (
              <Step2Transfer
                methodId={state.selectedMethod}
                onBack={() => dispatch({ type: "goToStep", step: 1 })}
                onNext={() => dispatch({ type: "goToStep", step: 3 })}
              />
            )}

            {state.currentStep === 3 && state.selectedMethod && (
              <Step3WhatsApp
                methodId={state.selectedMethod}
                onBack={() => dispatch({ type: "goToStep", step: 2 })}
                onNext={() => dispatch({ type: "goToStep", step: 4 })}
              />
            )}

            {state.currentStep === 4 && state.selectedMethod && (
              <Step4Details
                amount={state.amount}
                senderName={state.senderName}
                loading={loading}
                error={error}
                onAmountChange={(value) =>
                  dispatch({ type: "setAmount", value })
                }
                onSenderNameChange={(value) =>
                  dispatch({ type: "setSenderName", value })
                }
                onBack={() => dispatch({ type: "goToStep", step: 3 })}
                onSubmit={handleSubmit}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
