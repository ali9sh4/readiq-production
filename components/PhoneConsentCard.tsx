"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, X } from "lucide-react";
import { useAuth } from "@/context/authContext";
import { Button } from "@/components/ui/button";
import { updateUserProfile } from "@/lib/services/userService";
import { normalizeIraqiPhone } from "@/lib/validation/phone";
import { serverTimestamp } from "firebase/firestore";

// Web-only, post-login capture card for an OPTIONAL student phone number plus a
// SEPARATE, affirmative WhatsApp marketing opt-in. Capture only — nothing is
// sent from here; the broadcast system is out of scope.
//
// Meta-2026 compliance (these are load-bearing — getting them wrong risks the
// WhatsApp number):
//   • the consent checkbox starts UNCHECKED (affirmative action, no pre-check,
//     never bundled with Terms acceptance);
//   • the copy names the business (Rubik / روبيك), the channel (WhatsApp), the
//     message type (new-course updates / marketing), and the right to opt out;
//   • an audit timestamp (marketingConsentAt) is stamped only on opt-in.
//
// Shown by the dashboard home when the user has no phone on file AND has not
// chosen "don't ask again" (server computes `initialShow`). "Not now" / the X
// hides it for this session only (no write) so it returns on the next login;
// "don't ask again" persists `phonePromptDismissed` so it never returns. Saving
// a phone removes the trigger for good (phone is no longer empty).
interface PhoneConsentCardProps {
  // True when the user has no phone and hasn't chosen "don't ask again".
  initialShow?: boolean;
}

export default function PhoneConsentCard({
  initialShow = false,
}: PhoneConsentCardProps) {
  const auth = useAuth();
  const [show, setShow] = useState(initialShow);
  const [phone, setPhone] = useState("");
  // Affirmative opt-in: this MUST start unchecked. Do not pre-check.
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!show) return null;

  const handleSave = async () => {
    const uid = auth.user?.uid;
    if (!uid) return;
    // Validate + canonicalize the optional phone. Empty is allowed.
    const phoneCheck = normalizeIraqiPhone(phone);
    if (!phoneCheck.ok) {
      alert(`⚠️ ${phoneCheck.error}`);
      return;
    }
    setSaving(true);
    try {
      // Stamp the consent time only on opt-in. This card appears only for users
      // with no phone and the checkbox starts unchecked, so a checked box here is
      // always a fresh false→true grant.
      await updateUserProfile(uid, {
        phone: phoneCheck.value,
        marketingConsent: consent,
        ...(consent ? { marketingConsentAt: serverTimestamp() } : {}),
      });
      setShow(false);
    } catch (e) {
      console.error("Failed to save phone/consent:", e);
      alert("تعذّر الحفظ. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  // Session-only dismiss: no write, so the card returns on the next login.
  const handleNotNow = () => setShow(false);

  // Permanent dismiss: persist the flag so the card never returns. Hide first so
  // the UI is responsive even if the write fails.
  const handleDontAskAgain = async () => {
    const uid = auth.user?.uid;
    setShow(false);
    if (!uid) return;
    try {
      await updateUserProfile(uid, { phonePromptDismissed: true });
    } catch (e) {
      console.error("Failed to persist phone-prompt dismissal:", e);
    }
  };

  return (
    <div className="relative rounded-3xl border-2 border-blue-100 bg-blue-50/60 p-5 sm:p-6 shadow-sm">
      <button
        type="button"
        onClick={handleNotNow}
        aria-label="ليس الآن"
        className="absolute top-4 left-4 rounded-lg p-1 text-gray-500 hover:bg-gray-200/70 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-green-100">
          <MessageCircle className="h-6 w-6 text-green-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-gray-900">
            ابقَ على اطلاع بالدورات الجديدة
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            أضِف رقم هاتفك (اختياري) لتسهيل التواصل معك. اختياري بالكامل ويمكنك
            تخطّيه الآن.
          </p>

          {/* Phone input (optional) */}
          <div className="mt-4">
            <label
              htmlFor="phone-consent-input"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              رقم الهاتف
            </label>
            <input
              id="phone-consent-input"
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-right disabled:opacity-60"
              placeholder="07XXXXXXXXX"
            />
          </div>

          {/* Affirmative, SEPARATE WhatsApp marketing opt-in. Unchecked by default. */}
          <label className="mt-4 flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={saving}
              className="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-xs sm:text-sm leading-relaxed text-gray-700">
              أوافق على أن تُرسل لي منصة <span className="font-semibold">روبيك (Rubik)</span>{" "}
              رسائل عبر <span className="font-semibold">واتساب (WhatsApp)</span> لإعلامي
              بالدورات الجديدة والعروض التسويقية. يمكنني إلغاء الاشتراك في أي وقت من
              صفحة الملف الشخصي أو بالتواصل معنا.
            </span>
          </label>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
            <Button
              variant="ghost"
              onClick={handleNotNow}
              disabled={saving}
              className="text-gray-600 hover:bg-gray-200/70"
            >
              ليس الآن
            </Button>
            <button
              type="button"
              onClick={handleDontAskAgain}
              disabled={saving}
              className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 disabled:opacity-60"
            >
              لا تسألني مرة أخرى
            </button>
          </div>

          <p className="mt-3 text-[11px] text-gray-400">
            لمعرفة كيفية استخدامنا لبياناتك راجِع{" "}
            <Link
              href="/privacy-policy"
              className="underline underline-offset-2 hover:text-gray-600"
            >
              سياسة الخصوصية
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
