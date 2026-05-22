"use client";

// Course-page package upsell banner (Phase 4).
//
// Renders on a course detail page when the current course is part of one or
// more active, purchasable packages. Shows up to two; opening one launches
// the checkout dialog. Renders nothing when there is no signed-in user or
// no eligible package — so the common case has zero visual footprint.
//
// There is intentionally no /packages catalog page in v1 — discovery is
// only this banner on included course pages.

import { useEffect, useState } from "react";
import { useAuth } from "@/context/authContext";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";
import {
  getPackagesForCourse,
  type CoursePackageSummary,
} from "@/app/actions/package_wallet_actions";
import PackageCheckoutDialog from "@/components/PackageCheckoutDialog";

const MAX_SHOWN = 2;

export default function PackageUpsellBanner({
  courseId,
}: {
  courseId: string;
}) {
  const { user, isLoading } = useAuth();
  const [packages, setPackages] = useState<CoursePackageSummary[]>([]);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isLoading || !user) return;
      try {
        const token = await user.getIdToken();
        const res = await getPackagesForCourse(token, courseId);
        if (!cancelled && res.success) setPackages(res.packages);
      } catch (e) {
        console.error("upsell banner load error", e);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, isLoading, courseId]);

  if (packages.length === 0) return null;

  const shown = packages.slice(0, MAX_SHOWN);

  return (
    <>
      <div
        dir="rtl"
        className="mx-auto max-w-5xl px-4 mt-4"
      >
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-indigo-900">
              متوفّرة ضمن حزمة — وفّر بشراء عدة دورات معاً
            </h3>
          </div>
          <div className="space-y-2">
            {shown.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-white border border-indigo-100 p-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{pkg.title}</p>
                  <p className="text-sm text-gray-500">
                    {pkg.courseCount} دورات · {pkg.price.toLocaleString()} د.ع
                  </p>
                </div>
                <Button size="sm" onClick={() => setCheckoutId(pkg.id)}>
                  عرض الحزمة
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PackageCheckoutDialog
        packageId={checkoutId}
        open={checkoutId !== null}
        onOpenChange={(o) => !o && setCheckoutId(null)}
      />
    </>
  );
}
