// SectionalBuyDialog — single reusable checkout dialog for all three
// sectional CTAs (Phase 6b).
//
// Modes:
//   - 'single':     buy exactly one section (the target).
//   - 'cumulative': buy every section up to and including the target,
//                   minus the ones the buyer already owns
//                   (computeSmartSubtractPrice).
//   - 'bundle':     buy the full-course bundle. Price is
//                   max(0, fullCoursePrice - enrollment.totalSpent) —
//                   sectional users who already paid into the course only
//                   pay the delta (can be 0).
//
// Bundle break-even upsell: while in 'single' or 'cumulative' mode, if
// `computeBundleBreakEven` says the user's projected spend after this
// purchase would meet or exceed `fullCoursePrice`, an inline row offers
// the bundle for the delta. Clicking it switches the dialog to 'bundle'
// mode in place — no remount.
//
// Wallet-only. ZainCash for sectional is deferred (Phase 4). Insufficient
// balance replaces the confirm button with a top-up link rather than
// failing silently.

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { doc, onSnapshot } from "firebase/firestore";
import {
  Loader2,
  Lock,
  ShoppingCart,
  Wallet as WalletIcon,
  ArrowUpCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { useAuth } from "@/context/authContext";
import { db as clientDb } from "@/firebase/client";
import { generateProtectionKey } from "@/lib/purchaseProtection/protectionKey";
import {
  computeSmartSubtractPrice,
  computeBundleBreakEven,
} from "@/lib/sectional/pricing";
import {
  purchaseSectionsWithWallet,
  purchaseBundleWithWallet,
} from "@/app/actions/sectional_wallet_actions";
import { localizeSectionalError } from "@/lib/sectional/localizeError";
import type { Course, CourseSection, Enrollment } from "@/types/types";

export type SectionalBuyMode = "single" | "cumulative" | "bundle";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: SectionalBuyMode;
  course: Course;
  targetSectionId?: string;
  enrollment?: Enrollment | null;
  onPurchased?: () => void;
};

type Plan =
  | {
      kind: "ok";
      sectionIds: string[];
      titles: string[];
      totalPrice: number;
      isFreeBundleUpgrade: boolean;
    }
  | { kind: "error"; message: string };

function getEffectivePrice(s: CourseSection): number | undefined {
  return s.salePrice ?? s.price;
}

function computePlan(
  mode: SectionalBuyMode,
  course: Course,
  enrollment: Enrollment | null | undefined,
  targetSectionId: string | undefined
): Plan {
  const sections = Array.isArray(course.sections) ? course.sections : [];
  const ownedSet = new Set(enrollment?.ownedSectionIds ?? []);

  if (mode === "bundle") {
    const fullPrice = course.fullCoursePrice;
    if (typeof fullPrice !== "number" || fullPrice <= 0) {
      return { kind: "error", message: "سعر الحزمة غير محدد" };
    }
    const priorSpent = enrollment?.totalSpent ?? 0;
    const charge = Math.max(0, fullPrice - priorSpent);
    return {
      kind: "ok",
      sectionIds: sections.map((s) => s.sectionId),
      titles: sections.slice().sort((a, b) => a.order - b.order).map((s) => s.title),
      totalPrice: charge,
      isFreeBundleUpgrade: charge === 0,
    };
  }

  if (!targetSectionId) {
    return { kind: "error", message: "لم يُحدَّد القسم المطلوب" };
  }
  const target = sections.find((s) => s.sectionId === targetSectionId);
  if (!target) {
    return { kind: "error", message: "القسم غير موجود" };
  }

  if (mode === "single") {
    if (ownedSet.has(target.sectionId)) {
      return { kind: "error", message: "أنت تملك هذا القسم بالفعل" };
    }
    const price = getEffectivePrice(target);
    if (typeof price !== "number" || price <= 0) {
      return { kind: "error", message: "سعر هذا القسم غير محدد" };
    }
    return {
      kind: "ok",
      sectionIds: [target.sectionId],
      titles: [target.title],
      totalPrice: price,
      isFreeBundleUpgrade: false,
    };
  }

  // mode === "cumulative"
  const result = computeSmartSubtractPrice(
    course,
    targetSectionId,
    enrollment?.ownedSectionIds ?? []
  );
  if ("error" in result) {
    return { kind: "error", message: "أحد الأقسام لا يملك سعرًا صالحًا" };
  }
  if (result.sectionIdsToCharge.length === 0) {
    return { kind: "error", message: "أنت تملك كل الأقسام حتى هنا بالفعل" };
  }
  const titles = result.sectionIdsToCharge
    .map((id) => sections.find((s) => s.sectionId === id)?.title ?? id);
  return {
    kind: "ok",
    sectionIds: result.sectionIdsToCharge,
    titles,
    totalPrice: result.totalPrice,
    isFreeBundleUpgrade: false,
  };
}

