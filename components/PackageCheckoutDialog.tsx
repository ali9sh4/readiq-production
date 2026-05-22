"use client";

// Package checkout dialog (Phase 4; redesigned in the UI polish pass).
//
// Opened from a package banner. Two modes:
//   - Signed-in: fetches the authoritative `getPackagePurchasePreview` and
//     renders package identity, savings math, the included-course list,
//     wallet / buy controls. Confirm calls `purchasePackageWithWallet`.
//   - Signed-out: there is no token to fetch a preview with, so it degrades
//     to a compact view built from the `summary` the banner already loaded
//     (title, thumbnails, count, price/savings) and prompts sign-in at the
//     buy step. Purchase is sign-in-gated downstream regardless.
//
// The partial-ownership disclosure and blocked-purchase messaging are
// unchanged in text and logic — only repositioned in the new layout.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/authContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import {
  getPackagePurchasePreview,
  purchasePackageWithWallet,
  type CoursePackageSummary,
  type PackagePreviewCourse,
  type PackagePreviewResult,
} from "@/app/actions/package_wallet_actions";
import { generateProtectionKey } from "@/lib/purchaseProtection/protectionKey";
import { PACKAGE_PURCHASE_ACTION } from "@/lib/packages/constants";
import { StackedThumbs, thumbSrc } from "@/components/PackageThumbs";

