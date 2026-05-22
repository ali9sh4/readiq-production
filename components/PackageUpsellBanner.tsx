"use client";

// Course-page package upsell banner (Phase 4; redesigned in the UI polish
// pass). Renders on a course detail page when the current course belongs to
// one or more active, purchasable packages. Shows up to two; opening one
// launches the checkout modal. Renders nothing when there is no signed-in
// user or no eligible package — the common case has zero visual footprint.
//
// Amber is the package accent — deliberately distinct from the blue/purple
// course UI, signalling "bundle / deal". There is no /packages catalog page
// in v1; discovery is only this banner on included course pages.

import { useEffect, useState } from "react";
import { useAuth } from "@/context/authContext";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";
import {
  getPackagesForCourse,
  type CoursePackageSummary,
} from "@/app/actions/package_wallet_actions";
import PackageCheckoutDialog from "@/components/PackageCheckoutDialog";
import { StackedThumbs } from "@/components/PackageThumbs";

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
      <div dir="rtl" className="mx-auto mt-6 max-w-5xl px-4">
        <div className="overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-bl from-amber-50 to-white shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-100/70 px-4 py-2.5">
            <Layers className="h-4 w-4 text-amber-700" />
            <span className="text-sm font-semibold text-amber-900">
              متوفّرة ضمن حزمة — وفّر بشرائها معاً
            </span>
          </div>

          {/* Package rows */}
          <div className="divide-y divide-amber-100">
            {shown.map((pkg) => {
              const saving = pkg.total - pkg.price;
              const hasSaving = saving > 0;
              return (
                <div
                  key={pkg.id}
                  className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  {/* Identity: stacked thumbs + title + count */}
                  <div className="flex items-center gap-3">
                    <StackedThumbs thumbnails={pkg.thumbnails} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                          حزمة
                        </span>
                        <h3 className="truncate font-bold text-gray-900">
                          {pkg.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {pkg.courseCount} دورات
                      </p>
                    </div>
                  </div>

                  {/* Deal: price block + CTA */}
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div>
                      {hasSaving && (
                        <p className="text-sm text-gray-400 line-through">
                          {pkg.total.toLocaleString()} د.ع
                        </p>
                      )}
                      <p className="text-xl font-extrabold text-gray-900">
                        {pkg.price.toLocaleString()} د.ع
                      </p>
                      {hasSaving && (
                        <p className="text-sm font-semibold text-green-600">
                          توفّر {saving.toLocaleString()} د.ع
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => setCheckoutId(pkg.id)}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      عرض الحزمة
                    </Button>
                  </div>
                </div>
              );
            })}
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
