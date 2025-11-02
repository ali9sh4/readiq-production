"use client";
import "@mux/mux-player/themes/minimal";

import React, { useState, useMemo, useCallback, useEffect, use } from "react";
import MuxPlayer from "@mux/mux-player-react";
import {
  X,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  CheckCircle,
  Lock,
  Clock,
  FileText,
  Download,
  Eye,
  BookOpen,
  ChevronLeft,
  Award,
  User,
  BarChart3,
  Loader2,
  AlertCircle,
  Menu,
} from "lucide-react";
import { Course } from "@/types/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { translateLevel } from "@/utils/translation";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

// --- Types ---
interface VideoProgress {
  videoId: string;
  completed: boolean;
  watchedSeconds: number;
}

// --- Helpers ---
function formatDuration(seconds: number) {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 بايت";
  const k = 1024;
  const sizes = ["بايت", "كيلو", "ميجا", "جيجا"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(filename: string) {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const colors: Record<string, string> = {
    pdf: "text-red-400",
    doc: "text-blue-400",
    docx: "text-blue-400",
    zip: "text-purple-400",
    mp4: "text-green-400",
    mp3: "text-orange-400",
  };
  return <FileText className={`w-5 h-5 ${colors[ext] || "text-gray-600"}`} />;
}

// --- Component ---
export default function CoursePlayer({
  course,
  isEnrolled = false, // ✅ Default to false for security
  userProgress = [], // ✅ Pass from parent/server
  onProgressUpdate, // ✅ Callback to save progress
}: {
  course: Course;
  isEnrolled?: boolean;
  userProgress?: VideoProgress[];
  onProgressUpdate?: (videoId: string, completed: boolean) => Promise<void>;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");

    if (paymentStatus === "success") {
      toast.success("تم الدفع بنجاح! 🎉", {
        description: "مرحباً بك في الدورة! يمكنك الآن الوصول إلى جميع الدروس.",
        duration: 5000,
      });

      // ✅ Only clean URL if payment=success exists
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [activeTab, setActiveTab] = useState<"overview" | "resources">(
    "overview"
  );
  const [completedVideos, setCompletedVideos] = useState<Set<string>>(
    new Set()
  );

  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);

  // --- Organize Videos ---
  const videosBySections = useMemo(() => {
    const videos = (course?.videos || []).filter((v) => v.isVisible);
    const sections: Record<string, any[]> = {};

    videos.forEach((v) => {
      const sectionKey = v.section || "دروس الدورة";
      if (!sections[sectionKey]) sections[sectionKey] = [];
      sections[sectionKey].push(v);
    });

    // Sort videos within each section by GLOBAL order
    Object.keys(sections).forEach((section) => {
      sections[section].sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    // Sort sections in proper order
    const sectionOrder = [
      "المقدمة",
      "القسم 1",
      "القسم 2",
      "القسم 3",
      "القسم 4",
      "القسم 5",
      "القسم 6",
      "القسم 7",
      "القسم 8",
      "القسم 9",
      "القسم 10",
      "الخاتمة",
      "دروس الدورة", // No section - at end
    ];

    const sortedSections: Record<string, any[]> = {};
    sectionOrder.forEach((sectionName) => {
      if (sections[sectionName]) {
        sortedSections[sectionName] = sections[sectionName];
      }
    });

    // Add any other sections not in the predefined list
    Object.keys(sections).forEach((key) => {
      if (!sortedSections[key]) {
        sortedSections[key] = sections[key];
      }
    });

    return sortedSections;
  }, [course?.videos]);

  const allVideos = useMemo(
    () => Object.values(videosBySections).flat(),
    [videosBySections]
  );

  const currentVideo = allVideos[currentVideoIndex];

  // ✅ Better access control
  const canAccessVideo = useMemo(() => {
    if (!currentVideo) return false;
    if (currentVideo.isFreePreview) return true;
    if (course.price === 0) return true;
    return isEnrolled;
  }, [currentVideo, course.price, isEnrolled]);

  const currentVideoFiles = useMemo(() => {
    return (
      course?.files?.filter(
        (f) => f.relatedVideoId === currentVideo?.videoId
      ) || []
    );
  }, [course?.files, currentVideo]);

  const generalFiles = useMemo(() => {
    return course?.files?.filter((f) => !f.relatedVideoId) || [];
  }, [course?.files]);

  // ✅ Calculate real progress
  const progress = useMemo(() => {
    if (!allVideos.length) return 0;
    const completed = allVideos.filter((v) =>
      completedVideos.has(v.videoId)
    ).length;
    return Math.round((completed / allVideos.length) * 100);
  }, [completedVideos, allVideos]);

  // ✅ Auto-expand current section
  useEffect(() => {
    if (currentVideo) {
      const section = currentVideo.section || "دروس الدورة";
      setExpandedSections((prev) => new Set(prev).add(section));
    }
  }, [currentVideo]);

  // ✅ Handle video completion
  const handleVideoComplete = useCallback(async () => {
    if (!currentVideo || completedVideos.has(currentVideo.videoId)) return;

    setCompletedVideos((prev) => new Set(prev).add(currentVideo.videoId));

    // Save to backend
    if (onProgressUpdate) {
      try {
        await onProgressUpdate(currentVideo.videoId, true);
      } catch (error) {
        console.error("Failed to save progress:", {
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }, [currentVideo, completedVideos, onProgressUpdate]);

  // ✅ Manual mark as complete
  const handleMarkComplete = async () => {
    if (!currentVideo) return;
    setMarkingComplete(true);
    await handleVideoComplete();
    setMarkingComplete(false);
  };

  // ✅ Next/Previous handlers
  const goToNextVideo = useCallback(() => {
    if (currentVideoIndex < allVideos.length - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
      setVideoError(null);
    }
  }, [currentVideoIndex, allVideos.length]);

  const goToPreviousVideo = useCallback(() => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(currentVideoIndex - 1);
      setVideoError(null);
    }
  }, [currentVideoIndex]);

  // ✅ Download file helper
  const handleDownload = useCallback(
    (filename: string, originalName: string) => {
      const link = document.createElement("a");
      link.href = `/api/files/download?filename=${encodeURIComponent(
        filename
      )}`;
      link.download = originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    []
  );

  // ✅ Toggle section
  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  // ✅ Course stats
  const totalDuration = useMemo(() => {
    return allVideos.reduce((sum, v) => sum + (v.duration || 0), 0);
  }, [allVideos]);

  // --- UI ---
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900" dir="rtl">
      {/* Sidebar */}
      {/* Fixed Sidebar - Replace your entire aside block with this */}
      <aside
        className={`${
          sidebarOpen ? "w-96 border-l border-gray-200" : "w-0"
        } sticky top-0 h-screen backdrop-blur-xl transition-all duration-300`}
      >
        <div className={`${sidebarOpen ? "flex" : "hidden"} flex-col h-full`}>
          {/* Header */}
          <div className="flex-shrink-0 bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 p-4 text-gray-900 border-b border-gray-200">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                محتوى الدورة
              </h2>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-white/60 rounded-full overflow-hidden border border-gray-200">
                    <div
                      className="h-full bg-gradient-to-l from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold whitespace-nowrap">
                    {progress}%
                  </span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Sections */}
          <div className="flex-1 overflow-y-auto custom-scrollbar border-t border-gray-200 bg-white">
            <div className="divide-y divide-gray-200">
              {Object.entries(videosBySections).map(([section, videos]) => {
                const isExpanded = expandedSections.has(section);
                const sectionCompleted = videos.filter((v) =>
                  completedVideos.has(v.videoId)
                ).length;
                const sectionProgress = Math.round(
                  (sectionCompleted / videos.length) * 100
                );

                return (
                  <div key={section} className="bg-gray-50/30">
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(section)}
                      className="w-full p-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isExpanded ? "bg-blue-100" : "bg-gray-100"
                          } transition-colors`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-blue-600" />
                          ) : (
                            <ChevronLeft className="w-4 h-4 text-gray-600" />
                          )}
                        </div>
                        <div className="text-right">
                          <h3 className="font-semibold text-gray-900">
                            {section}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {videos.length} دروس • {sectionCompleted} مكتمل
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 relative">
                          <svg className="w-12 h-12 transform -rotate-90">
                            <circle
                              cx="24"
                              cy="24"
                              r="20"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                              className="text-gray-200"
                            />
                            <circle
                              cx="24"
                              cy="24"
                              r="20"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 20}`}
                              strokeDashoffset={`${
                                2 * Math.PI * 20 * (1 - sectionProgress / 100)
                              }`}
                              className="text-blue-600 transition-all duration-500"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                            {sectionProgress}%
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* Videos */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 bg-gray-50">
                        {videos.map((video, idx) => {
                          const videoIndex = allVideos.indexOf(video);
                          const isActive = videoIndex === currentVideoIndex;
                          const isCompleted = completedVideos.has(
                            video.videoId
                          );
                          const isLocked =
                            !video.isFreePreview &&
                            course.price !== 0 &&
                            !isEnrolled;

                          return (
                            <button
                              key={video.videoId}
                              onClick={() => {
                                if (!isLocked) {
                                  setCurrentVideoIndex(videoIndex);
                                  setVideoError(null);
                                }
                              }}
                              disabled={isLocked}
                              className={`w-full p-4 flex items-center gap-3 transition-all border-b border-gray-100 last:border-b-0 ${
                                isActive
                                  ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-r-4 border-blue-600"
                                  : "hover:bg-gray-50"
                              } ${
                                isLocked ? "opacity-50 cursor-not-allowed" : ""
                              }`}
                            >
                              <div
                                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm transition-all ${
                                  isCompleted
                                    ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white"
                                    : isActive
                                    ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {isLocked ? (
                                  <Lock className="w-5 h-5" />
                                ) : isCompleted ? (
                                  <CheckCircle className="w-5 h-5" />
                                ) : (
                                  idx + 1
                                )}
                              </div>

                              <div className="flex-1 text-right min-w-0">
                                <p
                                  className={`font-medium truncate ${
                                    isActive ? "text-blue-900" : "text-gray-900"
                                  }`}
                                >
                                  {video.title}
                                </p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(video.duration)}
                                  </span>
                                  {video.isFreePreview && (
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                      معاينة مجانية
                                    </span>
                                  )}
                                </div>
                              </div>

                              {isActive && !isLocked && (
                                <PlayCircle className="w-5 h-5 text-blue-600 flex-shrink-0 animate-pulse" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 ">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {!sidebarOpen && (
              <button
                onClick={() => {
                  setSidebarOpen(true);
                }}
                className="p-2 hover:bg-gray-100  rounded-lg  transition-all group"
              >
                <Menu className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
              </button>
            )}

            <div className="min-w-0">
              <h1 className="text-base lg:text-lg font-semibold truncate">
                {course.title}
              </h1>
              <p className="text-xs text-gray-600 truncate">
                {course.instructor || "مدرب غير معروف"} •{" "}
                {course.level ? translateLevel(course.level) : "جميع المستويات"}
              </p>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm" className="flex-shrink-0">
              <ChevronLeft className="w-4 h-4 ml-1" />
              العودة
            </Button>
          </Link>
        </header>

        {/* Video Player */}
        <div className="relative bg-black flex justify-center items-center min-h-[400px]">
          {/* Loading State */}
          {isLoadingVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
          )}

          {/* Error State */}
          {videoError && (
            <div className="aspect-video flex flex-col items-center justify-center text-center p-6">
              <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
              <p className="text-white mb-4">{videoError}</p>
              <Button
                onClick={() => {
                  setVideoError(null);
                  setIsLoadingVideo(false);
                }}
                variant="outline"
                className="text-white border-white hover:bg-white/10"
              >
                إعادة المحاولة
              </Button>
            </div>
          )}

          {/* Video Player - When User Has Access */}
          {!videoError && currentVideo && canAccessVideo && (
            <>
              {/* 🔍 Debug Console Log */}
              {console.log("🎥 Video Debug:", {
                videoId: currentVideo.videoId,
                title: currentVideo.title,
                playbackId: currentVideo.playbackId,
                muxPlaybackId: currentVideo.muxPlaybackId,
                hasPlaybackId: !!(
                  currentVideo.playbackId || currentVideo.muxPlaybackId
                ),
              })}

              {/* Check if playback ID exists */}
              {!currentVideo.playbackId && !currentVideo.muxPlaybackId ? (
                <div className="aspect-video flex flex-col items-center justify-center text-center p-6">
                  <AlertCircle className="w-16 h-16 text-yellow-500 mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    معرف الفيديو مفقود
                  </h3>
                  <p className="text-gray-400">
                    لم يتم العثور على معرف Mux لهذا الفيديو
                  </p>
                </div>
              ) : (
                <MuxPlayer
                  playbackId={currentVideo.playbackId}
                  streamType="on-demand"
                  metadata={{
                    video_id: currentVideo.videoId,
                    video_title: currentVideo.title,
                  }}
                  className="w-full h-full aspect-video bg-black"
                  onEnded={() => {
                    handleVideoComplete();
                    goToNextVideo();
                  }}
                />
              )}
            </>
          )}

          {/* Locked Content - When User Doesn't Have Access */}
          {!videoError && currentVideo && !canAccessVideo && (
            <div className="aspect-video flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-gray-100 to-gray-200">
              <Lock className="w-16 h-16 mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2 text-gray-900">
                محتوى مقفل
              </h3>
              <p className="text-gray-600 mb-4">
                {isEnrolled
                  ? "هذا الفيديو غير متاح حالياً"
                  : "قم بالتسجيل في الدورة للوصول إلى هذا المحتوى"}
              </p>
              {!isEnrolled && (
                <Link href={`/courses/${course.id}`}>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    التسجيل في الدورة
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* No Video Selected */}
          {!currentVideo && (
            <div className="aspect-video flex flex-col items-center justify-center text-center p-6">
              <PlayCircle className="w-16 h-16 mb-4 text-gray-400" />
              <p className="text-gray-400">
                اختر درساً من القائمة لبدء المشاهدة
              </p>
            </div>
          )}
        </div>

        {/* Video Controls */}
        {currentVideo && canAccessVideo && (
          <div className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
            <div className="flex items-center gap-2">
              <Button
                onClick={goToPreviousVideo}
                disabled={currentVideoIndex === 0}
                variant="outline"
                size="sm"
                className="hover:bg-blue-50 hover:border-blue-300 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
                السابق
              </Button>
              <Button
                onClick={goToNextVideo}
                disabled={currentVideoIndex === allVideos.length - 1}
                variant="outline"
                size="sm"
                className="hover:bg-blue-50 hover:border-blue-300 transition-all"
              >
                التالي
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
            {!completedVideos.has(currentVideo.videoId) && (
              <Button
                onClick={handleMarkComplete}
                disabled={markingComplete}
                size="sm"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md hover:shadow-lg transition-all"
              >
                {markingComplete ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 ml-2" />
                )}
                تحديد كمكتمل
              </Button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white/80 backdrop-blur-xl flex border-b border-gray-200/50">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-8 py-4 text-sm font-medium border-b-2 transition-all relative ${
              activeTab === "overview"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              نظرة عامة
            </span>
            {activeTab === "overview" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("resources")}
            className={`px-8 py-4 text-sm font-medium border-b-2 transition-all relative ${
              activeTab === "resources"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              الملفات ({currentVideoFiles.length + generalFiles.length})
            </span>
            {activeTab === "resources" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-8 ">
          {activeTab === "overview" && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Video Title Card */}
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-3 text-gray-900">
                  <div className="bg-gradient-to-br from-blue-100 to-indigo-100 p-2 rounded-xl">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                  </div>
                  {currentVideo?.title || "عنوان الدرس"}
                </h3>
                {currentVideo?.description && (
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap mt-4 text-lg">
                    {currentVideo.description}
                  </p>
                )}
              </div>

              {/* Course Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-white p-2 rounded-xl shadow-sm">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-xs font-medium text-blue-800 uppercase tracking-wide">
                      المدرب
                    </p>
                  </div>
                  <p className="font-bold text-gray-900 text-lg">
                    {course.instructor || "غير محدد"}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-white p-2 rounded-xl shadow-sm">
                      <BarChart3 className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-xs font-medium text-green-800 uppercase tracking-wide">
                      المستوى
                    </p>
                  </div>
                  <p className="font-bold text-gray-900 text-lg">
                    {course.level || "جميع المستويات"}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-white p-2 rounded-xl shadow-sm">
                      <Award className="w-5 h-5 text-purple-600" />
                    </div>
                    <p className="text-xs font-medium text-purple-800 uppercase tracking-wide">
                      التقدم
                    </p>
                  </div>
                  <p className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    {progress}%
                    <span className="text-sm font-normal text-gray-600">
                      ({completedVideos.size}/{allVideos.length})
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
          {activeTab === "resources" && (
            <div className="max-w-5xl mx-auto">
              {currentVideoFiles.length === 0 && generalFiles.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl shadow-md border border-gray-100">
                  <div className="bg-gray-50 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-12 h-12 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-lg font-medium">
                    لا توجد ملفات متاحة لهذا الدرس
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    سيتم إضافة الملفات والموارد هنا عند توفرها
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {currentVideoFiles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full"></div>
                        ملفات هذا الدرس
                      </h4>
                      <div className="space-y-3">
                        {currentVideoFiles.map((file) => (
                          <FileCard
                            key={file.id}
                            file={file}
                            onDownload={handleDownload}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {generalFiles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <div className="w-1 h-5 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full"></div>
                        ملفات عامة للدورة
                      </h4>
                      <div className="space-y-3">
                        {generalFiles.map((file) => (
                          <FileCard
                            key={file.id}
                            file={file}
                            onDownload={handleDownload}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f3f4f6; // track
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
  );
}

// --- File Card Component ---
function FileCard({
  file,
  onDownload,
}: {
  file: any;
  onDownload: (filename: string, originalName: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg hover:bg-gray-50 transition-colors mb-2">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {getFileIcon(file.originalName)}
        <div className="min-w-0">
          <p className="font-medium truncate">{file.originalName}</p>
          <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() =>
            window.open(
              `/api/files/view?filename=${encodeURIComponent(file.filename)}`,
              "_blank"
            )
          }
          className="p-2 text-blue-400 hover:bg-gray-700 rounded-lg transition"
          title="عرض"
        >
          <Eye className="w-5 h-5" />
        </button>
        <button
          onClick={() => onDownload(file.filename, file.originalName)}
          className="p-2 text-green-400 hover:bg-gray-700 rounded-lg transition"
          title="تحميل"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
