"use client";
import React, { useState, useMemo } from "react";
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
  Gift,
} from "lucide-react";
import { Course } from "@/types/types";

// Helper to format duration
function formatDuration(seconds: number) {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Helper to format file size
function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 بايت";
  const k = 1024;
  const sizes = ["بايت", "كيلو بايت", "ميجا بايت", "جيجا بايت"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Get file icon based on type
function getFileIcon(filename: string) {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const colors: Record<string, string> = {
    pdf: "text-red-500",
    doc: "text-blue-500",
    docx: "text-blue-500",
    zip: "text-purple-500",
    mp4: "text-green-500",
    mp3: "text-orange-500",
  };
  return <FileText className={`w-5 h-5 ${colors[ext] || "text-gray-500"}`} />;
}

export default function CoursePlayer({
  course,
  isEnrolled = true,
}: {
  course: Course;
  isEnrolled?: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["محتوى الدورة"]) // ✅ Match the default section name
  );
  const [activeTab, setActiveTab] = useState("overview");
  const [completedVideos, setCompletedVideos] = useState(new Set());

  // Organize videos by section
  const videosBySections = useMemo(() => {
    const videos = (course?.videos || []).filter(
      (video) => video.isVisible == true
    );
    const sections: Record<string, any[]> = {};

    videos.forEach((video) => {
      const sectionName = video.section || "محتوى الدورة";
      if (!sections[sectionName]) {
        sections[sectionName] = [];
      }
      sections[sectionName].push(video);
    });
    // Sort videos within each section by order
    Object.keys(sections).forEach((section) => {
      sections[section].sort((a, b) => (a.order || 0) - (b.order || 0));
    });
    // Remove empty sections
    Object.keys(sections).forEach((section) => {
      if (sections[section].length === 0) {
        delete sections[section];
      }
    });

    return sections;
  }, [course?.videos]);

  // Get all videos in order
  const allVideos = useMemo(() => {
    return Object.values(videosBySections).flat();
  }, [videosBySections]);

  const currentVideo = allVideos[currentVideoIndex];
  const canAccessVideo = useMemo(() => {
    if (!currentVideo) return false;

    // First check: Is the video visible to students?
    if (currentVideo.isVisible !== true) return false;

    // Then check access permissions:
    if (currentVideo.isFreePreview === true) return true;
    if (course.price === 0) return true;
    if (isEnrolled === true) return true;

    return false;
  }, [currentVideo, course.price, isEnrolled]);
  // Get files related to current video
  const currentVideoFiles = useMemo(() => {
    if (!currentVideo || !course?.files) return [];
    return course.files.filter(
      (f) => f.relatedVideoId === currentVideo.videoId
    );
  }, [currentVideo, course?.files]);

  // Get general course files
  const generalFiles = useMemo(() => {
    if (!course?.files) return [];
    return course.files.filter((f) => !f.relatedVideoId);
  }, [course?.files]);

  // Toggle section
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  // Play specific video
  const playVideo = (videoIndex: number) => {
    setCurrentVideoIndex(videoIndex);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // Mark video as complete
  const toggleComplete = (videoId: string) => {
    setCompletedVideos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  // Play next video
  const playNext = () => {
    if (currentVideoIndex < allVideos.length - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    }
  };

  // Calculate progress
  const progress = useMemo(() => {
    if (allVideos.length === 0) return 0;
    return Math.round((completedVideos.size / allVideos.length) * 100);
  }, [completedVideos.size, allVideos.length]);

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (!isEnrolled) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <Lock className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h2 className="text-2xl font-bold mb-2">هذه الدورة غير متاحة</h2>
          <p className="text-gray-400">يجب التسجيل في الدورة لمشاهدة المحتوى</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden" dir="rtl">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              {sidebarOpen ? (
                <X className="w-5 h-5 text-white" />
              ) : (
                <Menu className="w-5 h-5 text-white" />
              )}
            </button>
            <h1 className="text-white font-semibold text-lg line-clamp-1">
              {course.title}
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span>{progress}%</span>
            </div>
          </div>
        </div>

        {/* Video Player */}
        {/* Video Player */}
        {currentVideo ? (
          <div className="bg-black">
            {canAccessVideo ? (
              <MuxPlayer
                playbackId={currentVideo.playbackId}
                streamType="on-demand"
                metadata={{
                  video_id: currentVideo.videoId,
                  video_title: currentVideo.title,
                }}
                className="w-full"
                style={{ aspectRatio: "16/9" }}
                onEnded={() => {
                  toggleComplete(currentVideo.videoId);
                  playNext();
                }}
              />
            ) : (
              // Show locked state for videos that aren't accessible
              <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="relative z-10 text-center max-w-md px-6">
                  <div className="mb-6">
                    <Lock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-2xl font-bold text-white mb-2">
                      {course.price === 0 ? "يتطلب التسجيل" : "معاينة محدودة"}
                    </h3>
                    <p className="text-gray-300 leading-relaxed">
                      {course.price === 0
                        ? "هذه الدورة مجانية! قم بالتسجيل للوصول إلى جميع الفيديوهات"
                        : "هذا الفيديو متاح للمشتركين فقط. قم بشراء الدورة للوصول إلى المحتوى كاملاً"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-video bg-gray-800 flex items-center justify-center">
            <p className="text-gray-400">لا يوجد فيديو للعرض</p>
          </div>
        )}

        {/* Content Tabs & Info */}
        <div className="flex-1 overflow-y-auto bg-gray-900 text-white">
          {/* Video Title & Actions */}
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">
                  {currentVideo?.title}
                </h2>
                {currentVideo?.section && (
                  <p className="text-sm text-gray-400">
                    القسم: {currentVideo.section}
                  </p>
                )}
              </div>
              <button
                onClick={() => toggleComplete(currentVideo?.videoId)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  completedVideos.has(currentVideo?.videoId)
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
              >
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">
                  {completedVideos.has(currentVideo?.videoId)
                    ? "تم الإكمال"
                    : "وضع علامة كمكتمل"}
                </span>
              </button>
            </div>

            {/* Video Meta */}
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{formatDuration(currentVideo?.duration)}</span>
              </div>
              <span>•</span>
              <span>
                فيديو {currentVideoIndex + 1} من {allVideos.length}
              </span>
              {currentVideo?.isFreePreview && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1 text-green-400">
                    <Gift className="w-4 h-4" />
                    <span>معاينة مجانية</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-800">
            <div className="flex gap-1 px-6">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === "overview"
                    ? "border-blue-500 text-blue-500"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                نظرة عامة
              </button>
              <button
                onClick={() => setActiveTab("resources")}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === "resources"
                    ? "border-blue-500 text-blue-500"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                الملفات ({currentVideoFiles.length + generalFiles.length})
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "overview" && (
              <div className="space-y-4">
                {currentVideo?.description ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      عن هذا الفيديو
                    </h3>
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {currentVideo.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500">لا يوجد وصف لهذا الفيديو</p>
                )}
              </div>
            )}

            {activeTab === "resources" && (
              <div className="space-y-6">
                {/* Video-specific files */}
                {currentVideoFiles.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      ملفات هذا الفيديو
                    </h3>
                    <div className="space-y-2">
                      {currentVideoFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            {getFileIcon(file.originalName)}
                            <div>
                              <p className="font-medium">{file.originalName}</p>
                              <p className="text-sm text-gray-400">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                window.open(
                                  `/api/files/view?filename=${file.filename}`,
                                  "_blank"
                                )
                              }
                              className="p-2 text-blue-400 hover:bg-gray-700 rounded-lg transition-colors"
                              title="عرض"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => {
                                const link = document.createElement("a");
                                link.href = `/api/files/download?filename=${file.filename}`;
                                link.download = file.originalName;
                                link.click();
                              }}
                              className="p-2 text-green-400 hover:bg-gray-700 rounded-lg transition-colors"
                              title="تحميل"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* General course files */}
                {generalFiles.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      ملفات الدورة العامة
                    </h3>
                    <div className="space-y-2">
                      {generalFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            {getFileIcon(file.originalName)}
                            <div>
                              <p className="font-medium">{file.originalName}</p>
                              <p className="text-sm text-gray-400">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                window.open(
                                  `/api/files/view?filename=${file.filename}`,
                                  "_blank"
                                )
                              }
                              className="p-2 text-blue-400 hover:bg-gray-700 rounded-lg transition-colors"
                              title="عرض"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => {
                                const link = document.createElement("a");
                                link.href = `/api/files/download?filename=${file.filename}`;
                                link.download = file.originalName;
                                link.click();
                              }}
                              className="p-2 text-green-400 hover:bg-gray-700 rounded-lg transition-colors"
                              title="تحميل"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentVideoFiles.length === 0 &&
                  generalFiles.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                      <p className="text-gray-500">لا توجد ملفات متاحة</p>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Curriculum Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-full lg:w-96" : "w-0"
        } bg-gray-800 border-l border-gray-700 overflow-hidden transition-all duration-300 flex flex-col absolute lg:relative inset-y-0 left-0 z-50`}
      >
        {sidebarOpen && (
          <>
            {/* Sidebar Header */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <List className="w-5 h-5" />
                  محتوى الدورة
                </h3>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-1 hover:bg-gray-700 rounded"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="text-sm text-gray-400">
                {completedVideos.size} من {allVideos.length} مكتمل
              </div>
            </div>

            {/* Video List */}
            <div className="flex-1 overflow-y-auto">
              {Object.entries(videosBySections).map(([section, videos]) => (
                <div key={section} className="border-b border-gray-700">
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(section)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-750 transition-colors text-right"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <BookOpen className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="font-medium text-white">{section}</p>
                        <p className="text-xs text-gray-400">
                          {videos.length} فيديو •{" "}
                          {formatDuration(
                            videos.reduce(
                              (sum, v) => sum + (v.duration || 0),
                              0
                            )
                          )}
                        </p>
                      </div>
                    </div>
                    {expandedSections.has(section) ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {/* Videos in Section */}
                  {/* Videos in Section */}
                  {expandedSections.has(section) && (
                    <div>
                      {/* Video List */}
                      {videos.map((video) => {
                        const globalIndex = allVideos.findIndex(
                          (v) => v.videoId === video.videoId
                        );
                        const isActive = globalIndex === currentVideoIndex;
                        const isCompleted = completedVideos.has(video.videoId);

                        return (
                          <button
                            key={video.videoId}
                            onClick={() => playVideo(globalIndex)}
                            className={`w-full p-4 flex items-start gap-3 hover:bg-gray-750 transition-colors border-r-4 ${
                              isActive
                                ? "bg-gray-750 border-blue-500"
                                : "border-transparent"
                            }`}
                          >
                            <div className="flex-shrink-0 mt-1">
                              {isCompleted ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : isActive ? (
                                <PlayCircle className="w-5 h-5 text-blue-500" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                              )}
                            </div>
                            <div className="flex-1 text-right">
                              <p
                                className={`text-sm font-medium ${
                                  isActive ? "text-blue-400" : "text-white"
                                }`}
                              >
                                {video.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
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

                      {/* ✅ Resources Section */}
                      {(() => {
                        // Get files related to videos in this section
                        const sectionFiles =
                          course?.files?.filter((file) =>
                            videos.some(
                              (v) => v.videoId === file.relatedVideoId
                            )
                          ) || [];

                        if (sectionFiles.length === 0) return null;

                        return (
                          <div className="border-t border-gray-700 bg-gray-800/50">
                            {/* Resources Header */}
                            <div className="p-4 flex items-center gap-3">
                              <FileText className="w-5 h-5 text-purple-400" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-white">
                                  الموارد والملفات
                                </p>
                                <p className="text-xs text-gray-400">
                                  {sectionFiles.length} ملف
                                </p>
                              </div>
                            </div>

                            {/* Files List */}
                            <div className="px-4 pb-4 space-y-2">
                              {sectionFiles.map((file) => (
                                <div
                                  key={file.id}
                                  className="flex items-center gap-3 p-3 bg-gray-750 rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                  {getFileIcon(file.originalName)}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">
                                      {file.originalName}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      {formatFileSize(file.size)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(
                                          `/api/files/view?filename=${file.filename}`,
                                          "_blank"
                                        );
                                      }}
                                      className="p-1.5 text-blue-400 hover:bg-gray-600 rounded transition-colors"
                                      title="عرض"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const link =
                                          document.createElement("a");
                                        link.href = `/api/files/download?filename=${file.filename}`;
                                        link.download = file.originalName;
                                        link.click();
                                      }}
                                      className="p-1.5 text-green-400 hover:bg-gray-600 rounded transition-colors"
                                      title="تحميل"
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
