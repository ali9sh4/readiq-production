"use client";

// Create / edit dialog for a course package (Phase 3).
//
// Course-list lock: when the package already has a sale
// (`existing.coursesLocked`), the course picker is disabled and an
// explanatory banner is shown — the admin sees *why* it is read-only.
// Price and per-instructor payouts stay editable.
//
// Over-price warning: if the sum of instructor payouts exceeds the package
// price, a destructive banner is shown, but the save button stays enabled
// (the platform may intentionally run a package at a loss).

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Lock } from "lucide-react";
import type { CoursePackage, PackageStatus } from "@/types/types";
import {
  createPackage,
  updatePackage,
  type PickerCourse,
} from "@/app/actions/package_admin_actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: PickerCourse[];
  existing: CoursePackage | null;
  token: string;
  onSaved: () => void;
};

export default function PackageEditor({
  open,
  onOpenChange,
  courses,
  existing,
  token,
  onSaved,
}: Props) {
  const locked = existing?.coursesLocked === true;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<PackageStatus>("draft");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [payouts, setPayouts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Re-seed the form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setTitle(existing?.title ?? "");
    setDescription(existing?.description ?? "");
    setPrice(existing?.price ? String(existing.price) : "");
    setStatus(existing?.status ?? "draft");
    setSelectedIds(existing?.courseIds ?? []);
    setPayouts(
      Object.fromEntries(
        Object.entries(existing?.payouts ?? {}).map(([k, v]) => [k, String(v)])
      )
    );
  }, [open, existing]);

  const courseById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses]
  );

  // The package's instructor set. Frozen (from the stored name map) once the
  // course list is locked; otherwise derived from the selected courses.
  const instructorIds = useMemo<string[]>(() => {
    if (locked) return Object.keys(existing?.payoutInstructorNames ?? {});
    const ids = new Set<string>();
    for (const id of selectedIds) {
      const c = courseById.get(id);
      if (c) ids.add(c.createdBy);
    }
    return [...ids];
  }, [locked, existing, selectedIds, courseById]);

  const instructorName = (id: string): string =>
    existing?.payoutInstructorNames?.[id] ??
    courses.find((c) => c.createdBy === id)?.instructorName ??
    id;

  const priceNum = Number.parseInt(price, 10) || 0;
  const payoutSum = instructorIds.reduce(
    (sum, id) => sum + (Number.parseInt(payouts[id] ?? "", 10) || 0),
    0
  );
  const overBudget = payoutSum > priceNum && priceNum > 0;

  const toggleCourse = (id: string) => {
    if (locked) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert("عنوان الحزمة مطلوب");
      return;
    }
    if (priceNum <= 0) {
      alert("سعر الحزمة يجب أن يكون أكبر من صفر");
      return;
    }
    if (status === "active" && selectedIds.length < 2) {
      alert("يجب اختيار دورتين على الأقل لتفعيل الحزمة");
      return;
    }

    const input = {
      title: title.trim(),
      description: description.trim() || undefined,
      courseIds: selectedIds,
      price: priceNum,
      payouts: Object.fromEntries(
        instructorIds.map((id) => [id, Number.parseInt(payouts[id] ?? "", 10) || 0])
      ),
      status,
    };

    setSaving(true);
    try {
      const res = existing
        ? await updatePackage(token, existing.id, input)
        : await createPackage(token, input);
      if (!res.success) {
        alert(res.message);
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {existing ? "تعديل الحزمة" : "إنشاء حزمة جديدة"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-title">عنوان الحزمة</Label>
            <Input
              id="pkg-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: مسار تصميم الأسنان الكامل"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-desc">الوصف (اختياري)</Label>
            <Textarea
              id="pkg-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Course picker */}
          <div className="space-y-2">
            <Label>الدورات في الحزمة ({selectedIds.length})</Label>
            {locked && (
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>قائمة الدورات مقفلة</AlertTitle>
                <AlertDescription>
                  تمت {existing?.saleCount ?? 0} عملية بيع لهذه الحزمة. لا يمكن
                  إضافة أو إزالة دورات — المشترون السابقون مرتبطون بهذه القائمة.
                  السعر والمستحقات لا تزال قابلة للتعديل.
                </AlertDescription>
              </Alert>
            )}
            <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
              {courses.length === 0 && (
                <p className="p-3 text-sm text-gray-500">لا توجد دورات متاحة</p>
              )}
              {courses.map((c) => {
                const checked = selectedIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 p-2.5 text-sm ${
                      locked
                        ? "cursor-not-allowed opacity-70"
                        : "cursor-pointer hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={() => toggleCourse(c.id)}
                      className="h-4 w-4"
                    />
                    <span className="flex-1">{c.title}</span>
                    <span className="text-xs text-gray-500">
                      {c.instructorName}
                    </span>
                    {c.purchaseMode === "sectional" && (
                      <span className="text-xs text-amber-600">مقسّمة</span>
                    )}
                  </label>
                );
              })}
              {/* Locked-in courses no longer in the available list. */}
              {locked &&
                (existing?.courseIds ?? [])
                  .filter((id) => !courseById.has(id))
                  .map((id) => (
                    <div
                      key={id}
                      className="flex items-center gap-3 p-2.5 text-sm opacity-70"
                    >
                      <input type="checkbox" checked disabled className="h-4 w-4" />
                      <span className="flex-1">{id}</span>
                      <span className="text-xs text-red-600">غير متاحة</span>
                    </div>
                  ))}
            </div>
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-price">سعر الحزمة (د.ع)</Label>
            <Input
              id="pkg-price"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          {/* Per-instructor payouts */}
          <div className="space-y-2">
            <Label>مستحقات المدربين (د.ع)</Label>
            <p className="text-xs text-gray-500">
              المبلغ المتفق عليه لكل مدرب. بيع الحزمة لا يضيف لمحفظة المدرب —
              يُسجَّل هنا فقط ليُدفع يدوياً.
            </p>
            {instructorIds.length === 0 ? (
              <p className="text-sm text-gray-500">اختر دورات أولاً.</p>
            ) : (
              <div className="space-y-2">
                {instructorIds.map((id) => (
                  <div key={id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm">{instructorName(id)}</span>
                    <Input
                      type="number"
                      min={0}
                      className="w-36"
                      value={payouts[id] ?? ""}
                      onChange={(e) =>
                        setPayouts((prev) => ({ ...prev, [id]: e.target.value }))
                      }
                    />
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-1 border-t">
                  <span className="text-gray-600">مجموع المستحقات</span>
                  <span className="font-semibold">
                    {payoutSum.toLocaleString("en-US")} د.ع
                  </span>
                </div>
              </div>
            )}
            {overBudget && (
              <Alert variant="destructive">
                <AlertTitle>المستحقات تتجاوز سعر الحزمة</AlertTitle>
                <AlertDescription>
                  مجموع المستحقات ({payoutSum.toLocaleString("en-US")} د.ع) أكبر من سعر
                  الحزمة ({priceNum.toLocaleString("en-US")} د.ع) — ستخسر{" "}
                  {(payoutSum - priceNum).toLocaleString("en-US")} د.ع على كل عملية بيع.
                  يمكنك الحفظ على أي حال.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>الحالة</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PackageStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">مسودة</SelectItem>
                <SelectItem value="active">نشطة (قابلة للشراء)</SelectItem>
                <SelectItem value="archived">مؤرشفة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "جارٍ الحفظ..." : existing ? "حفظ التعديلات" : "إنشاء"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
