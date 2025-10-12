"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/context/authContext";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { storage } from "@/firebase/client";
import { ref, uploadBytesResumable, UploadTask } from "firebase/storage";

import {
  ChevronLeft,
  Save,
  Eye,
  Upload,
  Video,
  FileText,
  Clock,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Loader2,
  EyeOff,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateCourseBasicInfo,
  updateCoursePricing,
  publishCourse,
  unpublishCourse,
} from "@/app/actions/basic_info_actios";
import VideoUploader from "./video_uploader";
import SmartCourseUploader from "./fileUplaodtoR2";
import { ThumbnailUpdateSchema } from "@/validation/propertySchema";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { BasicInfoSchema, PricingSchema } from "@/validation/propertySchema";
import { Course } from "@/types/types";
import { toast } from "sonner";
import { SaveImages } from "@/app/course-upload/action";
import MultiImageUploader, { ImageUpload } from "./muti_image_uploader";
// Types

interface Props {
  defaultValues: Course; // ✅ Changed to receive full Course object
}

type CourseStatus = "draft" | "published" | "archived";

// ===== HELPERS =====
function StatusBadge({ status }: { status: CourseStatus }) {
  const config: Record<CourseStatus, { label: string; className: string }> = {
    draft: {
      label: "مسودة",
      className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    },
    published: {
      label: "منشور",
      className: "bg-green-100 text-green-800 border-green-200",
    },
    archived: {
      label: "مؤرشف",
      className: "bg-gray-100 text-gray-800 border-gray-200",
    },
  };

  const { label, className } = config[status] || config.draft;
  return (
    <Badge
      className={`rounded-full px-3 py-1 text-xs font-medium border ${className}`}
    >
      {label}
    </Badge>
  );
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "0 د";
  const mins = Math.floor(seconds / 60);
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours > 0) return `${hours} س ${remainingMins} د`;
  return `${mins} د`;
}

function getFirstImageUrl(course: Course): string {
  if (!course.images || course.images.length === 0) {
    return "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop";
  }
  const firstImage = course.images[0];
  if (typeof firstImage === "string" && firstImage.startsWith("http"))
    return firstImage;
  return "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop";
}

