"use client";

// Package checkout dialog (Phase 4).
//
// Opened from the course-page upsell banner. On open it fetches the
// authoritative `getPackagePurchasePreview` and renders:
//   - the full course list,
//   - price / wallet balance / balance-after,
//   - a CONCRETE partial-ownership disclosure naming each sectional course
//     the buyer partly owns (no refund, sections not credited to price),
//   - a blocked-package message when the buyer is ineligible.
// Confirm calls the atomic `purchasePackageWithWallet`.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { AlertTriangle, Info, BookOpen } from "lucide-react";
import {
  getPackagePurchasePreview,
  purchasePackageWithWallet,
  type PackagePreviewResult,
} from "@/app/actions/package_wallet_actions";
import { generateProtectionKey } from "@/lib/purchaseProtection/protectionKey";
import { PACKAGE_PURCHASE_ACTION } from "@/lib/packages/constants";

type Props = {
  packageId: string | null;
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

export default function PackageCheckoutDialog({
  packageId,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {ok ? ok.package.title : "تفاصيل الحزمة"}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <p className="py-8 text-center text-gray-500">جاري التحميل...</p>
        )}

        {!loading && preview && !preview.success && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              تعذّر تحميل تفاصيل الحزمة. حاول مرة أخرى.
            </AlertDescription>
          </Alert>
        )}

        {!loading && ok && (
          <div className="space-y-4">
            {ok.package.description && (
              <p className="text-sm text-gray-600">{ok.package.description}</p>
            )}

            {/* Course list */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5">
                دورات الحزمة ({ok.courses.length})
              </p>
              <ul className="border rounded-lg divide-y">
                {ok.courses.map((c) => (
                  <li
                    key={c.courseId}
                    className="flex items-center gap-2 p-2.5 text-sm"
                  >
                    <BookOpen className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="flex-1">{c.title}</span>
                    {c.instructorName && (
                      <span className="text-xs text-gray-500">
                        {c.instructorName}
                      </span>
                    )}
                  </li>
                ))}
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

            {/* Price + wallet */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">سعر الحزمة</span>
                <span className="font-bold text-gray-900">
                  {ok.package.price.toLocaleString()} د.ع
                </span>
              </div>
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
          <Button onClick={handlePurchase} disabled={!canBuy}>
            {purchasing
              ? "جارٍ الشراء..."
              : ok
                ? `شراء بـ ${ok.package.price.toLocaleString()} د.ع`
                : "شراء"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
