"use client";

// Instructor self-view of earnings.
//
// Answers one question for an instructor: how much the platform owes me,
// and whether it has been delivered. Read-only — instructors never record
// payouts or edit their own rate; that is the admin's job.
//
// Earnings are a real-world cash payable, NOT spendable platform credit, so
// this is intentionally separate from the spend-wallet balance shown
// elsewhere in the dashboard.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/authContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import LedgerTable from "@/components/earnings/LedgerTable";
import {
  getMyEarnings,
  type MyEarnings,
} from "@/app/actions/instructor_payout_actions";

export default function MyEarningsPage() {
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<MyEarnings | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await getMyEarnings(token);
      if (res.success) {
        setEarnings(res.earnings);
        setError(false);
      } else {
        setError(true);
      }
    } catch (e) {
      console.error("load my earnings error", e);
      setError(true);
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
  if (error || !earnings) {
    return (
      <p className="text-center py-12 text-gray-600">
        تعذّر تحميل الأرباح — حاول لاحقاً.
      </p>
    );
  }

  const hasActivity =
    earnings.earningsTotal > 0 ||
    earnings.payoutsTotal > 0 ||
    earnings.entries.length > 0;

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">أرباحي</h1>
        <p className="text-sm text-gray-500 mt-1">
          أرباحك من بيع الدورات مبالغ نقدية تستحقها وتُسلَّم لك خارج التطبيق —
          وهي منفصلة عن رصيد محفظتك القابل للإنفاق داخل المنصة.
        </p>
      </div>

      {!hasActivity ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            لا توجد أرباح بعد — ستظهر هنا عند بيع أول دورة لك.
          </p>
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-2xl font-bold text-green-900">
                {earnings.earningsTotal.toLocaleString()} د.ع
              </p>
              <p className="text-green-700 text-sm">إجمالي ما ربحته</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-2xl font-bold text-blue-900">
                {earnings.payoutsTotal.toLocaleString()} د.ع
              </p>
              <p className="text-blue-700 text-sm">إجمالي ما استلمته</p>
            </div>
            <div
              className={
                earnings.outstanding < 0
                  ? "bg-amber-50 border border-amber-200 rounded-lg p-4"
                  : "bg-gray-50 border border-gray-200 rounded-lg p-4"
              }
            >
              <p
                className={
                  earnings.outstanding < 0
                    ? "text-2xl font-bold text-amber-900"
                    : "text-2xl font-bold text-gray-900"
                }
              >
                {earnings.outstanding.toLocaleString()} د.ع
              </p>
              <p
                className={
                  earnings.outstanding < 0
                    ? "text-amber-700 text-sm"
                    : "text-gray-700 text-sm"
                }
              >
                {earnings.outstanding < 0
                  ? "رصيد مقدّم (استلمت أكثر)"
                  : "المتبقي المستحق لك"}
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            نسبتك الحالية من كل عملية بيع:{" "}
            <strong>{earnings.revenueSharePercent}%</strong>. تُطبَّق على
            المبيعات القادمة؛ كل حركة في السجل تحتفظ بالنسبة وقت البيع.
          </p>

          {earnings.outstanding < 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                استلمت أكثر مما تجمّع لك حتى الآن — الفرق رصيد مقدّم سيُخصم من
                أرباحك القادمة.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <h2 className="font-semibold text-gray-800">سجل الحركات</h2>
            <LedgerTable entries={earnings.entries} />
          </div>
        </>
      )}
    </div>
  );
}
