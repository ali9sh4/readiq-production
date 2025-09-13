"use client";
import React, { useMemo, useState } from "react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ExternalLink,
  Eye,
  File as FileIcon,
  Image as ImageIcon,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";
import { Course } from "@/types/types";
import SmartCourseUploader from "./fileUplaodtoR2";

// ---------- Types ----------
export type CourseStatus = "draft" | "published" | "archived";
export type LessonType = "video" | "quiz" | "document";

export interface UploadFile {
  filename: string;
  size: string;
  url: string;
  originName: string;
}

export interface Lesson {
  id: string;
  title: string;
  durationSec?: number;
  type: LessonType;
  order: number;
  status: "draft" | "published";
  metrics?: { views: number; completionRate: number };
  thumbnailUrl?: string;
}

interface CourseFile {
  id: string;
  name: string;
  sizeKB: number;
  url?: string;
  category: "Resource" | "Assignment" | "Misc";
}

// ---------- Mock data for preview ----------
const mockLessons: Lesson[] = [
  {
    id: "l1",
    title: "مرحباً والإعداد",
    durationSec: 420,
    type: "video",
    order: 1,
    status: "published",
    metrics: { views: 301, completionRate: 0.92 },
    thumbnailUrl:
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "l2",
    title: "أساسيات الحالة والخصائص",
    durationSec: 960,
    type: "video",
    order: 2,
    status: "draft",
    metrics: { views: 241, completionRate: 0.61 },
    thumbnailUrl:
      "https://images.unsplash.com/photo-1526378722484-bd91ca387e72?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "l3",
    title: "اختبار المعرفة – الجزء الأول",
    type: "quiz",
    order: 3,
    status: "draft",
    metrics: { views: 182, completionRate: 0.44 },
  },
  {
    id: "l4",
    title: "العمل مع النماذج",
    durationSec: 780,
    type: "video",
    order: 4,
    status: "published",
    metrics: { views: 210, completionRate: 0.68 },
    thumbnailUrl:
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800&auto=format&fit=crop",
  },
];

const mockFiles: CourseFile[] = [
  { id: "f1", name: "شرائح_المقدمة.pdf", sizeKB: 1180, category: "Resource" },
  { id: "f2", name: "واجب_١.docx", sizeKB: 210, category: "Assignment" },
];

// ---------- Helpers ----------

function StatusBadge({ status }: { status: CourseStatus }) {
  const statusMap: Record<CourseStatus, string> = {
    draft: "مسودة",
    published: "منشور",
    archived: "مؤرشف",
  };
  const variant: Record<CourseStatus, any> = {
    draft: "secondary",
    published: "default",
    archived: "outline",
  };
  return (
    <Badge
      variant={variant[status]}
      className="rounded-full px-2.5 py-0.5 text-xs"
    >
      {statusMap[status]}
    </Badge>
  );
}

