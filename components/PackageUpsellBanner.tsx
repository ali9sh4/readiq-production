"use client";

// Package banner — used in two places, same amber visual:
//
//   - Course page  (`courseId` given): packages that contain that course,
//     header "متوفّرة ضمن حزمة …", capped at two.
//   - Main catalog (`courseId` omitted): every active package the viewer
//     can buy, header "حزم الدورات …", no cap — placed above the course
//     grid as a clearly separate section.
//
// Both modes drop packages the viewer cannot purchase (owns/authored a
// member course) and open the same PackageCheckoutDialog. Amber is the
// package accent — deliberately distinct from the blue/purple course UI.
// Renders nothing when there is no signed-in user or no eligible package.

import { useEffect, useState } from "react";
import { useAuth } from "@/context/authContext";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";
import {
  getPackagesForCourse,
  getActivePackages,
  type CoursePackageSummary,
} from "@/app/actions/package_wallet_actions";
import PackageCheckoutDialog from "@/components/PackageCheckoutDialog";
import { StackedThumbs } from "@/components/PackageThumbs";

// Course-page mode shows at most this many; catalog mode shows all.
const MAX_COURSE_PAGE = 2;

export default function PackageUpsellBanner({
  courseId,
}: {
  courseId?: string;
}) {
  const catalog = !courseId;
  const { user, isLoading } = useAuth();
  const [packages, setPackages] = useState<CoursePackageSummary[]>([]);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isLoading) return;
      // Course-page mode needs a signed-in viewer; catalog mode is the
      // storefront and loads for signed-out visitors too.
      if (!catalog && !user) return;
      try {
        const token = user ? await user.getIdToken() : undefined;
        const res = courseId
          ? await getPackagesForCourse(token!, courseId)
          : await getActivePackages(token);
        if (!cancelled && res.success) setPackages(res.packages);
      } catch (e) {
        console.error("package banner load error", e);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, isLoading, courseId, catalog]);

  if (packages.length === 0) return null;

  const shown = catalog ? packages : packages.slice(0, MAX_COURSE_PAGE);
  const heading = catalog
    ? "حزم الدورات — وفّر بشرائها معاً"
    : "متوفّرة ضمن حزمة — وفّر بشرائها معاً";

  return (
    <>
      <div
        dir="rtl"
        className={catalog ? "mb-8 w-full" : "mx-auto mt-6 max-w-5xl px-4"}
      >
        <div className="overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-bl from-amber-50 to-white shadow-sm">
          {/* Section header */}
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-100/70 px-4 py-3">
            <Layers
              className={`text-amber-700 ${catalog ? "h-5 w-5" : "h-4 w-4"}`}
            />
            <h2
              className={`text-amber-900 ${
                catalog
                  ? "text-base font-bold"
                  : "text-sm font-semibold"
              }`}
            >
              {heading}
            </h2>
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
        summary={
          checkoutId
            ? packages.find((p) => p.id === checkoutId) ?? null
            : null
        }
        open={checkoutId !== null}
        onOpenChange={(o) => !o && setCheckoutId(null)}
      />
    </>
  );
}