// ===== MAIN COMPONENT =====
export default function CourseDashboard({ defaultValues }: Props) {
  const router = useRouter();
  const auth = useAuth();

  // ✅ Initialize course state properly
  const [course, setCourse] = useState<Course>(defaultValues);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  // ✅ Initialize forms with proper default values
  const basicInfoForm = useForm<z.infer<typeof BasicInfoSchema>>({
    resolver: zodResolver(BasicInfoSchema),
    defaultValues: {
      title: defaultValues.title || "",
      subtitle: defaultValues.subtitle || "",
      description: defaultValues.description || "",
      category: defaultValues.category || "",
      level: (defaultValues.level as "beginner") || "beginner",
      language: (defaultValues.language as "arabic") || "arabic",
    },
  });
  const form = useForm<z.infer<typeof ThumbnailUpdateSchema>>({
    resolver: zodResolver(ThumbnailUpdateSchema),
    defaultValues: {
      image: course.thumbnailUrl
        ? {
            id: "1",
            url: course.thumbnailUrl,
          }
        : undefined,
    },
  });

  const pricingForm = useForm<z.infer<typeof PricingSchema>>({
    resolver: zodResolver(PricingSchema),
    defaultValues: {
      price: defaultValues.price || 0,
    },
  });

  // ✅ Update forms when defaultValues change (for refresh scenarios)
  useEffect(() => {
    basicInfoForm.reset({
      title: defaultValues.title || "",
      subtitle: defaultValues.subtitle || "",
      description: defaultValues.description || "",
      category: defaultValues.category || "",
      level: (defaultValues.level as "beginner") || "beginner",
      language: (defaultValues.language as "arabic") || "arabic",
    });
    pricingForm.reset({
      price: defaultValues.price || 0,
    });
    setCourse(defaultValues);
  }, [defaultValues]);

  const videos = course.videos || [];
  const files = course.files || [];
  const totalVideoDuration = videos.reduce(
    (sum, v) => sum + (v.duration || 0),
    0
  );
  const publishedVideosCount = videos.filter((v) => v.isPublished).length;
  const status = (course.status as CourseStatus) || "draft";
  const isPublished = status === "published";
  const canPublish = videos.length > 0 && !isPublished;
  const canUnpublish = isPublished;

  // ✅ Updated handler for Basic Info
  const onSubmitBasicInfo = async (data: z.infer<typeof BasicInfoSchema>) => {
    if (!auth?.user) {
      setError("يرجى تسجيل الدخول");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = await auth.user.getIdToken();
      setCourse((prev) => ({ ...prev, ...data }));
      toast.promise(updateCourseBasicInfo(course.id, data, token), {
        loading: "جاري الحفظ...",
        success: "تم الحفظ بنجاح",
        error: (err) => {
          // Rollback on error
          setCourse(defaultValues);
          return "فشل في الحفظ";
        },
      });
    } catch (err) {
      console.error("Error saving basic info:", err);
      setError("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Updated handler for Pricing
  const onSubmitPricing = async (data: z.infer<typeof PricingSchema>) => {
    if (!auth?.user) {
      setError("يرجى تسجيل الدخول");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = await auth.user.getIdToken();
      const result = await updateCoursePricing(course.id, data, token);

      if (result.success) {
        // ✅ Update local state with new price
        setCourse((prev) => ({
          ...prev,
          price: data.price,
        }));
        toast.success("تم الحفظ  السعر بنجاح");
      } else {
        setError(result.error || "فشل في الحفظ");
      }
    } catch (err) {
      console.error("Error saving pricing:", err);
      setError("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const onImageSubmit = async (data: z.infer<typeof ThumbnailUpdateSchema>) => {
    const token = await auth?.user?.getIdToken();

    if (!token) {
      toast.error("يرجى تسجيل الدخول");
      return;
    }

    // Check if image exists and has a file to upload
    if (!data.image || !data.image.file) {
      toast.error("يرجى اختيار صورة");
      return;
    }

    try {
      setUploadingThumbnail(true);

      // Upload single thumbnail image to Firebase Storage
      const path = `courses/${course.id}/thumbnail/${Date.now()}-${
        data.image.file.name
      }`;
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, data.image.file);

      // Wait for upload to complete
      await uploadTask;

      // Save image path to database (as array since SaveImages expects it)
      await SaveImages(
        {
          courseId: course.id,
          images: [path],
        },
        token
      );

      toast.success("تم حفظ صورة الغلاف بنجاح!");

      // Update local state with new thumbnail
      setCourse((prev) => ({
        ...prev,
        thumbnailUrl: path,
      }));

      // Optional: Refresh to show updated thumbnail
      router.refresh();
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      toast.error("حدث خطأ أثناء رفع الصورة");
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handlePublish = async () => {
    if (!auth?.user) {
      setError("يرجى تسجيل الدخول");
      return;
    }

    setPublishing(true);
    setError("");
    setSuccess("");

    try {
      const token = await auth.user.getIdToken();
      const result = await publishCourse(course.id, token);

      if (result.success) {
        setCourse((prev) => ({ ...prev, status: "published" }));
        toast.success("تم نشر الدوره بنجاح");
        router.refresh();
      } else {
        setError(result.error || "فشل في نشر الدورة");
      }
    } catch (err) {
      console.error("Error publishing course:", err);
      setError("حدث خطأ أثناء نشر الدورة");
    } finally {
      setPublishing(false);
    }
  };

  const handleUnPublish = async () => {
    if (!confirm("هل أنت متأكد من إلغاء نشر الدورة؟")) {
      return;
    }

    if (!auth?.user) {
      setError("يرجى تسجيل الدخول");
      return;
    }

    setUnPublishing(true);
    setError("");
    setSuccess("");

    try {
      const token = await auth.user.getIdToken();
      const result = await unpublishCourse(course.id, token);

      if (result.success) {
        setCourse((prev) => ({ ...prev, status: "draft" }));
        toast.success("تم الغاء نشر الدوره بنجاح");
        router.refresh();
      } else {
        setError(result.error || "فشل في إلغاء النشر");
      }
    } catch (err) {
      console.error("Error unpublishing course:", err);
      setError("حدث خطأ أثناء إلغاء النشر");
    } finally {
      setUnPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6" dir="rtl" lang="ar">
      <div className="mx-auto max-w-7xl">
        {/* BREADCRUMBS */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <a href="/course-upload" className="hover:text-gray-900">
            الدورات
          </a>
          <ChevronLeft className="h-4 w-4 rotate-180" />
          <span className="text-gray-900">{course.title}</span>
        </div>

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{course.title}</h1>
            <StatusBadge status={status} />
          </div>

          <div className="flex items-center gap-2">
            {canPublish && (
              <Button
                onClick={handlePublish}
                disabled={publishing || videos.length === 0}
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                نشر الدورة
              </Button>
            )}
            {canUnpublish && (
              <Button
                onClick={handleUnPublish}
                disabled={unpublishing}
                className="gap-2 bg-red-600 hover:bg-red-700 text-white"
              >
                {unpublishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
                إيقاف الدورة
              </Button>
            )}
          </div>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Video className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-right flex-1">
                  <p className="text-sm text-gray-600">الفيديوهات</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {videos.length}
                  </p>
                  <p className="text-xs text-gray-500">
                    {publishedVideosCount} منشور
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-right flex-1">
                  <p className="text-sm text-gray-600">الملفات</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {files.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <div className="text-right flex-1">
                  <p className="text-sm text-gray-600">مدة الدورة</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatDuration(totalVideoDuration)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-orange-600" />
                </div>
                <div className="text-right flex-1">
                  <p className="text-sm text-gray-600">السعر</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${course.price || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TABS */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl h-16 p-1.5 shadow-sm">
            <TabsTrigger
              value="overview"
              className="text-base font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200"
            >
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger
              value="content"
              className="text-base font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-green-700 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200"
            >
              المحتوى
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="text-base font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200"
            >
              الإعدادات
            </TabsTrigger>
          </TabsList>
          {/* OVERVIEW TAB */}

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {" "}
              {/* Basic Info Form - LEFT COLUMN */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-right">
                    المعلومات الأساسية
                  </CardTitle>
                  <CardDescription className="text-right">
                    تحديث تفاصيل الدورة الرئيسية
                  </CardDescription>
                </CardHeader>
                <CardContent dir="rtl">
                  <Form {...basicInfoForm}>
                    <form
                      onSubmit={basicInfoForm.handleSubmit(onSubmitBasicInfo)}
                      className="space-y-4"
                    >
                      {/* Title and Subtitle */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={basicInfoForm.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-right block">
                                العنوان *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="عنوان الدورة"
                                  className="text-right"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={basicInfoForm.control}
                          name="subtitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-right block">
                                العنوان الفرعي
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="وصف قصير"
                                  className="text-right"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Description */}
                      <FormField
                        control={basicInfoForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-right block">
                              الوصف
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="وصف تفصيلي للدورة"
                                rows={4}
                                className="resize-none text-right"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Category, Level, Language */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FormField
                          control={basicInfoForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-right block">
                                التصنيف
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="مثال: البرمجة"
                                  className="text-right"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={basicInfoForm.control}
                          name="level"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-right block">
                                المستوى
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="text-right">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="beginner">
                                    مبتدئ
                                  </SelectItem>
                                  <SelectItem value="intermediate">
                                    متوسط
                                  </SelectItem>
                                  <SelectItem value="advanced">
                                    متقدم
                                  </SelectItem>
                                  <SelectItem value="all_levels">
                                    جميع المستويات
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={basicInfoForm.control}
                          name="language"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-right block">
                                اللغة
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="text-right">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="arabic">
                                    العربية
                                  </SelectItem>
                                  <SelectItem value="english">
                                    English
                                  </SelectItem>
                                  <SelectItem value="french">
                                    Français
                                  </SelectItem>
                                  <SelectItem value="spanish">
                                    Español
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Submit Button for Basic Info */}
                      <Button
                        type="submit"
                        disabled={basicInfoForm.formState.isSubmitting}
                        className="w-full gap-2"
                      >
                        {basicInfoForm.formState.isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        حفظ المعلومات الأساسية
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
              {/* RIGHT COLUMN - Pricing and Thumbnail */}
              <div>
                {/* Pricing Form */}
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-right">التسعير</CardTitle>
                    <CardDescription className="text-right">
                      تحديد سعر الدورة
                    </CardDescription>
                  </CardHeader>
                  <CardContent dir="rtl">
                    <Form {...pricingForm}>
                      <form
                        onSubmit={pricingForm.handleSubmit(onSubmitPricing)}
                        className="space-y-4"
                      >
                        <FormField
                          control={pricingForm.control}
                          name="price"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-right block">
                                السعر (دولار) *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  placeholder="0.00"
                                  className="text-right"
                                  onChange={(e) =>
                                    field.onChange(
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          disabled={pricingForm.formState.isSubmitting}
                          className="w-full gap-2"
                        >
                          {pricingForm.formState.isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          حفظ السعر
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-right">صورة الغلاف</CardTitle>
                <CardDescription className="text-right">
                  تحميل صورة غلاف الدورة
                </CardDescription>
              </CardHeader>
              <CardContent dir="rtl">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onImageSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="image"
                      render={({ field }) => (
                        <FormItem>
                          <FormDescription className="text-sm text-gray-600 mb-3">
                            📸 اختر صورة واحدة عالية الجودة لتكون غلاف الدورة
                            (يُفضل 1280×720 بكسل)
                          </FormDescription>
                          <FormControl>
                            <MultiImageUploader
                              onImagesChange={(images: ImageUpload[]) => {
                                const singleImage =
                                  images.length > 0 ? images[0] : undefined;
                                field.onChange(singleImage);
                              }}
                              images={field.value ? [field.value] : []}
                              maxImages={1}
                              urlFormatter={(image) => {
                                if (!image.file && image.url) {
                                  if (!image.url.startsWith("http")) {
                                    return `https://firebasestorage.googleapis.com/v0/b/readiq-1f109.firebasestorage.app/o/${encodeURIComponent(
                                      image.url
                                    )}?alt=media`;
                                  }
                                  return image.url;
                                }
                                return image.url;
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={uploadingThumbnail}
                      className="w-full gap-2"
                    >
                      {uploadingThumbnail ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      حفظ صورة الغلاف
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            {/* End space-y-6 wrapper */}
          </TabsContent>
          {/* CONTENT TAB */}
          <TabsContent value="content" className="space-y-6">
            <VideoUploader courseId={course.id} />
            <SmartCourseUploader id={course.id} />
          </TabsContent>
          {/* SETTINGS TAB */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="text-right">إعدادات الدورة</CardTitle>
                <CardDescription className="text-right">
                  إعدادات متقدمة للدورة
                </CardDescription>
              </CardHeader>
              <CardContent dir="rtl">
                <p className="text-gray-500 text-right">قريباً...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
