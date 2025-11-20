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
  Image as ImageIcon,
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
      className: "bg-yellow-50 text-yellow-700 border-2 border-yellow-200",
    },
    published: {
      label: "منشور",
      className: "bg-green-50 text-green-700 border-2 border-green-200",
    },
    archived: {
      label: "مؤرشف",
      className: "bg-gray-100 text-gray-700 border-2 border-gray-200",
    },
  };

  const { label, className } = config[status] || config.draft;
  return (
    <Badge
      className={`rounded-full px-4 py-1.5 text-sm font-semibold ${className}`}
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
        toast.success("تم حفظ السعر بنجاح");
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
        toast.success("تم نشر الدورة بنجاح");
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
        toast.success("تم إلغاء نشر الدورة بنجاح");
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
      className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto max-w-7xl">
        {/* ===== HEADER ===== */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                {course.title}
              </h1>
              <StatusBadge status={status} />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {canPublish && (
                <Button
                  onClick={handlePublish}
                  disabled={publishing || videos.length === 0}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white h-12 px-6 font-semibold"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      جاري النشر...
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
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
                  className="gap-2 h-12 px-6 font-semibold"
                >
                  {unpublishing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      جاري الإيقاف...
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-5 w-5" />
                      إيقاف الدورة
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Rejection Reason */}
          {course.rejectionReason && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="bg-red-100 p-2 rounded-lg flex-shrink-0">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-red-900 mb-2 text-lg">
                    سبب رفض الدورة
                  </h4>
                  <p className="text-red-800 leading-relaxed">
                    {course.rejectionReason}
                  </p>
                  <p className="text-red-600 text-sm mt-3">
                    يرجى تعديل الدورة وإعادة تقديمها للمراجعة
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warning */}
          {canPublish && videos.length === 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="bg-yellow-100 p-2 rounded-lg flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                </div>
                <p className="text-yellow-800 font-medium">
                  يجب إضافة فيديو واحد على الأقل قبل النشر
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ===== ALERTS ===== */}
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-green-700">{success}</p>
            </div>
          </div>
        )}

        {/* ===== STATS CARDS ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Card className="border-2 border-gray-200">
            <CardContent className="pt-6 p-5">
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 p-3 rounded-xl">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">الملفات</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {files.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-200">
            <CardContent className="pt-6 p-5">
              <div className="flex items-center gap-4">
                <div className="bg-purple-100 p-3 rounded-xl">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">مدة الدورة</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatDuration(totalVideoDuration)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-2 lg:col-span-1 border-2 border-gray-200">
            <CardContent className="pt-6 p-5">
              <div className="flex items-center gap-4">
                <div className="bg-green-100 p-3 rounded-xl">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">السعر</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {course.price || 0} د.ع
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== TABS ===== */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-white border-2 border-gray-200 rounded-xl h-14 p-1.5">
            <TabsTrigger
              value="overview"
              className="text-base font-semibold rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger
              value="content"
              className="text-base font-semibold rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              المحتوى
            </TabsTrigger>
          </TabsList>

          {/* ===== OVERVIEW TAB ===== */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Basic Info */}
              <Card className="lg:col-span-2 border-2 border-gray-200">
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl">المعلومات الأساسية</CardTitle>
                  <CardDescription>
                    تحديث تفاصيل الدورة الرئيسية
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...basicInfoForm}>
                    <form
                      onSubmit={basicInfoForm.handleSubmit(onSubmitBasicInfo)}
                      className="space-y-5"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField
                          control={basicInfoForm.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold">
                                العنوان *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="عنوان الدورة"
                                  className="h-12 border-2 border-gray-200 focus-visible:border-blue-500 focus-visible:ring-0"
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
                              <FormLabel className="text-base font-semibold">
                                العنوان الفرعي
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="وصف قصير"
                                  className="h-12 border-2 border-gray-200 focus-visible:border-blue-500 focus-visible:ring-0"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={basicInfoForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold">
                              الوصف
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="وصف تفصيلي للدورة"
                                rows={4}
                                className="resize-none border-2 border-gray-200 focus-visible:border-blue-500 focus-visible:ring-0"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={basicInfoForm.control}
                        name="instructorName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold">
                              اسم المحاضر
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="h-12 border-2 border-gray-200 focus-visible:border-blue-500 focus-visible:ring-0"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <FormField
                          control={basicInfoForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold">
                                التصنيف
                              </FormLabel>
                              <Select
                                value={field.value ?? ""}
                                onValueChange={field.onChange}
                                dir="rtl"
                              >
                                <FormControl>
                                  <SelectTrigger className="h-12 border-2 border-gray-200 focus:ring-0 focus:border-blue-500">
                                    <SelectValue placeholder="اختر التصنيف" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent align="end">
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
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={basicInfoForm.control}
                          name="level"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold">
                                المستوى
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-12 border-2 border-gray-200 focus:ring-0 focus:border-blue-500">
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
                              <FormLabel className="text-base font-semibold">
                                اللغة
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-12 border-2 border-gray-200 focus:ring-0 focus:border-blue-500">
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

                      <Button
                        type="submit"
                        disabled={basicInfoForm.formState.isSubmitting}
                        className="w-full h-12 gap-2 font-semibold bg-blue-600 hover:bg-blue-700"
                      >
                        {basicInfoForm.formState.isSubmitting ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Save className="h-5 w-5" />
                        )}
                        حفظ المعلومات الأساسية
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Pricing */}
              <Card className="border-2 border-gray-200">
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl">التسعير</CardTitle>
                  <CardDescription>تحديد سعر الدورة</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...pricingForm}>
                    <form
                      onSubmit={pricingForm.handleSubmit(onSubmitPricing)}
                      className="space-y-5"
                    >
                      <FormField
                        control={pricingForm.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold">
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
                                    field.onChange(isNaN(numVal) ? 0 : numVal);
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
                                placeholder="0"
                                className="h-12 border-2 border-gray-200 focus-visible:border-blue-500 focus-visible:ring-0"
                              />
                            </FormControl>
                            <div className="text-sm">
                              {field.value === 0 ? (
                                <span className="text-green-600 font-medium">
                                  ✓ دورة مجانية (السعر = 0 د.ع)
                                </span>
                              ) : (
                                <span className="text-blue-600 font-medium">
                                  السعر: {Number(field.value).toLocaleString()}{" "}
                                  د.ع
                                </span>
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={pricingForm.control}
                        name="salePrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold">
                              السعر المخفض (اختياري)
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="text"
                                inputMode="decimal"
                                value={
                                  field.value === undefined || field.value === 0
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
                                    field.onChange(isNaN(numVal) ? 0 : numVal);
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
                                placeholder="0"
                                className="h-12 border-2 border-gray-200 focus-visible:border-blue-500 focus-visible:ring-0"
                              />
                            </FormControl>
                            <div className="text-sm">
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        disabled={pricingForm.formState.isSubmitting}
                        className="w-full h-12 gap-2 font-semibold bg-blue-600 hover:bg-blue-700"
                      >
                        {pricingForm.formState.isSubmitting ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Save className="h-5 w-5" />
                        )}
                        حفظ السعر
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>

            {/* Thumbnail */}
            <Card className="border-2 border-gray-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <ImageIcon className="h-6 w-6 text-blue-600" />
                  صورة الغلاف
                </CardTitle>
                <CardDescription>
                  قم بتحميل صورة جذابة لتكون غلاف الدورة التعليمية
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onImageSubmit)}
                    className="space-y-5"
                  >
                    <FormField
                      control={form.control}
                      name="image"
                      render={({ field }) => (
                        <FormItem>
                          <FormDescription className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4">
                            📸 اختر صورة واحدة عالية الجودة لتكون غلاف الدورة
                            <br />
                            <span className="text-sm text-gray-600">
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={uploadingThumbnail}
                      className="w-full h-12 gap-2 font-semibold bg-blue-600 hover:bg-blue-700"
                    >
                      {uploadingThumbnail ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Upload className="h-5 w-5" />
                      )}
                      حفظ صورة الغلاف
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== CONTENT TAB ===== */}
          <TabsContent value="content" className="space-y-6">
            <VideoUploader courseId={course.id} disabled={isAnyActionRunning} />
            <SmartCourseUploader id={course.id} disabled={isAnyActionRunning} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