function modeTitle(mode: SectionalBuyMode): string {
  switch (mode) {
    case "single":
      return "شراء قسم";
    case "cumulative":
      return "شراء حتى هذا القسم";
    case "bundle":
      return "شراء الحزمة الكاملة";
  }
}

export default function SectionalBuyDialog({
  open,
  onOpenChange,
  mode: initialMode,
  course,
  targetSectionId,
  enrollment,
  onPurchased,
}: Props) {
  const auth = useAuth();
  const router = useRouter();
  const userId = auth?.user?.uid;

  // Internal mode can swap from single/cumulative to bundle when the user
  // accepts the break-even upsell — without unmounting the dialog.
  const [mode, setMode] = useState<SectionalBuyMode>(initialMode);
  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open, initialMode]);

  // Live wallet balance via the same onSnapshot pattern used by
  // <WalletBalance>. Kept local because we need the numeric value (not
  // just display) to drive the insufficient-balance state.
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  useEffect(() => {
    if (!open || !userId) {
      setWalletBalance(null);
      setWalletLoading(false);
      return;
    }
    setWalletLoading(true);
    const unsub = onSnapshot(
      doc(clientDb, "wallets", userId),
      (snap) => {
        setWalletBalance(Number(snap.data()?.balance ?? 0));
        setWalletLoading(false);
      },
      () => {
        setWalletBalance(0);
        setWalletLoading(false);
      }
    );
    return () => unsub();
  }, [open, userId]);

  const plan = useMemo(
    () => computePlan(mode, course, enrollment ?? null, targetSectionId),
    [mode, course, enrollment, targetSectionId]
  );

  // Break-even upsell row, only relevant when the user is currently
  // buying section(s) (not the bundle).
  const bundleOffer = useMemo(() => {
    if (mode === "bundle") return null;
    if (plan.kind !== "ok") return null;
    return computeBundleBreakEven(
      course,
      enrollment?.totalSpent ?? 0,
      plan.totalPrice
    );
  }, [mode, plan, course, enrollment]);

  const insufficientBalance =
    plan.kind === "ok" &&
    !plan.isFreeBundleUpgrade &&
    walletBalance !== null &&
    walletBalance < plan.totalPrice;

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  useEffect(() => {
    if (open) setServerError(null);
  }, [open]);

  const handleConfirm = async () => {
    if (plan.kind !== "ok") return;
    // Matches EnrollButton's pattern: logged-out users get redirected to
    // login with a return-to URL, instead of the confirm silently no-op.
    if (!auth?.user) {
      router.push(`/login?redirect=/course/${course.id}`);
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    setServerError(null);
    try {
      const token = await auth.user.getIdToken();
      const protectionKey = generateProtectionKey(
        auth.user.uid,
        course.id,
        mode === "bundle" ? "bundle" : "sections"
      );

      const result =
        mode === "bundle"
          ? await purchaseBundleWithWallet(token, course.id, protectionKey)
          : await purchaseSectionsWithWallet(
              token,
              course.id,
              plan.sectionIds,
              protectionKey
            );

      if (result.success) {
        toast.success(
          mode === "bundle" && plan.isFreeBundleUpgrade
            ? "تمت ترقية الحزمة مجانًا"
            : "تم الشراء بنجاح"
        );
        onPurchased?.();
        onOpenChange(false);
        router.refresh();
        return;
      }

      // Failure cases.
      const arabicMessage = localizeSectionalError(result);
      if (result.error === "INSUFFICIENT_BALANCE") {
        // Surfaced inline (no toast — the insufficient-balance UI takes
        // over the confirm button).
        setServerError(arabicMessage);
        return;
      }
      if (
        result.error === "ALREADY_FULL_ACCESS" ||
        result.error === "ALL_SECTIONS_ALREADY_OWNED"
      ) {
        // The buttons should be hidden for these cases. Defensive: close
        // and refresh so the UI re-syncs.
        toast.info(arabicMessage);
        onOpenChange(false);
        router.refresh();
        return;
      }
      setServerError(arabicMessage);
      toast.error(arabicMessage);
    } catch (err) {
      console.error("sectional purchase error", err);
      const detail =
        process.env.NODE_ENV !== "production" && err instanceof Error
          ? ` — ${err.message}`
          : "";
      const msg = `حدث خطأ غير متوقع أثناء الشراء${detail}`;
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-right">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            {modeTitle(mode)}
          </DialogTitle>
          <DialogDescription className="text-right">
            {mode === "bundle"
              ? "اشترِ كامل الدورة دفعةً واحدة."
              : mode === "cumulative"
              ? "شراء جميع الأقسام حتى القسم المحدد (ما لم تملكه بالفعل)."
              : "شراء هذا القسم فقط."}
          </DialogDescription>
        </DialogHeader>

        {plan.kind === "error" ? (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 text-right">{plan.message}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2 text-right">
              <p className="text-sm font-medium text-gray-700">
                {mode === "bundle"
                  ? `${plan.titles.length} قسم في الحزمة`
                  : plan.titles.length === 1
                  ? "القسم"
                  : `${plan.titles.length} أقسام`}
              </p>
              <ul className="text-sm text-gray-900 space-y-1">
                {plan.titles.slice(0, 6).map((t, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    <span className="truncate">{t}</span>
                  </li>
                ))}
                {plan.titles.length > 6 && (
                  <li className="text-xs text-gray-500">
                    + {plan.titles.length - 6} قسم آخر
                  </li>
                )}
              </ul>
              <div className="flex items-baseline justify-between pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-600">المبلغ المستحق</span>
                <span className="text-lg font-bold text-gray-900">
                  {plan.isFreeBundleUpgrade
                    ? "ترقية مجانية"
                    : `${plan.totalPrice.toLocaleString()} د.ع`}
                </span>
              </div>
            </div>

            {/* Wallet row */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-gray-700">
                <WalletIcon className="w-4 h-4 text-green-600" />
                رصيد المحفظة
              </span>
              <span className="font-semibold text-gray-900">
                {walletLoading
                  ? "..."
                  : `${(walletBalance ?? 0).toLocaleString()} د.ع`}
              </span>
            </div>

            {/* Bundle break-even upsell (only when not already in bundle mode) */}
            {bundleOffer?.offerBundle && (
              <button
                type="button"
                onClick={() => setMode("bundle")}
                className="w-full text-right rounded-lg border-2 border-amber-300 bg-amber-50 p-4 hover:bg-amber-100 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <ArrowUpCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900">
                      اشترِ الحزمة الكاملة بـ{" "}
                      {bundleOffer.bundleDelta.toLocaleString()} د.ع
                    </p>
                    <p className="text-xs text-amber-800 mt-1">
                      توفّر {bundleOffer.savingsVsSectional.toLocaleString()}{" "}
                      د.ع وتفتح كل الأقسام
                    </p>
                  </div>
                </div>
              </button>
            )}

            {serverError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 text-right">{serverError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {insufficientBalance ? (
                <Button asChild className="flex-1 gap-2">
                  <Link href="/wallet/topup">
                    <WalletIcon className="w-4 h-4" />
                    اشحن المحفظة
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting || walletLoading}
                  className="flex-1 gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : plan.isFreeBundleUpgrade ? (
                    <ArrowUpCircle className="w-4 h-4" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {plan.isFreeBundleUpgrade ? "تأكيد الترقية" : "تأكيد الشراء"}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="flex-1"
              >
                إلغاء
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
