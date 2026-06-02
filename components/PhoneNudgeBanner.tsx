"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shared, dismissible "add your phone" nudge for course creators with no phone
// on file. Rendered on the user dashboard home and the course edit page. The
// dismiss state is persisted under ONE localStorage key, so dismissing it in
// either place hides it everywhere; it also disappears for good once a phone is
// saved (the caller stops passing needsPhone). A nudge, never a gate.
const PHONE_NUDGE_DISMISS_KEY = "instructorPhoneNudgeDismissed";

interface PhoneNudgeBannerProps {
  // True when the current user is a course creator with no phone on file.
  needsPhone?: boolean;
  // Optional extra classes on the root (e.g. spacing on pages without a
  // space-y parent). Nothing renders when the nudge is hidden, so this never
  // leaves an empty gap.
  className?: string;
}

export default function PhoneNudgeBanner({
  needsPhone = false,
  className = "",
}: PhoneNudgeBannerProps) {
  // Start hidden to avoid an SSR flash, then reveal only if the user hasn't
  // dismissed it before.
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!needsPhone) return;
    let dismissed = false;
    try {
      dismissed =
        window.localStorage.getItem(PHONE_NUDGE_DISMISS_KEY) === "1";
    } catch {
      // localStorage unavailable (private mode etc.) — just show the nudge.
    }
    setShow(!dismissed);
  }, [needsPhone]);

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(PHONE_NUDGE_DISMISS_KEY, "1");
    } catch {
      // Best-effort; dismissal still holds for this session via state.
    }
  };

  if (!show) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 ${className}`}
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100">
        <Phone className="h-5 w-5 text-amber-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-900 text-sm sm:text-base">
          أضِف رقم هاتفك للتواصل
        </p>
        <p className="text-amber-800 text-xs sm:text-sm mt-0.5">
          بصفتك مدرّباً، يساعدنا رقم هاتفك على التواصل معك بشأن دوراتك
          ومستحقاتك. تُضاف مرة واحدة فقط.
        </p>
        <Button
          asChild
          size="sm"
          className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Link href="/user_dashboard/profile">إضافة رقم الهاتف</Link>
        </Button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="إغلاق"
        className="flex-shrink-0 rounded-lg p-1 text-amber-700 hover:bg-amber-100 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
