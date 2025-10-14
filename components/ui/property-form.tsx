"use client";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { CourseDataSchema } from "@/validation/propertySchema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "./input";
import MultiImageUploader, {
  MultipleImageUpload,
} from "../muti_image_uploader";

type Props = {
  handleSubmit?: (
    data: z.infer<typeof CourseDataSchema> & { id?: string }
  ) => void;
  submitButtonLabel: React.ReactNode;
  defaultValues?: z.infer<typeof CourseDataSchema>;
};

export default function CourseForm({
  handleSubmit,
  submitButtonLabel,
  defaultValues,
}: Props) {
  const combinedDefaultValues: z.infer<typeof CourseDataSchema> = {
    ...{
      title: "",
      subtitle: "",
      category: "",
      price: 0,
      description: "",
      level: "beginner",
      language: "arabic",
      duration: 0,
      learningPoints: ["", "", "", ""],
      requirements: ["", ""],
      images: [],
      files: [],
    },
    ...defaultValues,
  };
  const form = useForm<z.infer<typeof CourseDataSchema>>({
    resolver: zodResolver(CourseDataSchema),
    defaultValues: combinedDefaultValues,
  });

  return (
    <div
      dir="rtl"
      lang="ar"
      className="p-8 bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-100 text-right max-w-5xl mx-auto"
    >
      {defaultValues ? (
        <h1 className="text-2xl font-bold mb-4">تعديل الدورة</h1>
      ) : (
        <h1 className="text-2xl font-bold mb-4">إضافة دورة جديدة</h1>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit || (() => {}))}>
          <fieldset
            className="grid grid-cols-1 lg:grid-cols-3 gap-4"
            disabled={form.formState.isSubmitting}
          >
            {/* Course Status */}

            {/* Course Level */}
            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-800">
                    مستوى الدورة
                  </FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      dir="rtl"
                    >
                      <SelectTrigger className="h-11 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right bg-white hover:bg-gray-50 transition-colors">
                        <SelectValue placeholder="اختر مستوى الدورة" />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="beginner">مبتدئ</SelectItem>
                        <SelectItem value="intermediate">متوسط</SelectItem>
                        <SelectItem value="advanced">متقدم</SelectItem>
                        <SelectItem value="all_levels">
                          جميع المستويات
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-800">
                    التصنيف
                  </FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      dir="rtl"
                    >
                      <SelectTrigger className="h-11 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right bg-white hover:bg-gray-50 transition-colors">
                        <SelectValue placeholder="اختر تصنيف الدورة" />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="programming">البرمجة</SelectItem>
                        <SelectItem value="design">التصميم</SelectItem>
                        <SelectItem value="business">الأعمال</SelectItem>
                        <SelectItem value="marketing">التسويق</SelectItem>
                        <SelectItem value="photography">التصوير</SelectItem>
                        <SelectItem value="music">الموسيقى</SelectItem>
                        <SelectItem value="health">الصحة واللياقة</SelectItem>
                        <SelectItem value="teaching">التدريس</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Course Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="lg:col-span-2">
                  <FormLabel className="text-sm font-semibold text-gray-800">
                    عنوان الدورة
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="أدخل عنوان الدورة التدريبية"
                      className="h-11 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right bg-white hover:bg-gray-50 transition-colors"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Course Subtitle */}
            <FormField
              control={form.control}
              name="subtitle"
              render={({ field }) => (
                <FormItem className="lg:col-span-1">
                  <FormLabel className="text-sm font-semibold text-gray-800">
                    العنوان الفرعي
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="وصف مختصر للدورة"
                      className="h-11 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right bg-white hover:bg-gray-50 transition-colors"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Language */}
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-800">
                    لغة الدورة
                  </FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      dir="rtl"
                    >
                      <SelectTrigger className="h-11 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right bg-white hover:bg-gray-50 transition-colors">
                        <SelectValue placeholder="اختر لغة الدورة" />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="arabic">العربية</SelectItem>
                        <SelectItem value="english">الإنجليزية</SelectItem>
                        <SelectItem value="french">الفرنسية</SelectItem>
                        <SelectItem value="spanish">الإسبانية</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Price */}
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-800">
                    السعر (دولار)
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      placeholder="0"
                      className="h-11 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right bg-white hover:bg-gray-50 transition-colors"
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Duration */}
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-800">
                    المدة (ساعات)
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      placeholder="0"
                      className="h-11 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right bg-white hover:bg-gray-50 transition-colors"
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Course Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="lg:col-span-3">
                  <FormLabel className="text-sm font-semibold text-gray-800">
                    وصف الدورة
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="اكتب وصفاً تفصيلياً للدورة، ماذا سيتعلم الطلاب، والمهارات التي سيكتسبونها..."
                      className="h-12 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right bg-white hover:bg-gray-50 transition-colors"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* What You'll Learn Section */}
            <div className="lg:col-span-3">
              <h3 className="text-base font-semibold text-gray-800 mb-3">
                ما ستتعلمه في هذه الدورة
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <FormField
                    key={index}
                    control={form.control}
                    name={`learningPoints.${index}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={`النقطة التعليمية ${index + 1}`}
                            className="h-10 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right bg-white hover:bg-gray-50 transition-colors text-sm"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Course Requirements */}
            <div className="lg:col-span-3">
              <h3 className="text-base font-semibold text-gray-800 mb-3">
                متطلبات الدورة
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {[0, 1].map((index) => (
                  <FormField
                    key={index}
                    control={form.control}
                    name={`requirements.${index}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={`المتطلب ${index + 1}`}
                            className="h-10 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right bg-white hover:bg-gray-50 transition-colors text-sm"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="lg:col-span-3">
              <h3 className="text-base font-semibold text-gray-800 mb-3">
                صورة غلاف الدورة {/* Changed from "صور الدورة" */}
              </h3>
              <div className="mt-2">
                <FormField
                  control={form.control}
                  name="images"
                  render={({ field }) => (
                    <FormItem>
                      <FormDescription className="text-sm text-gray-600 mb-3">
                        📸 اختر صورة واحدة عالية الجودة لتكون غلاف الدورة (يُفضل
                        1280×720 بكسل)
                      </FormDescription>
                      <FormControl>
                        <MultiImageUploader
                          onImagesChange={(images: MultipleImageUpload[]) => {
                            form.setValue("images", images);
                          }}
                          images={field.value || []}
                          maxImages={1} // Limit to 1 image for cover
                          urlFormatter={(image) => {
                            if (!image.file) {
                              return `https://firebasestorage.googleapis.com/v0/b/readiq-1f109.firebasestorage.app/o/${encodeURIComponent(
                                image.url
                              )}?alt=media`;
                            }
                            return image.url;
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </fieldset>

          {/* Course Image Upload */}

          {/* Submit Button */}
          <div className="mt-8 flex justify-center pt-6 border-t border-gray-100 gap-4">
            <Button
              variant="outline"
              type="submit"
              className="px-6 py-2 h-10 hover:bg-gray-100 transition-colors mx-auto block"
              disabled={form.formState.isSubmitting}
            >
              {submitButtonLabel}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

/*
this this the code for the file upload section
 <FormField
                  control={form.control}
                  name="files" // or "images" - whatever your form field is called
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-gray-800">
                        تحميل الملفات للدوره
                      </FormLabel>
                      <FormControl>
                        <MultiFileUploader
                          files={field.value || []} // Pass current form value
                          onFilesChange={field.onChange} // Connect to form onChange
                          maxFiles={10}
                          maxFileSize={50 * 1024 * 1024} // 50MB
                          accept=".pdf,.txt,.jpg,.jpeg,.png,.webp"
                          disabled={field.disabled}
                        />
                      </FormControl>
                      <FormDescription>
                        يمكنك تحميل حتى 10 ملفات، بحد أقصى 50 ميجابايت لكل ملف
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
*/