type Props = {
  packageId: string | null;
  // Loaded by the banner — used to render the signed-out degraded view
  // without a token, and ignored when a signed-in preview is available.
  summary: CoursePackageSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Blocked-package messaging — keyed off the preview's blockedReason.
function blockedMessage(
  reason: NonNullable<
    Extract<PackagePreviewResult, { success: true }>["blockedReason"]
  >,
  titles: string[]
): string {
  const list = titles.join("، ");
  switch (reason) {
    case "ALREADY_OWNS_COURSE":
      return `لا يمكنك شراء هذه الحزمة: أنت تملك بالفعل وصولاً كاملاً إلى ${list}. هذا يمنع الدفع مرتين عن نفس المحتوى.`;
    case "OWN_COURSE":
      return `لا يمكنك شراء هذه الحزمة لأنها تتضمّن دورة من إنشائك: ${list}.`;
    case "PACKAGE_UNAVAILABLE":
      return `هذه الحزمة غير متاحة حالياً — إحدى دوراتها لم تعد منشورة: ${list}.`;
    case "PACKAGE_NOT_ACTIVE":
      return "هذه الحزمة لم تعد متاحة للشراء.";
  }
}

// Purchase-action failure → Arabic. The preview gates most cases up front;
// these cover races between preview and confirm.
function purchaseErrorMessage(code: string): string {
  switch (code) {
    case "INSUFFICIENT_BALANCE":
      return "رصيد محفظتك غير كافٍ لإتمام الشراء.";
    case "ALREADY_OWNS_COURSE":
      return "أصبحت تملك وصولاً كاملاً إلى إحدى دورات الحزمة — لم يتم خصم أي مبلغ.";
    case "PACKAGE_UNAVAILABLE":
      return "إحدى دورات الحزمة لم تعد متاحة — لم يتم خصم أي مبلغ.";
    case "PACKAGE_NOT_ACTIVE":
      return "هذه الحزمة لم تعد متاحة للشراء.";
    default:
      return "تعذّر إتمام عملية الشراء. حاول مرة أخرى.";
  }
}

// Duration / lesson-count sub-label for a course row, when available.
function courseMeta(c: PackagePreviewCourse): string {
  const parts: string[] = [];
  if (c.durationHours != null && c.durationHours > 0) {
    parts.push(`${c.durationHours} ساعة`);
  }
  if (c.lessonCount != null && c.lessonCount > 0) {
    parts.push(`${c.lessonCount} درس`);
  }
  return parts.join(" · ");
}

export default function PackageCheckoutDialog({
  packageId,
  summary,
  open,
  onOpenChange,
}: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PackagePreviewResult | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const loadPreview = useCallback(async () => {
    if (!user || !packageId) return;
    setLoading(true);
    setPreview(null);
    try {
      const token = await user.getIdToken();
      setPreview(await getPackagePurchasePreview(token, packageId));
    } catch (e) {
      console.error("package preview error", e);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [user, packageId]);

  useEffect(() => {
    if (open && packageId) loadPreview();
  }, [open, packageId, loadPreview]);

  const handlePurchase = async () => {
    if (!user || !packageId || !preview || !preview.success) return;
    setPurchasing(true);
    try {
      const token = await user.getIdToken();
      const protectionKey = generateProtectionKey(
        user.uid,
        packageId,
        PACKAGE_PURCHASE_ACTION
      );
      const res = await purchasePackageWithWallet(token, packageId, protectionKey);
      if (!res.success) {
        alert(purchaseErrorMessage(res.error));
        await loadPreview();
        return;
      }
      alert("تم شراء الحزمة بنجاح! أصبح لديك وصول كامل لجميع دوراتها.");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      console.error("package purchase error", e);
      alert("تعذّر إتمام عملية الشراء. حاول مرة أخرى.");
    } finally {
      setPurchasing(false);
    }
  };

  const ok = preview?.success ? preview : null;
  const insufficient =
    !!ok && ok.purchasable && ok.walletBalance < ok.package.price;
  const canBuy = !!ok && ok.purchasable && !insufficient && !purchasing;

  // Signed-in savings come from the preview; signed-out, from the summary.
  const signedOut = !user;
  const priceShown = ok ? ok.package.price : summary?.price ?? 0;
  const totalShown = ok ? ok.package.total : summary?.total ?? 0;
  const saving = totalShown - priceShown;
  const hasSaving = saving > 0;

  const title = ok
    ? ok.package.title
    : summary
      ? summary.title
      : "تفاصيل الحزمة";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* ===== Signed-out: degraded view from the banner's summary ===== */}
        {signedOut && summary && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <StackedThumbs thumbnails={summary.thumbnails} />
              <div>
                <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  حزمة
                </span>
                <p className="mt-1 text-sm text-gray-500">
                  {summary.courseCount} دورات
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              {hasSaving && (
                <p className="text-sm text-gray-400 line-through">
                  {totalShown.toLocaleString()} د.ع
                </p>
              )}
              <p className="text-3xl font-extrabold text-gray-900">
                {priceShown.toLocaleString()} د.ع
              </p>
              {hasSaving && (
                <p className="mt-0.5 text-sm font-semibold text-green-600">
                  توفّر {saving.toLocaleString()} د.ع
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              <span>
                بشراء واحد تحصل على وصول كامل ودائم لكل دورات الحزمة.
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <Info className="h-4 w-4 shrink-0" />
              <span>سجّل الدخول لعرض دورات الحزمة وإتمام الشراء.</span>
            </div>
          </div>
        )}

        {/* ===== Signed-in: full preview ===== */}
        {!signedOut && loading && (
          <p className="py-8 text-center text-gray-500">جاري التحميل...</p>
        )}

        {!signedOut && !loading && preview && !preview.success && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              تعذّر تحميل تفاصيل الحزمة. حاول مرة أخرى.
            </AlertDescription>
          </Alert>
        )}

        {!signedOut && !loading && ok && (
          <div className="space-y-5">
            {/* Identity: badge + stacked thumbnails + course count */}
            <div className="flex items-center gap-3">
              <StackedThumbs thumbnails={ok.courses.map((c) => c.thumbnailUrl ?? "")} />
              <div>
                <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  حزمة
                </span>
                <p className="mt-1 text-sm text-gray-500">
                  {ok.courses.length} دورات
                </p>
              </div>
            </div>

            {ok.package.description && (
              <p className="text-sm leading-relaxed text-gray-600">
                {ok.package.description}
              </p>
            )}

            {/* Price block: strikethrough total, package price, savings */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              {hasSaving && (
                <p className="text-sm text-gray-400 line-through">
                  {ok.package.total.toLocaleString()} د.ع
                </p>
              )}
              <p className="text-3xl font-extrabold text-gray-900">
                {ok.package.price.toLocaleString()} د.ع
              </p>
              {hasSaving && (
                <p className="mt-0.5 text-sm font-semibold text-green-600">
                  توفّر {saving.toLocaleString()} د.ع
                </p>
              )}
            </div>

            {/* Reassurance */}
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              <span>
                بشراء واحد تحصل على وصول كامل ودائم لكل دورات الحزمة.
              </span>
            </div>

            {/* Included courses — calm vertical list */}
            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700">
                دورات الحزمة
              </p>
              <ul className="divide-y rounded-lg border">
                {ok.courses.map((c) => {
                  const meta = courseMeta(c);
                  return (
                    <li
                      key={c.courseId}
                      className="flex items-center gap-3 p-2.5"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbSrc(c.thumbnailUrl)}
                        alt=""
                        className="h-12 w-16 shrink-0 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {c.title}
                        </p>
                        {c.instructorName && (
                          <p className="truncate text-xs text-gray-500">
                            {c.instructorName}
                          </p>
                        )}
                      </div>
                      {meta && (
                        <span className="shrink-0 text-xs text-gray-400">
                          {meta}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Partial-ownership disclosure — concrete, per course */}
            {ok.partialOwnershipCourses.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>ملاحظة قبل الشراء</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pr-4 space-y-1">
                    {ok.partialOwnershipCourses.map((c) => (
                      <li key={c.courseId}>
                        أنت تملك أقساماً من دورة «{c.title}». ستحصل على وصول
                        كامل لها ضمن الحزمة. الأقسام التي اشتريتها مسبقاً لا
                        تُحتسب من سعر الحزمة ولا تُسترد.
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Blocked-package message */}
            {!ok.purchasable && ok.blockedReason && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {blockedMessage(ok.blockedReason, ok.blockedCourseTitles)}
                </AlertDescription>
              </Alert>
            )}

            {/* Wallet */}
            <div className="space-y-1.5 rounded-lg bg-gray-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">رصيد محفظتك</span>
                <span className="text-gray-900">
                  {ok.walletBalance.toLocaleString()} د.ع
                </span>
              </div>
              {canBuy && (
                <div className="flex justify-between border-t pt-1.5">
                  <span className="text-gray-600">الرصيد بعد الشراء</span>
                  <span className="text-gray-900">
                    {(ok.walletBalance - ok.package.price).toLocaleString()} د.ع
                  </span>
                </div>
              )}
            </div>

            {/* Insufficient balance */}
            {insufficient && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  رصيد محفظتك لا يغطي سعر الحزمة — تحتاج إلى شحن{" "}
                  {(ok.package.price - ok.walletBalance).toLocaleString()} د.ع.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={purchasing}
          >
            إغلاق
          </Button>
          {signedOut ? (
            <Button asChild className="bg-amber-600 hover:bg-amber-700">
              <Link href="/login">سجّل الدخول للشراء</Link>
            </Button>
          ) : (
            <Button
              onClick={handlePurchase}
              disabled={!canBuy}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {purchasing
                ? "جارٍ الشراء..."
                : ok
                  ? `شراء بـ ${ok.package.price.toLocaleString()} د.ع`
                  : "شراء"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
