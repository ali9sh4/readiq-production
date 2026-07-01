"use client";

// Admin detail view for one instructor: full earnings ledger, record-payout
// flow, and revenue-share editor.
//
// Record-payout flow honours the spec's "re-fetch, show, then write": the
// confirm step shows a live preview, and `recordInstructorPayout` re-reads
// the instructor's totals inside its transaction — that re-read is the
// authoritative number, surfaced back in the result message.

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import LedgerTable from "@/components/earnings/LedgerTable";
import { normalizeIraqiPhone } from "@/lib/validation/phone";
import {
  getInstructorLedgerDetail,
  recordInstructorPayout,
  updateInstructorRevenueShare,
  updateInstructorPhone,
  type InstructorLedgerDetail,
} from "@/app/actions/instructor_payout_actions";

type Props = {
  token: string;
  instructorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
};

export default function InstructorDetailDialog({
  token,
  instructorId,
  open,
  onOpenChange,
  onChanged,
}: Props) {
  const [detail, setDetail] = useState<InstructorLedgerDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Record-payout state.
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  // Revenue-share state.
  const [rate, setRate] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  const [rateMsg, setRateMsg] = useState<string | null>(null);

  // Contact-phone state.
  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!instructorId) return;
    setLoading(true);
    try {
      const res = await getInstructorLedgerDetail(token, instructorId);
      if (res.success) {
        setDetail(res.detail);
        setRate(String(res.detail.revenueSharePercent));
        setPhone(res.detail.phone ?? "");
        // Prefill the payout amount with the current outstanding when there
        // is something owed; admin can still edit it for a partial payout.
        setAmount(
          res.detail.outstanding > 0 ? String(res.detail.outstanding) : ""
        );
      } else {
        setDetail(null);
      }
    } catch (e) {
      console.error("load detail error", e);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [token, instructorId]);

  useEffect(() => {
    if (open && instructorId) {
      setConfirming(false);
      setSaving(false);
      setResultMsg(null);
      setRateMsg(null);
      setPhoneMsg(null);
      setMethod("bank_transfer");
      setNote("");
      load();
    }
  }, [open, instructorId, load]);

  const amountNum = Number.parseInt(amount, 10) || 0;
  const outstanding = detail?.outstanding ?? 0;
  const remainingAfter = outstanding - amountNum;

  const handleConfirm = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await recordInstructorPayout(token, {
        instructorId: detail.instructorId,
        amount: amountNum,
        method,
        note: note.trim() || undefined,
      });
      if (!res.success) {
        alert(res.message);
        return;
      }
      setResultMsg(
        `تم التسجيل. كان المتبقي ${res.outstandingBefore.toLocaleString("en-US")} د.ع، ` +
          `سُجّلت دفعة ${res.amountRecorded.toLocaleString("en-US")} د.ع، ` +
          `والمتبقي الآن ${res.outstandingAfter.toLocaleString("en-US")} د.ع.`
      );
      setConfirming(false);
      setNote("");
      await load();
      onChanged();
    } catch (e) {
      console.error("record payout error", e);
      alert("حدث خطأ أثناء تسجيل الدفعة");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRate = async () => {
    if (!detail) return;
    const pct = Number(rate);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setRateMsg("النسبة يجب أن تكون بين 0 و 100");
      return;
    }
    setSavingRate(true);
    setRateMsg(null);
    try {
      const res = await updateInstructorRevenueShare(token, {
        instructorId: detail.instructorId,
        revenueSharePercent: pct,
      });
      if (!res.success) {
        setRateMsg(res.message);
        return;
      }
      setRateMsg("تم الحفظ — تُطبَّق على المبيعات القادمة فقط.");
      await load();
      onChanged();
    } catch (e) {
      console.error("save rate error", e);
      setRateMsg("حدث خطأ أثناء الحفظ");
    } finally {
      setSavingRate(false);
    }
  };

  const handleSavePhone = async () => {
    if (!detail) return;
    // Validate client-side for instant feedback; the action re-validates and
    // stores the canonical form regardless.
    const check = normalizeIraqiPhone(phone);
    if (!check.ok) {
      setPhoneMsg(check.error);
      return;
    }
    setSavingPhone(true);
    setPhoneMsg(null);
    try {
      const res = await updateInstructorPhone(token, {
        instructorId: detail.instructorId,
        phone,
      });
      if (!res.success) {
        setPhoneMsg(res.message);
        return;
      }
      // Reflect the canonical stored value back into the field.
      setPhone(res.phone);
      setPhoneMsg(res.phone ? "تم حفظ رقم الهاتف." : "تم مسح رقم الهاتف.");
      await load();
      onChanged();
    } catch (e) {
      console.error("save phone error", e);
      setPhoneMsg("حدث خطأ أثناء الحفظ");
    } finally {
      setSavingPhone(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {detail ? detail.instructorName : "تفاصيل المدرب"}
          </DialogTitle>
        </DialogHeader>

        {loading || !detail ? (
          <p className="text-center py-10 text-gray-500">جاري التحميل...</p>
        ) : (
          <div className="space-y-6">
            {detail.email && (
              <p className="text-sm text-gray-500 -mt-2">{detail.email}</p>
            )}

            {/* Totals */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-lg font-bold text-green-900">
                  {detail.earningsTotal.toLocaleString("en-US")} د.ع
                </p>
                <p className="text-green-700 text-xs">إجمالي الأرباح</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-lg font-bold text-blue-900">
                  {detail.payoutsTotal.toLocaleString("en-US")} د.ع
                </p>
                <p className="text-blue-700 text-xs">إجمالي المدفوع</p>
              </div>
              <div
                className={
                  detail.outstanding < 0
                    ? "bg-amber-50 border border-amber-200 rounded-lg p-3"
                    : "bg-gray-50 border border-gray-200 rounded-lg p-3"
                }
              >
                <p
                  className={
                    detail.outstanding < 0
                      ? "text-lg font-bold text-amber-900"
                      : "text-lg font-bold text-gray-900"
                  }
                >
                  {detail.outstanding.toLocaleString("en-US")} د.ع
                </p>
                <p
                  className={
                    detail.outstanding < 0
                      ? "text-amber-700 text-xs"
                      : "text-gray-700 text-xs"
                  }
                >
                  {detail.outstanding < 0 ? "رصيد مقدّم (دفعات زائدة)" : "المتبقي"}
                </p>
              </div>
            </div>

            {detail.outstanding < 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  المدفوع يتجاوز الأرباح المسجّلة — هذا رصيد مقدّم للمدرب،
                  سيُخصم تلقائياً من أرباحه القادمة.
                </AlertDescription>
              </Alert>
            )}

            {/* Contact phone editor */}
            <div className="border rounded-lg p-4 space-y-2">
              <Label htmlFor="phone" className="font-semibold">
                رقم الهاتف (اختياري)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  className="w-48 font-mono"
                  placeholder="07XXXXXXXXX"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPhoneMsg(null);
                  }}
                />
                <Button
                  variant="outline"
                  onClick={handleSavePhone}
                  disabled={savingPhone}
                >
                  {savingPhone ? "جارٍ الحفظ..." : "حفظ الرقم"}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                رقم هاتف عراقي بصيغة 07XXXXXXXXX. اتركه فارغاً لمسح الرقم.
              </p>
              {phoneMsg && <p className="text-xs text-blue-600">{phoneMsg}</p>}
            </div>

            {/* Revenue share editor */}
            <div className="border rounded-lg p-4 space-y-2">
              <Label htmlFor="rate" className="font-semibold">
                نسبة المدرب من البيع (%)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="rate"
                  type="number"
                  min={0}
                  max={100}
                  className="w-32"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={handleSaveRate}
                  disabled={savingRate}
                >
                  {savingRate ? "جارٍ الحفظ..." : "حفظ النسبة"}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                تُطبَّق على المبيعات القادمة فقط — لا تغيّر أي حركة سابقة في
                السجل.
              </p>
              {rateMsg && <p className="text-xs text-blue-600">{rateMsg}</p>}
            </div>

            {/* Record payout */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">تسجيل دفعة</h3>
              <p className="text-xs text-gray-500">
                سجّل هنا مبلغاً دفعته للمدرب خارج التطبيق. هذا قيد محاسبي فقط —
                لا يحرّك أي أموال.
              </p>

              {resultMsg && (
                <Alert>
                  <AlertDescription>{resultMsg}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="payout-amount">المبلغ (د.ع)</Label>
                  <Input
                    id="payout-amount"
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setConfirming(false);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>الطريقة</Label>
                  <Select
                    value={method}
                    onValueChange={(v) => {
                      setMethod(v);
                      setConfirming(false);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                      <SelectItem value="zaincash">زين كاش</SelectItem>
                      <SelectItem value="cash">نقداً</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payout-note">ملاحظة (اختياري)</Label>
                <Textarea
                  id="payout-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="مثال: تحويل بتاريخ ... — إيصال رقم ..."
                />
              </div>

              {!confirming ? (
                <Button
                  onClick={() => {
                    setResultMsg(null);
                    if (amountNum <= 0) {
                      alert("المبلغ يجب أن يكون أكبر من صفر");
                      return;
                    }
                    setConfirming(true);
                  }}
                >
                  تسجيل الدفعة
                </Button>
              ) : (
                <div className="bg-gray-50 border rounded-lg p-3 space-y-3">
                  <p className="text-sm text-gray-700">
                    المتبقي حالياً{" "}
                    <strong>{outstanding.toLocaleString("en-US")} د.ع</strong>، تسجيل
                    دفعة <strong>{amountNum.toLocaleString("en-US")} د.ع</strong> —
                    سيتبقى{" "}
                    <strong
                      className={
                        remainingAfter < 0 ? "text-amber-700" : undefined
                      }
                    >
                      {remainingAfter.toLocaleString("en-US")} د.ع
                    </strong>
                    {remainingAfter < 0 && " (رصيد مقدّم)"}.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleConfirm} disabled={saving}>
                      {saving ? "جارٍ التسجيل..." : "تأكيد التسجيل"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setConfirming(false)}
                      disabled={saving}
                    >
                      رجوع
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Ledger */}
            <div className="space-y-2">
              <h3 className="font-semibold">السجل الكامل</h3>
              <LedgerTable entries={detail.entries} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
