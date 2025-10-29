"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Course } from "@/types/types";
import {
  Play,
  Clock,
  Users,
  Award,
  Star,
  CheckCircle,
  Lock,
  ChevronDown,
  BookOpen,
  FileText,
  Globe,
  BarChart3,
  Video,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MuxPlayer from "@mux/mux-player-react";
import EnrollButton from "./EnrollButton";

interface CoursePreviewProps {
  course: Course;
}

export default function CoursePreview({ course }: CoursePreviewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["المقدمة"]) // Auto-expand intro section
  );
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  // Get the first free preview video (from المقدمة section)
  const freePreviewVideo = useMemo(() => {
    return course.videos?.find(
      (v) => v.section === "المقدمة" && v.isVisible !== false
    );
  }, [course.videos]);

  // Organize videos by section
  const videosBySections = useMemo(() => {
    const videos = course.videos || [];
    const sections: Record<string, any[]> = {};

    videos
      .filter((v) => v.isVisible !== false)
      .forEach((v) => {
        const sectionKey = v.section || "دروس الدورة";
        if (!sections[sectionKey]) sections[sectionKey] = [];
        sections[sectionKey].push(v);
      });

    // Sort videos by order
    Object.keys(sections).forEach((section) => {
      sections[section].sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    return sections;
  }, [course.videos]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} ساعة ${mins > 0 ? `و ${mins} دقيقة` : ""}`;
    }
    return `${mins} دقيقة`;
  };

  const totalDuration = useMemo(() => {
    return course.videos?.reduce((sum, v) => sum + (v.duration || 0), 0) || 0;
  }, [course.videos]);

  const totalVideos = course.videos?.length || 0;
  const originalPrice =
    course.price && course.price > 0 ? course.price * 5.83 : 0;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <div className="container mx-auto px-4 py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left: Course Info */}
            <div className="space-y-6">
              {/* Breadcrumb or Category */}
              {course.category && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-600 text-white hover:bg-blue-700">
                    {course.category}
                  </Badge>
                  {course.status === "published" && (
                    <Badge className="bg-yellow-400 text-black font-semibold hover:bg-yellow-500">
                      الأكثر مبيعاً
                    </Badge>
                  )}
                </div>
              )}

              {/* Title */}
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold mb-3 leading-tight">
                  {course.title}
                </h1>
                {course.subtitle && (
                  <p className="text-lg lg:text-xl text-gray-300 leading-relaxed">
                    {course.subtitle}
                  </p>
                )}
              </div>

              {/* Description */}
              {course.description && (
                <p className="text-gray-300 leading-relaxed text-sm lg:text-base">
                  {course.description}
                </p>
              )}

              {/* Stats Row */}
              <div className="flex flex-wrap items-center gap-4 lg:gap-6 text-sm">
                {/* Rating */}
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg">
                    {course.rating?.toFixed(1) || "4.7"}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(course.rating || 4.7)
                            ? "fill-amber-400 text-amber-400"
                            : "text-gray-500"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-gray-400">
                    ({(course.studentsCount || 0).toLocaleString()} تقييم)
                  </span>
                </div>

                {/* Students */}
                <div className="flex items-center gap-2 text-gray-300">
                  <Users className="w-5 h-5" />
                  <span>
                    {(course.studentsCount || 0).toLocaleString()} طالب
                  </span>
                </div>
              </div>

              {/* Instructor */}
              {course.instructor && (
                <div className="flex items-center gap-3 bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">أنشأها</p>
                    <p className="font-semibold text-base">
                      {course.instructor}
                    </p>
                  </div>
                </div>
              )}

              {/* Course Meta */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  <span>{totalVideos} درس</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{formatTotalDuration(totalDuration)}</span>
                </div>
                {course.language && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <span>{course.language}</span>
                  </div>
                )}
                {course.level && (
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    <span>{course.level}</span>
                  </div>
                )}
              </div>

              {/* Price & Enroll (Mobile & Desktop) */}
              <div className="lg:hidden">
                <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                  <CardContent className="p-6 space-y-4">
                    <div>
                      {course.price === 0 ? (
                        <p className="text-3xl font-bold text-green-400">
                          مجاني
                        </p>
                      ) : (
                        <div className="flex items-baseline gap-3">
                          <span className="text-3xl font-bold">
                            ${course.price}
                          </span>
                          {originalPrice > 0 && (
                            <span className="text-lg text-gray-400 line-through">
                              ${originalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <EnrollButton
                      courseId={course.id}
                      isFree={course.price === 0}
                      fullWidth
                    />
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Right: Video Preview */}
            <div className="lg:sticky lg:top-4">
              <Card className="overflow-hidden shadow-2xl border-0">
                <div className="relative bg-black">
                  {showVideoPlayer && freePreviewVideo?.playbackId ? (
                    <MuxPlayer
                      playbackId={freePreviewVideo.playbackId}
                      streamType="on-demand"
                      metadata={{
                        video_id: freePreviewVideo.videoId,
                        video_title: freePreviewVideo.title,
                      }}
                      className="w-full aspect-video"
                    />
                  ) : (
                    <div className="relative aspect-video">
                      <Image
                        src={
                          course.thumbnailUrl ||
                          "/images/course-placeholder.jpg"
                        }
                        alt={course.title}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-center justify-center">
                        {freePreviewVideo ? (
                          <button
                            onClick={() => setShowVideoPlayer(true)}
                            className="group flex flex-col items-center gap-3"
                          >
                            <div className="bg-white rounded-full p-5 group-hover:scale-110 transition-transform shadow-2xl">
                              <Play className="w-10 h-10 text-gray-900 fill-current" />
                            </div>
                            <p className="text-white font-bold text-lg">
                              مشاهدة المعاينة المجانية
                            </p>
                          </button>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <Lock className="w-12 h-12 text-white/60" />
                            <p className="text-white/80 text-sm">
                              لا توجد معاينة متاحة
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Price Card (Desktop Only - Below Video) */}
                <div className="hidden lg:block">
                  <CardContent className="p-6 space-y-4 bg-white">
                    <div className="text-center">
                      {course.price === 0 ? (
                        <p className="text-4xl font-bold text-green-600">
                          مجاني
                        </p>
                      ) : (
                        <div className="flex items-baseline justify-center gap-3">
                          <span className="text-4xl font-bold text-gray-900">
                            ${course.price}
                          </span>
                          {originalPrice > 0 && (
                            <span className="text-xl text-gray-400 line-through">
                              ${originalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                      {(course.price ?? 0) > 0 && (
                        <p className="text-sm text-red-600 font-medium mt-2">
                          خصم محدود!
                        </p>
                      )}
                    </div>
                    <EnrollButton
                      courseId={course.id}
                      isFree={course.price === 0}
                      fullWidth
                    />
                    <p className="text-xs text-center text-gray-600">
                      ضمان استرداد الأموال لمدة 30 يوماً
                    </p>
                  </CardContent>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* What You'll Learn */}
            {course.learningPoints && course.learningPoints.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6 lg:p-8">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <CheckCircle className="w-7 h-7 text-green-600" />
                    ماذا ستتعلم
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {course.learningPoints.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-sm leading-relaxed">
                          {point}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Course Content (Curriculum) */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6 lg:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <BookOpen className="w-7 h-7 text-blue-600" />
                    محتوى الدورة
                  </h2>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{totalVideos}</span> درس •{" "}
                    <span className="font-medium">
                      {formatTotalDuration(totalDuration)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(videosBySections).map(([section, videos]) => {
                    const isExpanded = expandedSections.has(section);
                    const isFreeSection = section === "المقدمة";
                    const sectionDuration = videos.reduce(
                      (sum, v) => sum + (v.duration || 0),
                      0
                    );

                    return (
                      <div
                        key={section}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors"
                      >
                        {/* Section Header */}
                        <button
                          onClick={() => toggleSection(section)}
                          className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <ChevronDown
                              className={`w-5 h-5 text-gray-600 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                            <div className="text-right">
                              <h3 className="font-bold text-gray-900 text-base">
                                {section}
                              </h3>
                              {isFreeSection && (
                                <span className="text-xs text-green-600 font-medium">
                                  معاينة مجانية
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600">
                            {videos.length} دروس •{" "}
                            {formatDuration(sectionDuration)}
                          </div>
                        </button>

                        {/* Videos List */}
                        {isExpanded && (
                          <div className="divide-y divide-gray-100 bg-white">
                            {videos.map((video, idx) => (
                              <div
                                key={video.videoId}
                                className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                      isFreeSection
                                        ? "bg-green-100"
                                        : "bg-gray-100"
                                    }`}
                                  >
                                    {isFreeSection ? (
                                      <Play className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <Lock className="w-4 h-4 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900 text-sm">
                                      {video.title}
                                    </p>
                                    {video.description && (
                                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                        {video.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className="text-sm text-gray-600 font-medium ml-4">
                                  {formatDuration(video.duration)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Requirements */}
            {course.requirements && course.requirements.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6 lg:p-8">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <FileText className="w-7 h-7 text-orange-600" />
                    المتطلبات
                  </h2>
                  <ul className="space-y-3">
                    {course.requirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-600 rounded-full mt-2 flex-shrink-0" />
                        <span className="text-gray-700 leading-relaxed">
                          {req}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {course.description && (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6 lg:p-8">
                  <h2 className="text-2xl font-bold mb-6">الوصف</h2>
                  <div className="prose prose-gray max-w-none text-right">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {course.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Sidebar - Sticky Info Card */}
          <div className="hidden lg:block">
            <Card className="sticky top-4 border-0 shadow-lg">
              <CardContent className="p-6 space-y-6">
                <h3 className="font-bold text-xl border-b pb-3">
                  معلومات الدورة
                </h3>

                <div className="space-y-4">
                  {course.level && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 flex items-center gap-2 text-sm">
                        <BarChart3 className="w-4 h-4" />
                        المستوى
                      </span>
                      <span className="font-semibold text-gray-900">
                        {course.level}
                      </span>
                    </div>
                  )}

                  {course.language && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4" />
                        اللغة
                      </span>
                      <span className="font-semibold text-gray-900">
                        {course.language}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center gap-2 text-sm">
                      <Video className="w-4 h-4" />
                      عدد الدروس
                    </span>
                    <span className="font-semibold text-gray-900">
                      {totalVideos}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4" />
                      المدة الإجمالية
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatTotalDuration(totalDuration)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4" />
                      الطلاب
                    </span>
                    <span className="font-semibold text-gray-900">
                      {(course.studentsCount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <EnrollButton
                    courseId={course.id}
                    isFree={course.price === 0}
                    fullWidth
                  />
                </div>

                <p className="text-xs text-center text-gray-500 pt-2">
                  💳 دفع آمن • 🔄 ضمان استرداد 30 يوم
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
