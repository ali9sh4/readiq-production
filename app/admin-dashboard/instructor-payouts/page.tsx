"use client";

// Admin instructor-payouts dashboard.
//
// An instructor's earnings are a real-world cash payable the platform owes
// them — separate from their spend wallet. This page is the running tally:
// earned (Σ earning entries) − paid (Σ recorded payouts) = outstanding.
// Recording a payout is bookkeeping only; it never moves money.
//
// Data loads through `instructor_payout_actions` server actions, which
// verify admin rights and use the firebase-admin SDK — no client Firestore
// reads, no security-rule changes. The `/admin-dashboard/*` route is also
// gated by middleware.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/authContext";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, PhoneOff } from "lucide-react";
import {
  getInstructorEarningsOverview,
  type EarningsOverview,
} from "@/app/actions/instructor_payout_actions";
import { formatLedgerDate } from "@/components/earnings/LedgerTable";
import InstructorDetailDialog from "./_components/InstructorDetailDialog";

export default function AdminInstructorPayoutsPage() {
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [token, setToken] = useState("");
  const [overview, setOverview] = useState<EarningsOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const t = await user.getIdToken();
      setToken(t);
      const res = await getInstructorEarningsOverview(t);
      if (!res.success) {
        setDenied(true);
        return;
      }
      setOverview(res.overview);
      setDenied(false);
    } catch (e) {
      console.error("load overview error", e);
      setDenied(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading && user) load();
  }, [isLoading, user, load]);

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
  if (denied || !overview) {
    return (
      <p className="text-center py-12 text-gray-600">
        غير مصرح — هذه الصفحة للمدير فقط
      </p>
    );
  }

  const openDetail = (instructorId: string) => {
    setSelectedId(instructorId);
    setDetailOpen(true);
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">مستحقات المدربين</h1>
        <Button variant="outline" asChild>
          <Link href="/admin-dashboard">
            <ArrowRight className="h-4 w-4 ml-1" />
            لوحة الإدارة
          </Link>
        </Button>
      </div>

      <p className="text-sm text-gray-500">
        أرباح المدرب هي مبالغ نقدية تستحق له خارج التطبيق — وليست رصيداً قابلاً
        للإنفاق داخل المنصة. «تسجيل دفعة» قيد محاسبي يوثّق دفعة تمّت فعلياً.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-2xl font-bold text-green-900">
            {overview.totalEarnings.toLocaleString()} د.ع
          </p>
          <p className="text-green-700 text-sm">إجمالي أرباح المدربين</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-2xl font-bold text-blue-900">
            {overview.totalPayouts.toLocaleString()} د.ع
          </p>
          <p className="text-blue-700 text-sm">إجمالي ما تم دفعه</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-2xl font-bold text-gray-900">
            {overview.totalOutstanding.toLocaleString()} د.ع
          </p>
          <p className="text-gray-700 text-sm">إجمالي المتبقي المستحق</p>
        </div>
      </div>

      {overview.rows.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">لا يوجد مدربون بأرباح بعد.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المدرب</TableHead>
                <TableHead className="text-right">النسبة</TableHead>
                <TableHead className="text-right">الأرباح</TableHead>
                <TableHead className="text-right">المدفوع</TableHead>
                <TableHead className="text-right">المتبقي</TableHead>
                <TableHead className="text-right">آخر دفعة</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.rows.map((row) => (
                <TableRow key={row.instructorId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.instructorName}</span>
                      {!row.phone && (
                        <span
                          title="لا يوجد رقم هاتف"
                          className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                        >
                          <PhoneOff className="h-3 w-3" />
                          لا يوجد هاتف
                        </span>
                      )}
                    </div>
                    {row.email && (
                      <div className="text-xs text-gray-400">{row.email}</div>
                    )}
                  </TableCell>
                  <TableCell>{row.revenueSharePercent}%</TableCell>
                  <TableCell>{row.earningsTotal.toLocaleString()} د.ع</TableCell>
                  <TableCell>{row.payoutsTotal.toLocaleString()} د.ع</TableCell>
                  <TableCell
                    className={
                      row.outstanding > 0
                        ? "font-semibold text-red-600"
                        : row.outstanding < 0
                          ? "font-semibold text-amber-600"
                          : "text-green-600"
                    }
                  >
                    {row.outstanding.toLocaleString()} د.ع
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatLedgerDate(row.lastPayoutAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDetail(row.instructorId)}
                    >
                      تفاصيل
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <InstructorDetailDialog
        token={token}
        instructorId={selectedId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onChanged={load}
      />
    </div>
  );
}
