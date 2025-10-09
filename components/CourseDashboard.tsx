"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/authContext";
import { Textarea } from "@/components/ui/textarea";

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
} from "lucide-react";

// Assuming these are your actual imports - adjust paths as needed
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
import { Label } from "@/components/ui/label";
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

// Types
interface CourseVideo {
  videoId: string;
  title: string;
  duration?: number;
  isPublished?: boolean;
}

interface CourseFile {
  id: string;
  filename: string;
  originalName: string;
}

interface Course {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  category: string;
  level?: string;
  language?: string;
  price?: number;
  status?: string;
  images?: string[];
  videos?: CourseVideo[];
  files?: CourseFile[];
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
export default function CourseDashboard({
  courseData,
}: {
  courseData: Course;
}) {
  console.log("Course ID:", courseData.id, "Full data:", courseData);
  const [course] = useState<Course>(courseData);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [basicForm, setBasicForm] = useState({
    title: course.title || "",
    subtitle: course.subtitle || "",
    description: course.description || "",
    category: course.category || "",
    level:
      (course.level as
        | "beginner"
        | "intermediate"
        | "advanced"
        | "all_levels") || "all_levels",
    language:
      (course.language as "arabic" | "english" | "french" | "spanish") ||
      "arabic",
  });
  const [pricingForm, setPricingForm] = useState<{
    price: number | string;
  }>({
    price: course.price || 0,
  });
  const auth = useAuth();

  const videos = course.videos || [];
  const files = course.files || [];
  const totalVideoDuration = videos.reduce(
    (sum, v) => sum + (v.duration || 0),
    0
  );
  const publishedVideosCount = videos.filter((v) => v.isPublished).length;
  const status = (course.status as CourseStatus) || "draft";

  const handleSaveBasicInfo = async () => {
    if (!auth?.user) {
      setError("يرجى تسجيل الدخول");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = await auth?.user.getIdToken();
      const result = await updateCourseBasicInfo(course.id, basicForm, token);

      if (result.success) {
        setSuccess("تم الحفظ بنجاح");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(result.error || "فشل في الحفظ");
      }
    } catch (err) {
      console.error("Error saving basic info:", err);
      setError("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  // Do the same for handleSavePricing and handlePublish

  const handleSavePricing = async () => {
    if (!auth?.user) {
      setError("يرجى تسجيل الدخول");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = await auth.user.getIdToken();
      const result = await updateCoursePricing(course.id, pricingForm, token);

      if (result.success) {
        setSuccess("تم الحفظ بنجاح");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(result.error || "فشل في الحفظ");
      }
    } catch (err) {
      console.error("Error saving basic info:", err);
      setError("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
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
        setSuccess("تم الحفظ بنجاح");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(result.error || "فشل في الحفظ");
      }
    } catch (err) {
      console.error("Error saving basic info:", err);
      setError("حدث خطأ أثناء الحفظ");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6" dir="rtl">
      <div className="mx-auto max-w-7xl">
        {/* BREADCRUMBS */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <a href="/course-upload" className="hover:text-gray-900">
            الدورات
          </a>
          <ChevronLeft className="h-4 w-4 rotate-180" /> {/* ✅ Flip for RTL */}
          <span className="text-gray-900">{course.title}</span>
        </div>

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{course.title}</h1>
            <StatusBadge status={status} />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2">
              <Eye className="h-4 w-4" />
              معاينة
            </Button>

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
                  <p className="text-sm text-gray-600">المدة الإجمالية</p>
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Course Image */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>صورة الدورة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video relative rounded-lg overflow-hidden border"></div>
                  <Button variant="outline" className="w-full mt-4">
                    تغيير الصورة
                  </Button>
                </CardContent>
              </Card>

              {/* Basic Info */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>المعلومات الأساسية</CardTitle>
                  <CardDescription>
                    تحديث تفاصيل الدورة الرئيسية
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>العنوان *</Label>
                      <Input
                        value={basicForm.title}
                        onChange={(e) =>
                          setBasicForm({ ...basicForm, title: e.target.value })
                        }
                        placeholder="عنوان الدورة"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>العنوان الفرعي</Label>
                      <Input
                        value={basicForm.subtitle}
                        onChange={(e) =>
                          setBasicForm({
                            ...basicForm,
                            subtitle: e.target.value,
                          })
                        }
                        placeholder="وصف قصير"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>الوصف</Label>
                    <Textarea
                      value={basicForm.description}
                      onChange={(e) =>
                        setBasicForm({
                          ...basicForm,
                          description: e.target.value,
                        })
                      }
                      placeholder="وصف تفصيلي للدورة"
                      rows={4}
                      className="resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>التصنيف</Label>
                      <Input
                        value={basicForm.category}
                        onChange={(e) =>
                          setBasicForm({
                            ...basicForm,
                            category: e.target.value,
                          })
                        }
                        placeholder="مثال: البرمجة"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>المستوى</Label>
                      <Select
                        value={basicForm.level}
                        onValueChange={(value) =>
                          setBasicForm({ ...basicForm, level: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">مبتدئ</SelectItem>
                          <SelectItem value="intermediate">متوسط</SelectItem>
                          <SelectItem value="advanced">متقدم</SelectItem>
                          <SelectItem value="all_levels">
                            جميع المستويات
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>اللغة</Label>
                      <Select
                        value={basicForm.language}
                        onValueChange={(value) =>
                          setBasicForm({ ...basicForm, language: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="arabic">العربية</SelectItem>
                          <SelectItem value="english">English</SelectItem>
                          <SelectItem value="french">Français</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveBasicInfo}
                    disabled={saving}
                    className="w-full gap-2"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    حفظ المعلومات الأساسية
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>التسعير</CardTitle>
                <CardDescription>تحديد سعر الدورة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>السعر (دولار) *</Label>
                    <Input
                      type="text"
                      value={pricingForm.price}
                      onChange={(e) => {
                        const val = e.target.value;

                        // Allow empty
                        if (val === "") {
                          setPricingForm({ ...pricingForm, price: "" as any });
                          return;
                        }

                        // Allow numbers and one decimal point
                        if (/^\d*\.?\d*$/.test(val)) {
                          setPricingForm({ ...pricingForm, price: val as any });
                        }
                      }}
                      onBlur={() => {
                        const numValue = parseFloat(pricingForm.price as any);

                        // If empty or invalid, set to 0
                        if (pricingForm.price === "" || isNaN(numValue)) {
                          setPricingForm({ ...pricingForm, price: 0 });
                          return;
                        }

                        // If negative, set to 0
                        if (numValue < 0) {
                          setPricingForm({ ...pricingForm, price: 0 });
                          return;
                        }

                        // Round to 2 decimal places
                        setPricingForm({
                          ...pricingForm,
                          price: Math.round(numValue * 100) / 100,
                        });
                      }}
                      className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-500">
                      {pricingForm.price === "" || pricingForm.price === 0
                        ? "أدخل السعر بالدولار"
                        : `السعر: $${
                            typeof pricingForm.price === "number"
                              ? pricingForm.price.toFixed(2)
                              : pricingForm.price
                          }`}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleSavePricing}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  حفظ السعر
                </Button>
              </CardContent>
            </Card>
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
                <CardTitle>إعدادات الدورة</CardTitle>
                <CardDescription>إعدادات متقدمة للدورة</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">قريباً...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
