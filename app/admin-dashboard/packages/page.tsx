"use client";

// Admin packages dashboard (Phase 3).
//
// Two tabs: the package list (create / edit) and the per-instructor payout
// ledger. All data is loaded through server actions (`package_admin_actions`)
// which verify admin rights and use the firebase-admin SDK — so this page
// needs no client Firestore reads and no security-rule changes.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/authContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Plus, ArrowRight } from "lucide-react";
import type { CoursePackage } from "@/types/types";
import {
  listPackagesForAdmin,
  listCoursesForPicker,
  getPayoutLedger,
  type PickerCourse,
  type PayoutLedger as Ledger,
} from "@/app/actions/package_admin_actions";
import PackageEditor from "./_components/PackageEditor";
import PayoutLedgerView from "./_components/PayoutLedger";

const STATUS_LABEL: Record<CoursePackage["status"], string> = {
  draft: "مسودة",
  active: "نشطة",
  archived: "مؤرشفة",
};
const STATUS_CLASS: Record<CoursePackage["status"], string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  archived: "bg-amber-100 text-amber-800",
};

export default function AdminPackagesPage() {
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [token, setToken] = useState("");
  const [packages, setPackages] = useState<CoursePackage[]>([]);
  const [courses, setCourses] = useState<PickerCourse[]>([]);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CoursePackage | null>(null);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const t = await user.getIdToken();
      setToken(t);
      const [pkgRes, courseRes, ledgerRes] = await Promise.all([
        listPackagesForAdmin(t),
        listCoursesForPicker(t),
        getPayoutLedger(t),
      ]);
      if (!pkgRes.success || !courseRes.success || !ledgerRes.success) {
        setDenied(true);
        return;
      }
      setPackages(pkgRes.packages);
      setCourses(courseRes.courses);
      setLedger(ledgerRes.ledger);
      setDenied(false);
    } catch (e) {
      console.error("loadAll error", e);
      setDenied(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading && user) loadAll();
  }, [isLoading, user, loadAll]);

  if (isLoading || loading) {
    return <p className="text-center py-12 text-gray-600">جاري التحميل...</p>;
  }
  if (!user) {
    return (
      <p className="text-center py-12 text-gray-600">
        يرجى تسجيل الدخول للوصول إلى لوحة الإدارة
      </p>
    );
  }
  if (denied) {
    return (
      <p className="text-center py-12 text-gray-600">
        غير مصرح — هذه الصفحة للمدير فقط
      </p>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (pkg: CoursePackage) => {
    setEditing(pkg);
    setEditorOpen(true);
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">حزم الدورات</h1>
        <Button variant="outline" asChild>
          <Link href="/admin-dashboard">
            <ArrowRight className="h-4 w-4 ml-1" />
            لوحة الإدارة
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="packages">
        <TabsList>
          <TabsTrigger value="packages">
            الحزم ({packages.length})
          </TabsTrigger>
          <TabsTrigger value="payouts">
            مستحقات المدربين ({ledger?.rows.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Packages tab */}
        <TabsContent value="packages" className="space-y-4">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 ml-1" />
            إنشاء حزمة جديدة
          </Button>

          {packages.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">لا توجد حزم بعد</p>
            </div>
          ) : (
            <div className="space-y-3">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white border rounded-lg p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {pkg.title}
                        </h3>
                        <Badge className={STATUS_CLASS[pkg.status]}>
                          {STATUS_LABEL[pkg.status]}
                        </Badge>
                        {pkg.coursesLocked && (
                          <Badge className="bg-gray-100 text-gray-700">
                            <Lock className="h-3 w-3 ml-1" />
                            مقفلة
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                        <span>
                          السعر:{" "}
                          <span className="font-medium text-gray-900">
                            {pkg.price.toLocaleString()} د.ع
                          </span>
                        </span>
                        <span>{pkg.courseIds.length} دورة</span>
                        <span>{pkg.saleCount ?? 0} عملية بيع</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(pkg)}
                    >
                      تعديل
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Payouts tab */}
        <TabsContent value="payouts">
          {ledger && (
            <PayoutLedgerView
              ledger={ledger}
              token={token}
              onRecorded={loadAll}
            />
          )}
        </TabsContent>
      </Tabs>

      <PackageEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        courses={courses}
        existing={editing}
        token={token}
        onSaved={loadAll}
      />
    </div>
  );
}