export default function CourseDashboard({
  courseData,
}: {
  courseData: Course;
}) {
  const [course, setCourse] = useState<Course>(courseData);
  const [lessons, setLessons] = useState<Lesson[]>(mockLessons);
  const [files, setFiles] = useState<CourseFile[]>(mockFiles);
  const [uploading, setUploading] = useState<{
    type: "video" | "file";
    progress: number;
  } | null>(null);

  type ImageUpload = { id: string; url: string; file?: File };
  const isImageUpload = (image: unknown): image is ImageUpload => {
    return (
      typeof image === "object" &&
      image !== null &&
      "url" in image &&
      typeof (image as ImageUpload).url === "string"
    );
  };

  const sortedLessons = useMemo(
    () => [...lessons].sort((a, b) => a.order - b.order),
    [lessons]
  );

  const getFirstImageUrl = (course: Course): string => {
    if (!course.images || course.images.length === 0)
      return "/images/course-placeholder.jpg";
    const firstImage = course.images[0] as unknown;
    if (isImageUpload(firstImage)) {
      const imageUrl = firstImage.url;
      if (imageUrl.startsWith("http")) return imageUrl;
      return `https://firebasestorage.googleapis.com/v0/b/readiq-1f109.firebasestorage.app/o/${encodeURIComponent(
        imageUrl
      )}?alt=media`;
    }
    if (typeof firstImage === "string") {
      if (firstImage.startsWith("http")) return firstImage;
      return `https://firebasestorage.googleapis.com/v0/b/readiq-1f109.firebasestorage.app/o/${encodeURIComponent(
        firstImage
      )}?alt=media`;
    }
    return "/images/course-placeholder.jpg";
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6" dir="rtl">
      <div className="mx-auto max-w-screen-xl">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <a className="hover:underline" href="/course-upload">
            الدورات
          </a>
          <ChevronLeft className="h-4 w-4" />
          <span className="text-foreground/90">{course.title}</span>
        </div>

        {/* Header */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {course.title}
            </h1>
            <StatusBadge status="draft" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2">
              <Eye className="h-4 w-4" />
              معاينة
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  الإعدادات
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>إعدادات الدورة</DropdownMenuItem>
                <DropdownMenuItem>تحسين محركات البحث</DropdownMenuItem>
                <DropdownMenuItem>الوصول والتسعير</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              نشر
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              label: "المشتركون",
              value: course.studentsCount?.toLocaleString() || "0",
            },
            {
              label: "معدل الإنجاز",
              value: `%${Math.round((course.rating || 0) * 20)}`,
            },
            {
              label: "الإيرادات",
              value: `$${(
                (course.price || 0) * (course.studentsCount || 0)
              ).toLocaleString()}`,
            },
          ].map((kpi, i) => (
            <Card key={i} className="border-muted-foreground/10 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>{kpi.label}</CardDescription>
                <CardTitle className="text-2xl">{kpi.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Main layout */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-10">
          {/* LEFT */}
          <div className="space-y-4 lg:col-span-6">{/* Video Upload */}</div>

          {/* RIGHT */}
          <div className="space-y-4 lg:col-span-8">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>تفاصيل الدورة</CardTitle>
                <CardDescription>تعديل سريع للحقول الأساسية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>صورة الغلاف</Label>
                  <div className="relative h-44 overflow-hidden rounded-2xl border">
                    <Image
                      src={getFirstImageUrl(course)}
                      fill
                      alt={course.title || "صورة الدورة"}
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                    <div className="absolute bottom-2 right-2">
                      <Button size="sm" variant="secondary" className="gap-2">
                        <ImageIcon className="h-4 w-4" />
                        تغيير
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>السعر (دولار)</Label>
                    <Input type="number" defaultValue={course.price} />
                  </div>
                  <div className="space-y-2">
                    <Label>التصنيف</Label>
                    <Input defaultValue={course.category} />
                  </div>
                </div>

                <Button className="w-full">حفظ التغييرات</Button>
              </CardContent>
            </Card>

            {/* Files */}
            <Card className="shadow-sm">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>الملفات</CardTitle>
                  <CardDescription>الموارد والواجبات</CardDescription>
                </div>
                <SmartCourseUploader id={courseData.id} />
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="الكل">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="الكل">الكل</TabsTrigger>
                    <TabsTrigger value="Resource">الموارد</TabsTrigger>
                    <TabsTrigger value="Assignment">الواجبات</TabsTrigger>
                    <TabsTrigger value="Misc">متنوع</TabsTrigger>
                  </TabsList>

                  {(["الكل", "Resource", "Assignment", "Misc"] as const).map(
                    (k) => (
                      <TabsContent key={k} value={k} className="mt-3 space-y-2">
                        {files
                          .filter((f) => k === "الكل" || f.category === k)
                          .map((f) => (
                            <div
                              key={f.id}
                              className="flex items-center justify-between rounded-xl border p-3"
                            >
                              <div className="flex items-center gap-3">
                                <FileIcon className="h-4 w-4" />
                                <div>
                                  <div className="font-medium">{f.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {Math.round(f.sizeKB)} ك.ب •{" "}
                                    {f.category === "Resource"
                                      ? "مورد"
                                      : f.category === "Assignment"
                                      ? "واجب"
                                      : "متنوع"}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <IconButton title="تحميل">
                                  <ExternalLink className="h-4 w-4" />
                                </IconButton>
                                <IconButton
                                  title="حذف"
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </IconButton>
                              </div>
                            </div>
                          ))}
                      </TabsContent>
                    )
                  )}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Analytics */}
        <Card className="mt-6 shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>التحليلات والنشاط</CardTitle>
              <CardDescription>نظرة عامة سريعة</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              فتح التحليلات الكاملة
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border p-4">
              <div className="text-sm text-muted-foreground">
                مشاهدات 7 أيام
              </div>
              <div className="mt-1 text-2xl font-semibold">١,٢٤٨</div>
              <Separator className="my-4" />
              <div className="space-y-3 text-sm">
                {[
                  "الطالب أحمد أكمل الدرس الثاني",
                  'تقييم جديد: "واضح جداً"',
                  "الطالبة فاطمة انضمت",
                ].map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />{" "}
                    {a}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-sm text-muted-foreground">أفضل درس</div>
              <div className="mt-1 font-medium">مرحباً والإعداد</div>
              <div className="mt-4 text-sm text-muted-foreground">الإنجاز</div>
              <Progress value={92} />
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-sm text-muted-foreground">
                التعليقات الأخيرة
              </div>
              <div className="mt-2 space-y-2 text-sm">
                {["هل يمكن شرح useState بالتفصيل؟", "أين ملف التمرين؟"].map(
                  (c, i) => (
                    <div key={i} className="rounded-lg border p-2">
                      {c}
                    </div>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Small UI helper ---
function IconButton({
  children,
  title,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <Button
      size="icon"
      variant="ghost"
      className={`h-8 w-8 ${className || ""}`}
      title={title}
    >
      {children}
    </Button>
  );
}
