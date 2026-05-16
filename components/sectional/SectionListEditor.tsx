// Phase 5a/5b/5c section-list editor.
//
// Renders the sectional purchasing config for one course:
//   - purchaseMode toggle (full vs sectional)
//   - fullCoursePrice input (sectional mode only)
//   - per-section title/order/price/salePrice inputs (sectional mode only)
//   - section creation + deletion (Phase 5c)
//
// Lock-aware: sold sections (isLocked: true) show a lock icon and restrict
// client-side edits to what the server-side `assertCourseMutationAllowed`
// helper would accept (raise price ok, lower price blocked, reorder blocked,
// delete blocked — title rename ok). New sections (no `sectionId` yet) are
// created locally and the server mints the id on save.
//
// Talks to `updateCourseSectionalConfig` server action. Re-renders from the
// course doc returned on success so the displayed state always matches what
// was just written.

"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Lock,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useAuth } from "@/context/authContext";
import type { Course, CourseSection } from "@/types/types";
import { updateCourseSectionalConfig } from "@/app/actions/sectional_config_actions";

type Props = {
  courseId: string;
  initialCourse: Course;
  onSaved?: (course: Course) => void;
};

// `clientKey` is the stable React key + addressable id for in-editor state.
// Existing sections also have a `sectionId` (the canonical Firestore id);
// newly-created sections have `sectionId: undefined` until the server mints
// one on save.
type EditableSection = {
  clientKey: string;
  sectionId: string | undefined;
  title: string;
  order: number;
  price: number | undefined;
  salePrice: number | undefined;
  isLocked: boolean;
  isNew: boolean;
  // Captured at load so we can client-side reject "lower than current"
  // before round-tripping to the server.
  originalPrice: number | undefined;
  originalSalePrice: number | undefined;
};

function makeClientKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toEditable(sections: CourseSection[] | undefined): EditableSection[] {
  return (sections ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      clientKey: makeClientKey(),
      sectionId: s.sectionId,
      title: s.title,
      order: s.order,
      price: s.price,
      salePrice: s.salePrice,
      isLocked: s.isLocked === true,
      isNew: false,
      originalPrice: s.price,
      originalSalePrice: s.salePrice,
    }));
}

// Match the number-input pattern from CourseDashboard's pricing form.
// Allow empty string + decimals; treat empty as undefined (not 0) so the
// instructor can leave a field unset.
function parseMaybeNumber(input: string): number | undefined {
  if (input === "") return undefined;
  const n = parseFloat(input);
  if (Number.isNaN(n) || n < 0) return undefined;
  return Math.round(n * 100) / 100;
}

