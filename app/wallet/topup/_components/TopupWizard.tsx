"use client";

import { useReducer } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { History, Wallet } from "lucide-react";
import NavigationButton from "@/components/NavigationButton";

import { WalletTopupStepper } from "./WalletTopupStepper";
import { Step1PaymentMethod } from "./Step1PaymentMethod";
import { Step2Transfer } from "./Step2Transfer";
import { Step3WhatsApp } from "./Step3WhatsApp";
import type { TopupPaymentMethodId } from "../constants";

type StepNum = 1 | 2 | 3;

interface WizardState {
  selectedMethod: TopupPaymentMethodId | null;
  currentStep: StepNum;
}

type WizardAction =
  | { type: "selectMethod"; method: TopupPaymentMethodId }
  | { type: "goToStep"; step: StepNum };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "selectMethod":
      return { ...state, selectedMethod: action.method, currentStep: 2 };
    case "goToStep":
      return { ...state, currentStep: action.step };
    default:
      return state;
  }
}

interface TopupWizardProps {
  onSuccess: () => void;
}

export function TopupWizard({ onSuccess }: TopupWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, {
    selectedMethod: null,
    currentStep: 1,
  });

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
                onNext={onSuccess}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
