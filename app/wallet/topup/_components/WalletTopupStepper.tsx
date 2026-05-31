"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { num: 1, label: "طريقة الدفع" },
  { num: 2, label: "التحويل" },
  { num: 3, label: "الإيصال" },
] as const;

export function WalletTopupStepper({ currentStep }: { currentStep: number }) {
  return (
    <ol
      className="flex items-start justify-between w-full px-1 sm:px-2"
      aria-label="مراحل شحن المحفظة"
    >
      {STEPS.map((step, idx) => {
        const isActive = step.num === currentStep;
        const isCompleted = step.num < currentStep;
        const isLast = idx === STEPS.length - 1;
        return (
          <li
            key={step.num}
            className="flex items-start flex-1 min-w-0"
            aria-current={isActive ? "step" : undefined}
          >
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 text-xs sm:text-sm font-bold transition-colors",
                  isCompleted && "bg-blue-600 border-blue-600 text-white",
                  isActive && "bg-white border-blue-600 text-blue-600",
                  !isActive &&
                    !isCompleted &&
                    "bg-gray-100 border-gray-300 text-gray-400",
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : isActive ? (
                  <span
                    className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-600"
                    aria-hidden="true"
                  />
                ) : (
                  step.num
                )}
              </div>
              <span
                className={cn(
                  "mt-1 text-[10px] sm:text-xs text-center whitespace-nowrap",
                  isActive
                    ? "text-blue-700 font-semibold"
                    : isCompleted
                      ? "text-blue-600"
                      : "text-gray-500",
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  "flex-1 h-0.5 mt-4 sm:mt-[18px] mx-1 sm:mx-2",
                  isCompleted ? "bg-blue-600" : "bg-gray-300",
                )}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