export default function SectionListEditor({
  courseId,
  initialCourse,
  onSaved,
}: Props) {
  const auth = useAuth();

  const [purchaseMode, setPurchaseMode] = useState<"full" | "sectional">(
    initialCourse.purchaseMode === "sectional" ? "sectional" : "full"
  );
  const [fullCoursePrice, setFullCoursePrice] = useState<number | undefined>(
    initialCourse.fullCoursePrice
  );
  const [sections, setSections] = useState<EditableSection[]>(
    toEditable(initialCourse.sections)
  );
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<{
    message: string;
    sectionId?: string;
  } | null>(null);

  // The lock helper rejects flipping purchaseMode if any section is sold.
  // Bundle-buyer enrollments also trip the server-side guard but aren't
  // visible from the course doc — server is authoritative either way.
  const hasLockedSection = useMemo(
    () => sections.some((s) => s.isLocked),
    [sections]
  );
  const toggleDisabled = hasLockedSection;

  // `order` must be unique across sections in a single submission. Server
  // enforces this too (via SectionalConfigSchema), but flagging it
  // client-side avoids the round-trip and points at the offending rows.
  const duplicateOrderValues = useMemo(() => {
    if (purchaseMode !== "sectional") return new Set<number>();
    const counts = new Map<number, number>();
    for (const s of sections) {
      counts.set(s.order, (counts.get(s.order) ?? 0) + 1);
    }
    return new Set(
      Array.from(counts.entries())
        .filter(([, n]) => n > 1)
        .map(([order]) => order)
    );
  }, [sections, purchaseMode]);
  const hasDuplicateOrder = duplicateOrderValues.size > 0;

  const updateSection = (
    clientKey: string,
    patch: Partial<EditableSection>
  ) => {
    setSections((prev) =>
      prev.map((s) => (s.clientKey === clientKey ? { ...s, ...patch } : s))
    );
  };

  const addSection = () => {
    setSections((prev) => {
      const nextOrder =
        prev.length === 0 ? 0 : Math.max(...prev.map((s) => s.order)) + 1;
      return [
        ...prev,
        {
          clientKey: makeClientKey(),
          sectionId: undefined,
          title: "قسم جديد",
          order: nextOrder,
          price: undefined,
          salePrice: undefined,
          isLocked: false,
          isNew: true,
          originalPrice: undefined,
          originalSalePrice: undefined,
        },
      ];
    });
  };

  const removeSection = (clientKey: string, title: string) => {
    if (
      !confirm(
        `حذف القسم "${title}"؟ سيتم إلغاء ربط الفيديوهات منه. لن يُحفظ الحذف حتى تضغط "حفظ الإعدادات".`
      )
    ) {
      return;
    }
    setSections((prev) => prev.filter((s) => s.clientKey !== clientKey));
  };

  const handleSave = async () => {
    if (!auth?.user) {
      toast.error("يرجى تسجيل الدخول");
      return;
    }

    if (hasDuplicateOrder) {
      setServerError({
        message: "لا يمكن أن يتشارك قسمان نفس الترتيب. عدّل الأرقام أولًا.",
      });
      return;
    }

    // Empty title check (server schema also rejects).
    if (sections.some((s) => s.title.trim() === "")) {
      setServerError({ message: "عنوان القسم مطلوب لكل قسم." });
      toast.error("عنوان القسم مطلوب لكل قسم.");
      return;
    }

    // Client-side guard for the most common lock rejection. Server still
    // re-validates — this just saves a round-trip and gives a clearer
    // error location.
    for (const s of sections) {
      if (!s.isLocked) continue;
      if (
        s.price !== undefined &&
        s.originalPrice !== undefined &&
        s.price < s.originalPrice
      ) {
        setServerError({
          message: `لا يمكن خفض سعر "${s.title}" عن ${s.originalPrice} (تم بيع هذا القسم).`,
          sectionId: s.sectionId,
        });
        return;
      }
      if (
        s.salePrice !== undefined &&
        s.originalSalePrice !== undefined &&
        s.salePrice < s.originalSalePrice
      ) {
        setServerError({
          message: `لا يمكن خفض سعر تخفيض "${s.title}" عن ${s.originalSalePrice} (تم بيع هذا القسم).`,
          sectionId: s.sectionId,
        });
        return;
      }
    }

    setServerError(null);
    setSaving(true);

    try {
      const token = await auth.user.getIdToken();
      const result = await updateCourseSectionalConfig(token, courseId, {
        purchaseMode,
        fullCoursePrice,
        sections: sections.map((s) => ({
          // Omit `sectionId` for new rows so the server mints one.
          ...(s.sectionId ? { sectionId: s.sectionId } : {}),
          title: s.title.trim(),
          order: s.order,
          price: s.price,
          salePrice: s.salePrice,
        })),
      });

      if (result.success) {
        toast.success("تم حفظ إعدادات الأقسام");
        setSections(toEditable(result.course.sections));
        setPurchaseMode(
          result.course.purchaseMode === "sectional" ? "sectional" : "full"
        );
        setFullCoursePrice(result.course.fullCoursePrice);
        onSaved?.(result.course);
      } else {
        const sectionId =
          result.details &&
          typeof result.details === "object" &&
          "sectionId" in result.details
            ? ((result.details as { sectionId?: string }).sectionId ?? undefined)
            : undefined;
        setServerError({ message: result.message, sectionId });
        toast.error(result.message);
      }
    } catch (err) {
      console.error("sectional-config save error", err);
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" lang="ar" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-right">وضع البيع</CardTitle>
          <CardDescription className="text-right">
            اختر هل تُباع الدورة كاملةً أو على شكل أقسام منفصلة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={purchaseMode === "full" ? "default" : "outline"}
              onClick={() => !toggleDisabled && setPurchaseMode("full")}
              disabled={toggleDisabled}
              className="flex-1"
            >
              كامل
            </Button>
            <Button
              type="button"
              variant={purchaseMode === "sectional" ? "default" : "outline"}
              onClick={() => !toggleDisabled && setPurchaseMode("sectional")}
              disabled={toggleDisabled}
              className="flex-1"
            >
              مقسّم
            </Button>
          </div>
          {toggleDisabled && (
            <p className="mt-3 text-sm text-amber-700 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              لا يمكن تغيير وضع البيع بعد بيع أي قسم.
            </p>
          )}
        </CardContent>
      </Card>

      {purchaseMode === "sectional" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-right">سعر الحزمة الكاملة</CardTitle>
            <CardDescription className="text-right">
              السعر الذي يدفعه المشتري إذا اختار شراء كل الأقسام دفعةً واحدة
              (اتركه فارغًا لإخفاء خيار الحزمة).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="text"
              inputMode="decimal"
              value={fullCoursePrice === undefined ? "" : String(fullCoursePrice)}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
                  setFullCoursePrice(parseMaybeNumber(val));
                }
              }}
              placeholder="مثلاً: 15000"
              className="text-right h-11 text-base"
            />
            <p className="mt-2 text-sm text-gray-500">
              {fullCoursePrice === undefined
                ? "لم يُحدَّد سعر للحزمة"
                : `سعر الحزمة: ${fullCoursePrice.toLocaleString()} د.ع`}
            </p>
          </CardContent>
        </Card>
      )}

      {purchaseMode === "sectional" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-right">أقسام الدورة وأسعارها</CardTitle>
            <CardDescription className="text-right">
              عدّل عنوان وسعر كل قسم. الأقسام المباعة مُقفلة جزئيًا — يمكن
              رفع السعر وتعديل العنوان، لا يمكن خفض السعر أو حذف القسم أو إعادة
              ترتيبه.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sections.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                <p className="text-sm text-gray-600 mb-4">
                  لا توجد أقسام بعد. أضف قسمًا للبدء.
                </p>
                <Button
                  type="button"
                  onClick={addSection}
                  variant="outline"
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة قسم
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {sections.map((section) => {
                  const hasDuplicateRow = duplicateOrderValues.has(
                    section.order
                  );
                  const highlightError =
                    (section.sectionId !== undefined &&
                      serverError?.sectionId === section.sectionId) ||
                    hasDuplicateRow;
                  return (
                    <div
                      key={section.clientKey}
                      className={`rounded-lg border p-4 ${
                        highlightError
                          ? "border-red-400 bg-red-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <Label className="text-right block text-sm mb-1">
                            عنوان القسم *
                          </Label>
                          <Input
                            type="text"
                            value={section.title}
                            maxLength={100}
                            autoFocus={section.isNew}
                            onChange={(e) =>
                              updateSection(section.clientKey, {
                                title: e.target.value,
                              })
                            }
                            placeholder="عنوان القسم"
                            className="text-right h-10"
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 pt-6">
                          {section.isLocked && (
                            <span
                              className="flex items-center gap-1 text-xs text-amber-700"
                              title="تم بيع هذا القسم — يمكن رفع السعر فقط، لا يمكن خفضه أو حذف القسم."
                            >
                              <Lock className="w-3.5 h-3.5" />
                              مُقفل
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              !section.isLocked &&
                              removeSection(
                                section.clientKey,
                                section.title || "بدون عنوان"
                              )
                            }
                            disabled={section.isLocked}
                            title={
                              section.isLocked
                                ? "لا يمكن حذف قسم تم بيعه"
                                : "حذف القسم"
                            }
                            className="p-2 rounded-md text-red-600 hover:text-red-800 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-red-600 transition-colors"
                            aria-label="حذف القسم"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-right block text-sm mb-1">
                            الترتيب
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            value={section.order}
                            disabled={section.isLocked}
                            onChange={(e) => {
                              const n = parseInt(e.target.value, 10);
                              updateSection(section.clientKey, {
                                order: Number.isNaN(n) ? 0 : n,
                              });
                            }}
                            className="text-right h-10"
                          />
                          {hasDuplicateRow && (
                            <p className="mt-1 text-xs text-red-600">
                              ترتيب مكرر — اختر رقمًا فريدًا
                            </p>
                          )}
                        </div>
                        <div>
                          <Label className="text-right block text-sm mb-1">
                            السعر (د.ع)
                          </Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={
                              section.price === undefined
                                ? ""
                                : String(section.price)
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
                                updateSection(section.clientKey, {
                                  price: parseMaybeNumber(val),
                                });
                              }
                            }}
                            placeholder="اتركه فارغًا للقسم المجاني"
                            className="text-right h-10"
                          />
                          {section.isLocked &&
                            section.originalPrice !== undefined && (
                              <p className="mt-1 text-xs text-gray-500">
                                لا يقل عن {section.originalPrice.toLocaleString()}
                              </p>
                            )}
                        </div>
                        <div>
                          <Label className="text-right block text-sm mb-1">
                            سعر التخفيض (اختياري)
                          </Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={
                              section.salePrice === undefined
                                ? ""
                                : String(section.salePrice)
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
                                updateSection(section.clientKey, {
                                  salePrice: parseMaybeNumber(val),
                                });
                              }
                            }}
                            placeholder="اتركه فارغًا إن لم يكن هناك تخفيض"
                            className="text-right h-10"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-start">
                  <Button
                    type="button"
                    onClick={addSection}
                    variant="outline"
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة قسم
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {serverError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800 text-right">{serverError.message}</p>
        </div>
      )}

      {hasDuplicateOrder && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800 text-right">
            هناك أقسام تتشارك نفس رقم الترتيب. اجعل الترتيب فريدًا قبل الحفظ.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || hasDuplicateOrder}
          className="gap-2 h-11 px-6 text-base font-medium"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          حفظ الإعدادات
        </Button>
      </div>
    </div>
  );
}
