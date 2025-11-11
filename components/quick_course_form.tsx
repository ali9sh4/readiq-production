"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Sparkles, Zap, Clock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { QuickCourseSchema } from "@/validation/propertySchema";
import z from "zod";

type InputT = z.input<typeof QuickCourseSchema>;
type OutputT = z.output<typeof QuickCourseSchema>;

type Props = {
  handleSubmit?: (data: OutputT) => void;
  submitButtonLabel: React.ReactNode;
};

export default function QuickCourseForm({
  handleSubmit,
  submitButtonLabel,
}: Props) {
  const form = useForm<InputT>({
    resolver: zodResolver(QuickCourseSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      category: undefined,
      level: undefined,
      price: 0, // This stays as 0
      description: "",
    } as Partial<InputT>,
  });

  const onSubmit: SubmitHandler<InputT> = (data) => {
    handleSubmit?.(QuickCourseSchema.parse(data));
  };

  // Simple char counter for description
  const desc = form.watch("description") ?? "";
  const DESC_MAX = 180;

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-screen bg-gradient-to-b from-white to-indigo-50/40"
    >
      {/* Container */}
      <div className="mx-auto w-full max-w-3xl px-5 pt-10 pb-16">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 px-4 py-2 text-base font-semibold shadow-sm">
            <Zap className="size-5" />
            <span>إنشاء سريع</span>
          </div>

          <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">
            ابدأ دورتك في
            <span className="mx-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              30 ثانية
            </span>
          </h1>

          <p className="mt-3 text-lg sm:text-xl text-gray-600">
            فقط 5 معلومات أساسية للبدء 🚀
          </p>
          <p className="mt-1 text-sm sm:text-base text-gray-500">
            يمكنك إضافة التفاصيل لاحقًا من لوحة التحكم
          </p>
        </header>

        {/* Benefits (kept minimal to reduce distraction) */}
        <section
          aria-label="مزايا الإنشاء السريع"
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8"
        >
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <Clock className="size-5 text-blue-600 mb-1" />
            <p className="text-base font-semibold">سريع</p>
            <p className="text-sm text-gray-500">30 ثانية فقط</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <Sparkles className="size-5 text-emerald-600 mb-1" />
            <p className="text-base font-semibold">بسيط</p>
            <p className="text-sm text-gray-500">5 حقول فقط</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <Zap className="size-5 text-purple-600 mb-1" />
            <p className="text-base font-semibold">مرن</p>
            <p className="text-sm text-gray-500">أكمل لاحقًا</p>
          </div>
        </section>

        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 sm:p-8">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
              noValidate
            >
              <fieldset
                disabled={form.formState.isSubmitting}
                className="space-y-6"
              >
                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-bold text-gray-900">
                        1. عنوان الدورة <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="off"
                          placeholder="مثال: تعلم البرمجة من الصفر"
                          className="h-12 text-base border-gray-300 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500"
                          aria-required
                        />
                      </FormControl>
                      {/* ✅ ADD THIS */}
                      <div className="text-sm text-gray-500">
                        {field.value.length > 0
                          ? `${field.value.length} حرف ${
                              field.value.length >= 10
                                ? "✓"
                                : "- يُفضل 10 أحرف على الأقل"
                            }`
                          : "أدخل عنوانًا واضحًا وجذابًا"}
                      </div>
                      <FormMessage className="text-sm" />
                    </FormItem>
                  )}
                />

                {/* Category & Level */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-bold text-gray-900">
                          2. التصنيف <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ?? ""}
                            onValueChange={field.onChange}
                            dir="rtl"
                          >
                            <SelectTrigger className="h-12 text-base border-gray-300 focus:ring-2 focus:ring-blue-500/30">
                              <SelectValue placeholder="اختر التصنيف" />
                            </SelectTrigger>
                            <SelectContent align="end" className="text-base">
                              <SelectItem value="programming">
                                البرمجة
                              </SelectItem>
                              <SelectItem value="design">التصميم</SelectItem>
                              <SelectItem value="business">الأعمال</SelectItem>
                              <SelectItem value="marketing">التسويق</SelectItem>
                              <SelectItem value="photography">
                                التصوير
                              </SelectItem>
                              <SelectItem value="music">الموسيقى</SelectItem>
                              <SelectItem value="health_fitness">
                                الصحة واللياقة
                              </SelectItem>
                              <SelectItem value="medicine">
                                الطب والصحة
                              </SelectItem>
                              <SelectItem value="teaching">
                                التعليم والتدريس
                              </SelectItem>
                              <SelectItem value="languages">اللغات</SelectItem>
                              <SelectItem value="personal_development">
                                التنمية الذاتية
                              </SelectItem>
                              <SelectItem value="science">العلوم</SelectItem>
                              <SelectItem value="technology">
                                التقنية
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-bold text-gray-900">
                          3. المستوى
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ?? ""}
                            onValueChange={field.onChange}
                            dir="rtl"
                          >
                            <SelectTrigger className="h-12 text-base border-gray-300 focus:ring-2 focus:ring-blue-500/30">
                              <SelectValue placeholder="اختر المستوى" />
                            </SelectTrigger>
                            <SelectContent align="end" className="text-base">
                              <SelectItem value="all_levels">
                                جميع المستويات
                              </SelectItem>
                              <SelectItem value="beginner">مبتدئ</SelectItem>
                              <SelectItem value="intermediate">
                                متوسط
                              </SelectItem>
                              <SelectItem value="advanced">متقدم</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Price */}
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-bold text-gray-900">
                        4. السعر (دينار عراقي){" "}
                        <span className="ms-2 text-sm text-gray-500">
                          يمكنك تغييره لاحقًا
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          value={field.value === 0 ? "" : String(field.value)}
                          onChange={(e) => {
                            const val = e.target.value;

                            if (val === "") {
                              field.onChange(0);
                              return;
                            }

                            if (/^\d*\.?\d{0,2}$/.test(val)) {
                              const num = parseFloat(val);
                              field.onChange(isNaN(num) ? 0 : num);
                            }
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            const numValue = parseFloat(val);

                            if (val === "" || isNaN(numValue)) {
                              field.onChange(0);
                              return;
                            }

                            if (numValue < 0) {
                              field.onChange(0);
                              return;
                            }

                            field.onChange(Math.round(numValue * 100) / 100);
                          }}
                          placeholder="اتركه فارغًا للدورة المجانية"
                          className="h-12 text-base border-gray-300 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500"
                        />
                      </FormControl>
                      {/* ✅ IMPROVED FEEDBACK */}

                      <div className="text-sm">
                        {field.value === 0 ? (
                          <span className="text-green-600 font-medium">
                            ✓ دورة مجانية (السعر = 0 د.ع){" "}
                            {/* Changed from $0.00 */}
                          </span>
                        ) : (
                          <span className="text-blue-600 font-medium">
                            السعر: {Number(field.value).toLocaleString()} د.ع{" "}
                            {/* Changed from $ and added toLocaleString for thousands separator */}
                          </span>
                        )}
                      </div>
                      <FormMessage className="text-sm" />
                    </FormItem>
                  )}
                />
                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-bold text-gray-900">
                        5. وصف مختصر{" "}
                        <span className="text-gray-500 text-sm">(اختياري)</span>
                      </FormLabel>
                      <FormControl>
                        <textarea
                          {...field}
                          rows={4}
                          maxLength={DESC_MAX}
                          placeholder="اكتب وصفًا مختصرًا للدورة…"
                          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 resize-y min-h-[120px]"
                          aria-describedby="desc-help desc-count"
                        />
                      </FormControl>
                      <div className="flex items-center justify-between text-sm">
                        <span
                          id="desc-count"
                          className={`tabular-nums ${
                            desc.length > DESC_MAX - 10
                              ? "text-amber-600"
                              : "text-gray-400"
                          }`}
                        >
                          {desc.length}/{DESC_MAX}
                        </span>
                      </div>
                      <FormMessage className="text-sm" />
                    </FormItem>
                  )}
                />

                {/* Submit */}
              </fieldset>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-70"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  submitButtonLabel
                )}
              </Button>
            </form>
          </Form>
        </div>

        {/* Next steps */}
        <section className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
          <h3 className="text-lg font-bold text-blue-900 mb-3">
            ماذا بعد الإنشاء؟ 🎯
          </h3>
          <ul className="space-y-2 text-base text-blue-900/90">
            <li className="flex items-start gap-2">
              <span className="text-blue-700 mt-1">✓</span>
              <span>الانتقال تلقائيًا إلى لوحة تحكم الدورة</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-700 mt-1">✓</span>
              <span>إضافة الفيديوهات والملفات بسهولة</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-700 mt-1">✓</span>
              <span>إكمال بقية التفاصيل في أي وقت</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-700 mt-1">✓</span>
              <span>الحفظ التلقائي يضمن عدم فقدان التعديلات</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
