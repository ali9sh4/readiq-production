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
import { Sparkles, Zap, Clock } from "lucide-react";
import { Input } from "./ui/input";
import { QuickCourseSchema } from "@/validation/propertySchema";
import z from "zod";
type input = z.input<typeof QuickCourseSchema>;
type output = z.output<typeof QuickCourseSchema>;

type Props = {
  handleSubmit?: (data: output) => void;
  submitButtonLabel: React.ReactNode;
  defaultValues?: Partial<input>;
};

export default function QuickCourseForm({
  handleSubmit,
  submitButtonLabel,
  defaultValues,
}: Props) {
  const combinedDefaultValues: z.input<typeof QuickCourseSchema> = {
    ...{
      title: "",
      category: "",
      price: 0,
      description: "",
      level: "beginner",
    },
    ...defaultValues,
  };
  const form = useForm<z.input<typeof QuickCourseSchema>>({
    resolver: zodResolver(QuickCourseSchema),
    defaultValues: combinedDefaultValues,
  });
  const onSubmit: SubmitHandler<input> = (data) => {
    handleSubmit?.(QuickCourseSchema.parse(data)); // Output
  };

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50"
    >
      {/* Hero Section */}
      <div className="max-w-3xl mx-auto pt-12 px-6">
        {/* Quick Create Badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            <span>إنشاء سريع</span>
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            ابدأ دورتك في{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              30 ثانية
            </span>
          </h1>

          <p className="text-xl text-gray-600 mb-2">
            فقط 5 معلومات أساسية للبدء 🚀
          </p>

          <p className="text-gray-500 text-sm">
            يمكنك إضافة التفاصيل الأخرى لاحقاً من لوحة التحكم
          </p>
        </div>

        {/* Benefits Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <Clock className="w-5 h-5 text-blue-600 mb-2" />
            <p className="text-sm font-medium">سريع</p>
            <p className="text-xs text-gray-500">30 ثانية فقط</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <Sparkles className="w-5 h-5 text-green-600 mb-2" />
            <p className="text-sm font-medium">بسيط</p>
            <p className="text-xs text-gray-500">5 حقول فقط</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <Zap className="w-5 h-5 text-purple-600 mb-2" />
            <p className="text-sm font-medium">مرن</p>
            <p className="text-xs text-gray-500">أكمل لاحقاً</p>
          </div>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <fieldset disabled={form.formState.isSubmitting}>
                {/* 1. Course Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel className="text-sm font-semibold text-gray-800">
                        1. عنوان الدورة <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="مثال: تعلم البرمجة من الصفر"
                          className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 2 & 3. Category and Level - Same Row */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                  {/* 2. Category */}
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-800">
                          2. التصنيف <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ?? ""} // ✅ controlled
                            onValueChange={field.onChange}
                            dir="rtl"
                          >
                            <SelectTrigger className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500/20">
                              <SelectValue placeholder="اختر التصنيف" />
                            </SelectTrigger>
                            <SelectContent align="end">
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
                              <SelectItem value="health">
                                الصحة واللياقة
                              </SelectItem>
                              <SelectItem value="teaching">التدريس</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 3. Level */}
                  <FormField
                    control={form.control}
                    name="level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-800">
                          3. المستوى
                        </FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            dir="rtl"
                          >
                            <SelectTrigger className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500/20">
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

                {/* 4. Price */}
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel className="text-sm font-semibold text-gray-800">
                        4. السعر (دولار)
                        <span className="text-gray-400 text-xs mr-2">
                          يمكنك تغييره لاحقاً
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="0 للدورة المجانية"
                          className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500/20"
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            field.onChange(Number.isFinite(n) ? n : 0);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 5. Description (Optional) */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="mb-6">
                      <FormLabel className="text-sm font-semibold text-gray-800">
                        5. وصف مختصر
                        <span className="text-gray-400 text-xs mr-2">
                          (اختياري)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <textarea
                          {...field}
                          placeholder="اكتب وصف مختصر للدورة..."
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium transition-all"
                  disabled={form.formState.isSubmitting}
                >
                  {submitButtonLabel}
                </Button>
              </fieldset>
            </form>
          </Form>
        </div>

        {/* What's Next Section */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
          <h3 className="font-semibold text-blue-900 mb-3">
            ماذا بعد الإنشاء؟ 🎯
          </h3>
          <div className="space-y-2 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">✓</span>
              <span>ستنتقل إلى لوحة تحكم الدورة</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">✓</span>
              <span>يمكنك إضافة الفيديوهات والملفات</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">✓</span>
              <span>أكمل باقي التفاصيل في أي وقت</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">✓</span>
              <span>الحفظ التلقائي يحفظ كل تعديلاتك</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
