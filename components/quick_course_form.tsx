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
import { Sparkles, Clock, Loader2, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import z from "zod";
import { QuickCourseSchema } from "@/validation/courseSchema";

type InputT = z.input<typeof QuickCourseSchema>;
type OutputT = z.output<typeof QuickCourseSchema>;

type Props = {
  handleSubmit?: (data: OutputT) => Promise<void>;
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
      category: "",
      level: "all_levels", // ✅ Changed from undefined to default value
      price: 0,
      description: "",
    },
  });

  const onSubmit: SubmitHandler<InputT> = async (data) => {
    try {
      await handleSubmit?.(QuickCourseSchema.parse(data));
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  const desc = form.watch("description") ?? "";
  const DESC_MAX = 180;

  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12 sm:pb-16">
        <header className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-100 text-blue-700 px-4 py-2 text-sm sm:text-base font-semibold mb-4">
            <BookOpen className="size-4 sm:size-5" />
            <span>إنشاء دورة جديدة</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
            أبدأ دورتك في دقائق
          </h1>

          <p className="text-base sm:text-lg text-gray-600 mb-2">
            املأ المعلومات الأساسية للبدء
          </p>
          <p className="text-sm sm:text-base text-gray-500">
            يمكنك إضافة المزيد من التفاصيل لاحقًا
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border-2 border-blue-100 text-center">
            <Clock className="size-6 text-blue-600 mx-auto mb-2" />
            <p className="font-semibold text-gray-900">سريع</p>
            <p className="text-sm text-gray-600">5 دقائق فقط</p>
          </div>
          <div className="bg-white p-4 rounded-xl border-2 border-green-100 text-center">
            <Sparkles className="size-6 text-green-600 mx-auto mb-2" />
            <p className="font-semibold text-gray-900">بسيط</p>
            <p className="text-sm text-gray-600">معلومات أساسية</p>
          </div>
          <div className="bg-white p-4 rounded-xl border-2 border-purple-100 text-center">
            <BookOpen className="size-6 text-purple-600 mx-auto mb-2" />
            <p className="font-semibold text-gray-900">مرن</p>
            <p className="text-sm text-gray-600">أكمل لاحقًا</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg p-6 sm:p-8">
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
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-bold text-gray-900 flex items-center gap-1">
                        عنوان الدورة
                        <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="off"
                          placeholder="مثال: تعلم البرمجة من الصفر"
                          className="h-12 text-base border-2 border-gray-200 focus-visible:border-blue-500 focus-visible:ring-0"
                          aria-required
                        />
                      </FormControl>
                      <p className="text-sm text-gray-500">
                        {field.value.length > 0
                          ? `${field.value.length} حرف`
                          : "أدخل عنوانًا واضحًا  (10 أحرف على الأقل)"}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-bold text-gray-900 flex items-center gap-1">
                          التصنيف
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            dir="rtl"
                          >
                            <SelectTrigger className="h-12 text-base border-2 border-gray-200 focus:ring-0 focus:border-blue-500">
                              <SelectValue placeholder="اختر التصنيف" />
                            </SelectTrigger>
                            <SelectContent
                              align="end"
                              className="max-h-[300px]"
                            >
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-bold text-gray-900">
                          المستوى
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            dir="rtl"
                          >
                            <SelectTrigger className="h-12 text-base border-2 border-gray-200 focus:ring-0 focus:border-blue-500">
                              <SelectValue placeholder="اختر المستوى" />
                            </SelectTrigger>
                            <SelectContent align="end">
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-bold text-gray-900">
                        السعر (دينار عراقي)
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
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
                            placeholder="0"
                            className="h-12 text-base border-2 border-gray-200 focus-visible:border-blue-500 focus-visible:ring-0 pl-16"
                          />
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                            د.ع
                          </div>
                        </div>
                      </FormControl>
                      <div className="flex items-center gap-2">
                        {field.value === 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm text-green-700 bg-green-50 px-3 py-1 rounded-full font-medium">
                            <span className="text-lg">✓</span>
                            دورة مجانية
                          </span>
                        ) : (
                          <span className="text-sm text-blue-700 bg-blue-50 px-3 py-1 rounded-full font-medium">
                            {Number(field.value).toLocaleString("en-US")} د.ع
                          </span>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-bold text-gray-900">
                        وصف مختصر
                        <span className="text-gray-500 font-normal mr-2 text-sm">
                          (اختياري)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <textarea
                          {...field}
                          rows={4}
                          maxLength={DESC_MAX}
                          placeholder="اكتب وصفًا مختصرًا للدورة..."
                          className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 text-base focus-visible:outline-none focus-visible:border-blue-500 resize-none"
                        />
                      </FormControl>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">
                          {desc.length === 0
                            ? "أضف وصفًا قصيرًا يشرح محتوى الدورة"
                            : ""}
                        </span>
                        <span
                          className={`font-mono ${
                            desc.length > DESC_MAX - 20
                              ? "text-orange-600 font-semibold"
                              : "text-gray-400"
                          }`}
                        >
                          {desc.length}/{DESC_MAX}
                        </span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </fieldset>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
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

        <div className="mt-8 bg-blue-50 rounded-2xl border-2 border-blue-200 p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
            <span>🎯</span>
            الخطوات التالية
          </h3>
          <ul className="space-y-2 text-blue-900">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold mt-0.5">1.</span>
              <span>الانتقال تلقائيًا إلى لوحة تحكم الدورة</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold mt-0.5">2.</span>
              <span>إضافة الفيديوهات والمحتوى التعليمي</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold mt-0.5">3.</span>
              <span>إكمال التفاصيل المتبقية</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold mt-0.5">4.</span>
              <span>نشر الدورة ومشاركتها مع الطلاب</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
