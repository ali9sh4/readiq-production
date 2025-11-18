"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/authContext";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { storage } from "@/firebase/client";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import {
  Save,
  Upload,
  FileText,
  Clock,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Loader2,
  EyeOff,
  XCircle,
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
} from "@/app/actions/basic_info_actions";
import VideoUploader from "./video_uploader";
import SmartCourseUploader from "./fileUplaodtoR2";
import {
  ThumbnailUpdateSchema,
  BasicInfoSchema,
  PricingSchema,
} from "@/validation/propertySchema";
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
import { Course } from "@/types/types";
import { toast } from "sonner";

import ThumbNailUploader from "./thumb_nail_uploder";
import { DeleteThumbnail, SaveThumbnail } from "@/app/course-upload/action";

interface Props {
  defaultValues: Course;
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

// ===== MAIN COMPONENT =====
export default function CourseDashboard({ defaultValues }: Props) {
  const router = useRouter();
  const auth = useAuth();

  const [course, setCourse] = useState<Course>(defaultValues);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [deletingThumbnail, setDeletingThumbnail] = useState(false);
  const isAnyActionRunning =
    saving ||
    publishing ||
    unpublishing ||
    uploadingThumbnail ||
    deletingThumbnail;

  const basicInfoForm = useForm<z.infer<typeof BasicInfoSchema>>({
    resolver: zodResolver(BasicInfoSchema),
    defaultValues: {
      title: defaultValues.title || "",
      subtitle: defaultValues.subtitle || "",
      description: defaultValues.description || "",
      category: defaultValues.category || "",
      instructorName:
        defaultValues.instructorName || auth?.user?.displayName || "",
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
      salePrice: defaultValues.salePrice || undefined,
    },
  });

  useEffect(() => {
    basicInfoForm.reset({
      title: defaultValues.title || "",
      subtitle: defaultValues.subtitle || "",
      description: defaultValues.description || "",
      category: defaultValues.category || "",
      instructorName:
        defaultValues.instructorName || auth?.user?.displayName || "",
      level:
        (defaultValues.level as "beginner" | "intermediate" | "advanced") ||
        "beginner",
      language: (defaultValues.language as "arabic") || "arabic",
    });
    pricingForm.reset({
      price: defaultValues.price || 0,
      salePrice: defaultValues.salePrice || undefined,
    });
    setCourse(defaultValues);
    form.reset({
      image: defaultValues.thumbnailUrl
        ? {
            id: "existing-thumbnail",
            url: defaultValues.thumbnailUrl,
            isExisting: true,
          }
        : undefined,
    });
  }, [defaultValues]);

  const videos = course.videos || [];
  const files = course.files || [];
  const totalVideoDuration = videos.reduce(
    (sum, v) => sum + (v.duration || 0),
    0
  );
  const status = (course.status as CourseStatus) || "draft";
  const isPublished = status === "published";
  const canPublish = videos.length > 0 && !isPublished;
  const canUnpublish = isPublished;

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
      toast.promise(updateCourseBasicInfo(course.id, data, token), {
        loading: "جاري الحفظ...",
        success: "تم الحفظ بنجاح",
        error: (err) => {
          console.error(err);
          setCourse(defaultValues);
          return "فشل في الحفظ";
        },
      });
      setCourse((prev) => ({ ...prev, ...data }));
    } catch (err) {
      console.error("Error saving basic info:", err);
      setError("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

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
        setCourse((prev) => ({
          ...prev,
          price: data.price,
          salePrice: data.salePrice,
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

    if (!data.image || !data.image.file) {
      toast.error("يرجى اختيار صورة");
      return;
    }

    try {
      setUploadingThumbnail(true);

      const path = `courses/${course.id}/thumbnail/${Date.now()}-${
        data.image.file.name
      }`;
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, data.image.file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on("state_changed", null, reject, () => resolve());
      });

      const downloadURL = await getDownloadURL(storageRef);

      const result = await SaveThumbnail(
        {
          courseId: course.id,
          thumbnailUrl: downloadURL,
        },
        token
      );

      if (result.success) {
        setCourse((prev) => ({
          ...prev,
          thumbnailUrl: downloadURL,
        }));

        toast.success("تم حفظ صورة الغلاف بنجاح!");
        await new Promise((resolve) => setTimeout(resolve, 100));

        router.refresh();
      } else {
        toast.error("فشل في حفظ الصورة");
      }
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      toast.error("حدث خطأ أثناء رفع الصورة");
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleDeleteThumbnail = async () => {
    const token = await auth?.user?.getIdToken();
    if (!token || !course.thumbnailUrl) {
      toast.error("لا توجد صورة لحذفها");
      return;
    }

    if (
      !confirm(
        "⚠️ هل أنت متأكد من حذف صورة الغلاف؟\nلا يمكن التراجع عن هذا الإجراء."
      )
    ) {
      return;
    }

    try {
      setDeletingThumbnail(true);
      const result = await DeleteThumbnail(course.id, token);

      if (result.success) {
        toast.success("تم حذف صورة الغلاف بنجاح!");
        await new Promise((resolve) => setTimeout(resolve, 100));
        router.refresh();
      } else {
        toast.error(result.message || "فشل في حذف صورة الغلاف");
      }
    } catch (error) {
      console.error("Error deleting thumbnail:", error);
      toast.error("حدث خطأ أثناء حذف الصورة");
    } finally {
      setDeletingThumbnail(false);
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
    <div
      className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto max-w-7xl">
        {/* ===== RESPONSIVE HEADER ===== */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Title Section - Always full width */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            {/* Title + Badge */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 truncate">
                {course.title}
              </h1>
              <StatusBadge status={status} />
            </div>

            {/* Action Buttons - Stack on mobile */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {canPublish && (
                <Button
                  onClick={handlePublish}
                  disabled={publishing || videos.length === 0}
                  className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      <span className="hidden xs:inline">جاري النشر...</span>
                      <span className="xs:hidden">نشر...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                      نشر الدورة
                    </>
                  )}
                </Button>
              )}

              {canUnpublish && (
                <Button
                  onClick={handleUnPublish}
                  disabled={unpublishing}
                  variant="destructive"
                  className="gap-2 shadow-md hover:shadow-lg transition-all h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto"
                >
                  {unpublishing ? (
                    <>
                      <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      <span className="hidden xs:inline">جاري الإيقاف...</span>
                      <span className="xs:hidden">إيقاف...</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                      إيقاف الدورة
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Rejection Reason - Responsive padding and text */}
          {course.rejectionReason && (
            <div className="bg-gradient-to-r from-red-50 to-rose-50 border-r-4 border-red-500 rounded-lg p-3 sm:p-4 md:p-5 shadow-sm">
              <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2 text-base sm:text-lg">
                <div className="bg-red-100 p-1 sm:p-1.5 rounded-lg flex-shrink-0">
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                </div>
                سبب رفض الدورة
              </h4>
              <p className="text-red-800 leading-relaxed text-sm sm:text-base">
                {course.rejectionReason}
              </p>
              <p className="text-red-600 text-xs sm:text-sm mt-2 sm:mt-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full flex-shrink-0"></span>
                يرجى تعديل الدورة وإعادة تقديمها للمراجعة
              </p>
            </div>
          )}

          {/* Warning if can't publish */}
          {canPublish && videos.length === 0 && (
            <div className="bg-yellow-50 border-r-4 border-yellow-500 rounded-lg p-3 sm:p-4 shadow-sm">
              <p className="text-yellow-800 flex items-center gap-2 text-sm sm:text-base">
                <div className="bg-yellow-100 p-1 rounded-lg flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                </div>
                <span className="font-medium">
                  يجب إضافة فيديو واحد على الأقل قبل النشر
                </span>
              </p>
            </div>
          )}
        </div>

        {/* ===== RESPONSIVE ALERTS ===== */}
        {error && (
          <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 sm:gap-3">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-xs sm:text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 sm:gap-3">
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-700 text-xs sm:text-sm">{success}</p>
          </div>
        )}

        {/* ===== RESPONSIVE KPI CARDS ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                  <FileText className="h-4 w-4 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <div className="text-right flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    الملفات
                  </p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                    {files.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
                  <Clock className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600" />
                </div>
                <div className="text-right flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    مدة الدورة
                  </p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                    {formatDuration(totalVideoDuration)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-2 lg:col-span-1">
            <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-orange-100 rounded-lg">
                  <DollarSign className="h-4 w-4 sm:h-6 sm:w-6 text-orange-600" />
                </div>
                <div className="text-right flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    السعر
                  </p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 truncate">
                    {course.price || 0} د.ع
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== RESPONSIVE TABS ===== */}
        <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl h-12 sm:h-14 md:h-16 p-1 sm:p-1.5 shadow-sm">
            <TabsTrigger
              value="overview"
              className="text-sm sm:text-base font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200"
            >
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger
              value="content"
              className="text-sm sm:text-base font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-green-700 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200"
            >
              المحتوى
            </TabsTrigger>
          </TabsList>

          {/* ===== OVERVIEW TAB - RESPONSIVE ===== */}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
              {/* Basic Info Form - Full width on mobile, 2/3 on xl */}
              <Card className="xl:col-span-2">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-right text-lg sm:text-xl">
                    المعلومات الأساسية
                  </CardTitle>
                  <CardDescription className="text-right text-xs sm:text-sm">
                    تحديث تفاصيل الدورة الرئيسية
                  </CardDescription>
                </CardHeader>
                <CardContent dir="rtl" className="p-4 sm:p-6 pt-0">
                  <Form {...basicInfoForm}>
                    <form
                      onSubmit={basicInfoForm.handleSubmit(onSubmitBasicInfo)}
                      className="space-y-3 sm:space-y-4"
                    >
                      {/* Title and Subtitle - Stack on mobile */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        <FormField
                          control={basicInfoForm.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-right block text-sm sm:text-base">
                                العنوان *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="عنوان الدورة"
                                  className="text-right h-10 sm:h-11 text-sm sm:text-base"
                                />
                              </FormControl>
                              <FormMessage className="text-xs sm:text-sm" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={basicInfoForm.control}
                          name="subtitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-right block text-sm sm:text-base">
                                العنوان الفرعي
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="وصف قصير"
                                  className="text-right h-10 sm:h-11 text-sm sm:text-base"
                                />
                              </FormControl>
                              <FormMessage className="text-xs sm:text-sm" />
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
                            <FormLabel className="text-right block text-sm sm:text-base">
                              الوصف
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="وصف تفصيلي للدورة"
                                rows={4}
                                className="resize-none text-right text-sm sm:text-base"
                              />
                            </FormControl>
                            <FormMessage className="text-xs sm:text-sm" />
                          </FormItem>
                        )}
                      />

                      {/* Instructor Name */}
                      <FormField
                        control={basicInfoForm.control}
                        name="instructorName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-right text-sm sm:text-base">
                              اسم المحاضر
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                rows={1}
                                className="resize-none text-right text-sm sm:text-base"
                              />
                            </FormControl>
                            <FormMessage className="text-xs sm:text-sm" />
                          </FormItem>
                        )}
                      />

                      {/* Category, Level, Language - Stack on mobile, 2 cols on tablet */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        <FormField
                          control={basicInfoForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-right block text-sm sm:text-base">
                                التصنيف
                              </FormLabel>
                              <Select
                                value={field.value ?? ""}
                                onValueChange={field.onChange}
                                dir="rtl"
                              >
                                <FormControl>
                                  <SelectTrigger className="text-right h-10 sm:h-11 text-sm sm:text-base">
                                    <SelectValue placeholder="اختر التصنيف" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent
                                  align="end"
                                  className="text-sm sm:text-base"
                                >
                                  <SelectItem value="programming">
                                    البرمجة
                                  </SelectItem>
                                  <SelectItem value="design">
                                    التصميم
                                  </SelectItem>
                                  <SelectItem value="business">
                                    الأعمال
                                  </SelectItem>
                                  <SelectItem value="marketing">
                                    التسويق
                                  </SelectItem>
                                  <SelectItem value="photography">
                                    التصوير
                                  </SelectItem>
                                  <SelectItem value="music">
                                    الموسيقى
                                  </SelectItem>
                                  <SelectItem value="health_fitness">
                                    الصحة واللياقة
                                  </SelectItem>
                                  <SelectItem value="medicine">
                                    الطب والصحة
                                  </SelectItem>
                                  <SelectItem value="teaching">
                                    التعليم والتدريس
                                  </SelectItem>
                                  <SelectItem value="languages">
                                    اللغات
                                  </SelectItem>
                                  <SelectItem value="personal_development">
                                    التنمية الذاتية
                                  </SelectItem>
                                  <SelectItem value="science">
                                    العلوم
                                  </SelectItem>
                                  <SelectItem value="technology">
                                    التقنية
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-xs sm:text-sm" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={basicInfoForm.control}
                          name="level"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-right block text-sm sm:text-base">
                                المستوى
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="text-right h-10 sm:h-11 text-sm sm:text-base">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="text-sm sm:text-base">
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
                              <FormMessage className="text-xs sm:text-sm" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={basicInfoForm.control}
                          name="language"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2 lg:col-span-1">
                              <FormLabel className="text-right block text-sm sm:text-base">
                                اللغة
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="text-right h-10 sm:h-11 text-sm sm:text-base">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="text-sm sm:text-base">
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
                              <FormMessage className="text-xs sm:text-sm" />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        disabled={basicInfoForm.formState.isSubmitting}
                        className="w-full gap-2 h-10 sm:h-11 text-sm sm:text-base"
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

              {/* RIGHT COLUMN - Pricing - Full width on mobile */}
              <div className="space-y-4 sm:space-y-6">
                {/* Pricing Form */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-right text-lg sm:text-xl">
                      التسعير
                    </CardTitle>
                    <CardDescription className="text-right text-xs sm:text-sm">
                      تحديد سعر الدورة
                    </CardDescription>
                  </CardHeader>
                  <CardContent dir="rtl" className="p-4 sm:p-6 pt-0">
                    <Form {...pricingForm}>
                      <form
                        onSubmit={pricingForm.handleSubmit(onSubmitPricing)}
                        className="space-y-3 sm:space-y-4"
                      >
                        <FormField
                          control={pricingForm.control}
                          name="price"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-right block text-sm sm:text-base">
                                السعر (دينار) *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    field.value === 0 ? "" : String(field.value)
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;

                                    if (val === "") {
                                      field.onChange(0);
                                      return;
                                    }

                                    if (/^\d*\.?\d{0,2}$/.test(val)) {
                                      const numVal = parseFloat(val);
                                      field.onChange(
                                        isNaN(numVal) ? 0 : numVal
                                      );
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value;

                                    if (val === "") {
                                      field.onChange(0);
                                      return;
                                    }

                                    const numValue = parseFloat(val);

                                    if (isNaN(numValue) || numValue < 0) {
                                      field.onChange(0);
                                      return;
                                    }

                                    field.onChange(
                                      Math.round(numValue * 100) / 100
                                    );
                                  }}
                                  placeholder="اتركه فارغًا للدورة المجانية"
                                  className="h-10 sm:h-12 text-sm sm:text-base border-gray-300 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 text-right"
                                />
                              </FormControl>
                              <div className="text-xs sm:text-sm">
                                {field.value === 0 ? (
                                  <span className="text-green-600 font-medium">
                                    ✓ دورة مجانية (السعر = 0 د.ع)
                                  </span>
                                ) : (
                                  <span className="text-blue-600 font-medium">
                                    السعر:{" "}
                                    {Number(field.value).toLocaleString()} د.ع
                                  </span>
                                )}
                              </div>
                              <FormMessage className="text-xs sm:text-sm" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={pricingForm.control}
                          name="salePrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-right block text-sm sm:text-base">
                                السعر المخفض (اختياري)
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    field.value === undefined ||
                                    field.value === 0
                                      ? ""
                                      : String(field.value)
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;

                                    if (val === "") {
                                      field.onChange(0);
                                      return;
                                    }

                                    if (/^\d*\.?\d{0,2}$/.test(val)) {
                                      const numVal = parseFloat(val);
                                      field.onChange(
                                        isNaN(numVal) ? 0 : numVal
                                      );
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value;

                                    if (val === "") {
                                      field.onChange(0);
                                      return;
                                    }

                                    const numValue = parseFloat(val);

                                    if (isNaN(numValue) || numValue < 0) {
                                      field.onChange(0);
                                      return;
                                    }
                                    if (numValue === 0) {
                                      field.onChange(undefined);
                                      return;
                                    }

                                    field.onChange(
                                      Math.round(numValue * 100) / 100
                                    );
                                  }}
                                  placeholder="اتركه فارغًا إذا لم يكن هناك خصم"
                                  className="h-10 sm:h-12 text-sm sm:text-base border-gray-300 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 text-right"
                                />
                              </FormControl>

                              <div className="text-xs sm:text-sm">
                                {!field.value ? (
                                  <span className="text-gray-500">
                                    لا يوجد خصم
                                  </span>
                                ) : (
                                  <span className="text-orange-600 font-medium">
                                    السعر المخفض:{" "}
                                    {Number(field.value).toLocaleString()} د.ع
                                  </span>
                                )}
                              </div>
                              <FormMessage className="text-xs sm:text-sm" />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          disabled={pricingForm.formState.isSubmitting}
                          className="w-full gap-2 h-10 sm:h-11 text-sm sm:text-base"
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

            {/* Thumbnail Section - Full width */}
            <Card>
              <CardHeader className="text-right space-y-1 p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800">
                  🖼️ صورة الغلاف
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm md:text-base text-gray-500">
                  قم بتحميل صورة جذابة لتكون غلاف الدورة التعليمية
                </CardDescription>
              </CardHeader>
              <CardContent dir="rtl" className="p-4 sm:p-6 pt-0">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onImageSubmit)}
                    className="space-y-3 sm:space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="image"
                      render={({ field }) => (
                        <FormItem>
                          <FormDescription className="text-xs sm:text-sm md:text-base text-gray-600 mt-2 sm:mt-3 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg p-3 sm:p-4">
                            📸 اختر{" "}
                            <span className="font-medium text-gray-800">
                              صورة واحدة عالية الجودة
                            </span>{" "}
                            لتكون غلاف الدورة
                            <br />
                            <span className="text-xs text-gray-500">
                              (يُفضل 1280×720 بكسل)
                            </span>
                          </FormDescription>
                          <FormControl>
                            <ThumbNailUploader
                              onImageChange={(image) => field.onChange(image)}
                              image={field.value}
                              onDelete={handleDeleteThumbnail}
                              isDeleting={deletingThumbnail}
                            />
                          </FormControl>
                          <FormMessage className="text-xs sm:text-sm" />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={uploadingThumbnail}
                      className="w-full gap-2 h-10 sm:h-11 text-sm sm:text-base"
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
          </TabsContent>

          {/* ===== CONTENT TAB - RESPONSIVE ===== */}
          <TabsContent value="content" className="space-y-4 sm:space-y-6">
            <VideoUploader courseId={course.id} disabled={isAnyActionRunning} />
            <SmartCourseUploader id={course.id} disabled={isAnyActionRunning} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
