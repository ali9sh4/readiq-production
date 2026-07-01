"use client";

// Per-instructor payout ledger (Phase 3).
//
// A package sale credits only the platform wallet; instructors are paid out
// of band. This table is the running tally: owed (summed from the payout
// snapshot on every sale) minus paid (recorded manual payouts) =
// outstanding. "تسجيل دفعة" records a manual payment so the outstanding
// number stays accurate after each settlement.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  recordInstructorPayout,
  type PayoutLedger as Ledger,
  type PayoutLedgerRow,
} from "@/app/actions/package_admin_actions";

type Props = {
  ledger: Ledger;
  token: string;
  onRecorded: () => void;
};

export default function PayoutLedger({ ledger, token, onRecorded }: Props) {
  const [target, setTarget] = useState<PayoutLedgerRow | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const openDialog = (row: PayoutLedgerRow) => {
    setTarget(row);
    setAmount(row.outstanding > 0 ? String(row.outstanding) : "");
    setNote("");
  };

  const handleRecord = async () => {
    if (!target) return;
    const amt = Number.parseInt(amount, 10) || 0;
    if (amt <= 0) {
      alert("المبلغ يجب أن يكون أكبر من صفر");
      return;
    }
    setSaving(true);
    try {
      const res = await recordInstructorPayout(token, {
        instructorId: target.instructorId,
        amount: amt,
        note: note.trim() || undefined,
      });
      if (!res.success) {
        alert(res.message);
        return;
      }
      setTarget(null);
      onRecorded();
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء تسجيل الدفعة");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-2xl font-bold text-blue-900">
            {ledger.totalRevenue.toLocaleString("en-US")} د.ع
          </p>
          <p className="text-blue-700 text-sm">إجمالي إيراد الحزم (المنصة)</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-2xl font-bold text-gray-900">
            {ledger.totalSales}
          </p>
          <p className="text-gray-700 text-sm">عدد مبيعات الحزم</p>
        </div>
      </div>

      {ledger.rows.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            لا توجد مستحقات بعد — لم تُباع أي حزمة.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">المدرب</TableHead>
              <TableHead className="text-right">المستحق</TableHead>
              <TableHead className="text-right">المدفوع</TableHead>
              <TableHead className="text-right">المتبقي</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.rows.map((row) => (
              <TableRow key={row.instructorId}>
                <TableCell className="font-medium">
                  {row.instructorName}
                </TableCell>
                <TableCell>{row.owed.toLocaleString("en-US")} د.ع</TableCell>
                <TableCell>{row.paid.toLocaleString("en-US")} د.ع</TableCell>
                <TableCell
                  className={
                    row.outstanding > 0
                      ? "font-semibold text-red-600"
                      : "text-green-600"
                  }
                >
                  {row.outstanding.toLocaleString("en-US")} د.ع
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDialog(row)}
                  >
                    تسجيل دفعة
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Record-payment dialog */}
      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة — {target?.instructorName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              المتبقي حالياً: {(target?.outstanding ?? 0).toLocaleString("en-US")} د.ع.
              سجّل هنا المبلغ الذي دفعته يدوياً للمدرب.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="payout-amount">المبلغ المدفوع (د.ع)</Label>
              <Input
                id="payout-amount"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payout-note">ملاحظة (اختياري)</Label>
              <Textarea
                id="payout-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="مثال: تحويل زين كاش بتاريخ ..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setTarget(null)}
              disabled={saving}
            >
              إلغاء
            </Button>
            <Button onClick={handleRecord} disabled={saving}>
              {saving ? "جارٍ التسجيل..." : "تسجيل الدفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
