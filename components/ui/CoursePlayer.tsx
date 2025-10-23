"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import MuxPlayer from "@mux/mux-player-react";
import {
  Menu,
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
  List,
  BookOpen,
  ChevronLeft,
  Award,
  User,
  BarChart3,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Course } from "@/types/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
  return <FileText className={`w-5 h-5 ${colors[ext] || "text-gray-400"}`} />;
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [activeTab, setActiveTab] = useState<"overview" | "resources">(
    "overview"
  );
  const [completedVideos, setCompletedVideos] = useState<Set<string>>(
    new Set(userProgress?.filter((p) => p.completed).map((p) => p.videoId))
  );
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);

  // --- Organize Videos ---
  const videosBySections = useMemo(() => {
    const videos = (course?.videos || []).filter((v) => v.isVisible);
    const sections: Record<string, any[]> = {};

    videos.forEach((v) => {
      const section = v.section || "دروس الدورة";
      if (!sections[section]) sections[section] = [];
      sections[section].push(v);
    });

    // Sort videos within sections
    Object.keys(sections).forEach((section) => {
      sections[section].sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    return sections;
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
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  }, []);

  // ✅ Course stats
  const totalDuration = useMemo(() => {
    return allVideos.reduce((sum, v) => sum + (v.duration || 0), 0);
  }, [allVideos]);

  // --- UI ---
  return (
    <div
      className="flex h-screen bg-gray-950 text-white overflow-hidden"
      dir="rtl"
    >
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-80" : "w-0"
        } bg-gray-900 border-l border-gray-800 transition-all duration-300 overflow-hidden flex flex-col`}
      >
        {sidebarOpen && (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-lg">
                <List className="w-5 h-5 text-blue-400" />
                محتوى الدورة
              </h2>
              <button
                className="lg:hidden hover:bg-gray-800 p-1.5 rounded transition"
                onClick={() => setSidebarOpen(false)}
                aria-label="إغلاق القائمة"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Progress */}
            <div className="px-4 py-4 border-b border-gray-800">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-400">التقدم</span>
                <span className="text-blue-400 font-semibold">{progress}%</span>
              </div>
              <div className="bg-gray-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span>
                  {completedVideos.size} من {allVideos.length} درس
                </span>
                <span>{formatDuration(totalDuration)}</span>
              </div>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {Object.entries(videosBySections).map(([section, videos]) => (
                <div key={section} className="border-b border-gray-800">
                  <button
                    onClick={() => toggleSection(section)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-right">
                      <BookOpen className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-sm">{section}</span>
                      <span className="text-xs text-gray-500">
                        ({videos.length})
                      </span>
                    </div>
                    {expandedSections.has(section) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {/* Videos */}
                  {expandedSections.has(section) && (
                    <div className="space-y-0.5 bg-gray-950">
                      {videos.map((video) => {
                        const globalIndex = allVideos.findIndex(
                          (v) => v.videoId === video.videoId
                        );
                        const isActive = globalIndex === currentVideoIndex;
                        const isCompleted = completedVideos.has(video.videoId);
                        const isLocked =
                          !video.isFreePreview &&
                          !isEnrolled &&
                          course.price > 0;

                        return (
                          <button
                            key={video.videoId}
                            onClick={() => setCurrentVideoIndex(globalIndex)}
                            disabled={isLocked}
                            className={`w-full text-right px-5 py-3 flex items-center gap-3 transition-all ${
                              isActive
                                ? "bg-gray-800 border-r-2 border-blue-500"
                                : "hover:bg-gray-800/50"
                            } ${
                              isLocked ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          >
                            {isLocked ? (
                              <Lock className="w-4 h-4 text-gray-600" />
                            ) : isCompleted ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <PlayCircle
                                className={`w-4 h-4 ${
                                  isActive ? "text-blue-400" : "text-gray-500"
                                }`}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm truncate ${
                                  isActive
                                    ? "text-blue-400 font-medium"
                                    : "text-gray-200"
                                }`}
                              >
                                {video.title}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatDuration(video.duration)}</span>
                                {video.isFreePreview && (
                                  <>
                                    <span>•</span>
                                    <span className="text-green-400">
                                      مجاني
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-800 rounded-lg transition flex-shrink-0"
              aria-label={sidebarOpen ? "إغلاق القائمة" : "فتح القائمة"}
            >
              {sidebarOpen ? (
                <X className="w-5 h-5 text-gray-300" />
              ) : (
                <Menu className="w-5 h-5 text-gray-300" />
              )}
            </button>
            <div className="min-w-0">
              <h1 className="text-base lg:text-lg font-semibold truncate">
                {course.title}
              </h1>
              <p className="text-xs text-gray-400 truncate">
                {course.instructor || "مدرب غير معروف"} •{" "}
                {course.level || "جميع المستويات"}
              </p>
            </div>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="flex-shrink-0">
              <ChevronLeft className="w-4 h-4 ml-1" />
              العودة
            </Button>
          </Link>
        </header>

        {/* Video Player */}
        <div className="relative bg-black flex justify-center items-center">
          {isLoadingVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
          )}

          {videoError ? (
            <div className="aspect-video flex flex-col items-center justify-center text-center p-6">
              <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
              <p className="text-gray-300 mb-4">{videoError}</p>
              <Button onClick={() => setVideoError(null)} variant="outline">
                إعادة المحاولة
              </Button>
            </div>
          ) : currentVideo && canAccessVideo ? (
            <MuxPlayer
              playbackId={currentVideo.playbackId}
              streamType="on-demand"
              className="w-full"
              style={{ aspectRatio: "16/9", maxHeight: "70vh" }}
              onLoadStart={() => setIsLoadingVideo(true)}
              onLoadedData={() => setIsLoadingVideo(false)}
              onError={() => {
                setIsLoadingVideo(false);
                setVideoError("فشل تحميل الفيديو. يرجى المحاولة لاحقاً");
              }}
              onEnded={handleVideoComplete}
              metadata={{
                video_title: currentVideo.title,
                video_id: currentVideo.videoId,
              }}
            />
          ) : (
            <div className="aspect-video flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-gray-900 to-gray-950">
              <Lock className="w-16 h-16 mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold mb-2">محتوى مقفل</h3>
              <p className="text-gray-400 mb-4">
                {isEnrolled
                  ? "هذا الفيديو غير متاح حالياً"
                  : "قم بالتسجيل في الدورة للوصول إلى هذا المحتوى"}
              </p>
              {!isEnrolled && (
                <Link href={`/courses/${course.id}`}>
                  <Button>التسجيل في الدورة</Button>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Video Controls */}
        {currentVideo && canAccessVideo && (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Button
                onClick={goToPreviousVideo}
                disabled={currentVideoIndex === 0}
                variant="outline"
                size="sm"
              >
                <ChevronRight className="w-4 h-4" />
                السابق
              </Button>
              <Button
                onClick={goToNextVideo}
                disabled={currentVideoIndex === allVideos.length - 1}
                variant="outline"
                size="sm"
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
                className="bg-green-600 hover:bg-green-700"
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
        <div className="bg-gray-900 flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === "overview"
                ? "text-blue-400 border-blue-500"
                : "text-gray-400 border-transparent hover:text-white"
            }`}
          >
            نظرة عامة
          </button>
          <button
            onClick={() => setActiveTab("resources")}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === "resources"
                ? "text-blue-400 border-blue-500"
                : "text-gray-400 border-transparent hover:text-white"
            }`}
          >
            الملفات ({currentVideoFiles.length + generalFiles.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === "overview" && (
            <div className="max-w-4xl">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                {currentVideo?.title || "عنوان الدرس"}
              </h3>

              {/* Video Description */}
              <div className="bg-gray-900 rounded-lg p-6 mb-6">
                <h4 className="font-medium mb-3 text-gray-300">وصف الدرس</h4>
                <p className="text-gray-400 leading-relaxed whitespace-pre-wrap">
                  {currentVideo?.description || "لا يوجد وصف لهذا الدرس"}
                </p>
              </div>

              {/* Course Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900 rounded-lg p-4 flex items-center gap-3">
                  <User className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-xs text-gray-500">المدرب</p>
                    <p className="font-medium">
                      {course.instructor || "غير محدد"}
                    </p>
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-xs text-gray-500">المستوى</p>
                    <p className="font-medium">
                      {course.level || "جميع المستويات"}
                    </p>
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 flex items-center gap-3">
                  <Award className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-xs text-gray-500">التقدم</p>
                    <p className="font-medium">{progress}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "resources" && (
            <div className="max-w-4xl">
              {currentVideoFiles.length === 0 && generalFiles.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500">
                    لا توجد ملفات متاحة لهذا الدرس
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentVideoFiles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-3">
                        ملفات هذا الدرس
                      </h4>
                      {currentVideoFiles.map((file) => (
                        <FileCard
                          key={file.id}
                          file={file}
                          onDownload={handleDownload}
                        />
                      ))}
                    </div>
                  )}

                  {generalFiles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-3 mt-6">
                        ملفات عامة للدورة
                      </h4>
                      {generalFiles.map((file) => (
                        <FileCard
                          key={file.id}
                          file={file}
                          onDownload={handleDownload}
                        />
                      ))}
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
          background: #1f2937;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
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
    <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors mb-2">
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
