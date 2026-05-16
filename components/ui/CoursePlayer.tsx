"use client";
import "@mux/mux-player/themes/minimal";

import React, { useState, useMemo, useCallback, useEffect } from "react";
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
  List,
} from "lucide-react";
import { Course } from "@/types/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { translateLevel } from "@/utils/translation";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useVideoProtection } from "@/hooks/useVideoProtection";
import { useAuth } from "@/context/authContext";
import VideoWatermark from "../VideoWatermark";
import {
  downloadCourseFile,
  viewCourseFile,
} from "@/app/actions/upload_File_actions";
import { CourseFile } from "../fileUplaodtoR2";
import { saveVideoProgress } from "@/app/actions/progress_actions";
import { groupVideosBySection } from "@/lib/sectional/grouping";
import { isVideoLockedForUser } from "@/lib/sectional/access";

// Sentinel React key used for the synthetic "unassigned" bucket, since
// GroupedSection.sectionId is `null` there.
const UNASSIGNED_KEY = "__unassigned__";

// --- Types ---
interface VideoProgress {
  videoId: string;
  completed: boolean;
  watchedSeconds: number;
}

// --- Helpers ---
function formatDuration(seconds: number | undefined) {
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
// Phase 6a: consumes `accessScope` + `ownedSectionIds` via
// `isVideoLockedForUser` so sectional buyers see correct lock states. The
// Mux token route is still the source of truth — these props only drive
// the UI's lock affordances.
export default function CoursePlayer({
  course,
  isEnrolled = false,
  userProgress = [],
  onProgressUpdate,
  accessScope,
  ownedSectionIds,
}: {
  course: Course;
  isEnrolled?: boolean;
  userProgress?: VideoProgress[];
  onProgressUpdate?: (videoId: string, completed: boolean) => Promise<void>;
  accessScope?: "full" | "sectional";
  ownedSectionIds?: string[];
}) {
  const searchParams = useSearchParams();
  const { videoContainerProps } = useVideoProtection({
    onScreenCaptureDetected: () => {
      toast.error("⚠️ Warning", {
        description: "Screen recording attempt detected.",
        duration: 3000,
      });
    },
    enableContextMenu: false,
  });
  const auth = useAuth();
  const watermarkText =
    auth?.user?.email || auth?.user?.displayName || "ReadIQ - اقْرَأْ";

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");

    if (paymentStatus === "success") {
      toast.success("تم الدفع بنجاح! 🎉", {
        description: "مرحباً بك في الدورة! يمكنك الآن الوصول إلى جميع الدروس.",
        duration: 5000,
      });

      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);
  useEffect(() => {
    if (userProgress && userProgress.length > 0) {
      const completed = new Set(
        userProgress.filter((v) => v.completed).map((v) => v.videoId),
      );
      setCompletedVideos(completed);
    }
  }, [userProgress]);

  // State
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const [activeTab, setActiveTab] = useState<"sections" | "resources">(
    "sections",
  );
  const [completedVideos, setCompletedVideos] = useState<Set<string>>(
    new Set(),
  );

  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);

  // Signed playback token state. Kept separate from videoError /
  // isLoadingVideo so token-mint failures stay distinguishable from
  // playback failures during the 3.5 rollout.
  const [playbackToken, setPlaybackToken] = useState<string | null>(null);
  const [thumbnailToken, setThumbnailToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenRetryCount, setTokenRetryCount] = useState(0);

  // --- Organize Videos ---
  // Filter to visible videos first, then group by section. Preserve the
  // legacy `v.isVisible` truthy filter exactly (treats `undefined` as
  // hidden) to avoid accidentally surfacing videos that were previously
  // hidden in the player.
  const groupedSections = useMemo(() => {
    const visibleVideos = (course?.videos || []).filter((v) => v.isVisible);
    return groupVideosBySection({
      sections: course?.sections,
      videos: visibleVideos,
    }).filter((g) => g.videos.length > 0);
  }, [course?.videos, course?.sections]);

  const allVideos = useMemo(
    () => groupedSections.flatMap((g) => g.videos),
    [groupedSections],
  );

  const currentVideo = allVideos[currentVideoIndex];

  const canAccessVideo = useMemo(() => {
    if (!currentVideo) return false;
    return !isVideoLockedForUser(currentVideo, course, {
      isEnrolled,
      accessScope,
      ownedSectionIds,
    });
  }, [currentVideo, course, isEnrolled, accessScope, ownedSectionIds]);

  const currentVideoFiles = useMemo(() => {
    return (
      course?.files?.filter(
        (f) => f.relatedVideoId === currentVideo?.videoId,
      ) || []
    );
  }, [course?.files, currentVideo]);

  const generalFiles = useMemo(() => {
    return course?.files?.filter((f) => !f.relatedVideoId) || [];
  }, [course?.files]);

  const progress = useMemo(() => {
    if (!allVideos.length) return 0;
    const completed = allVideos.filter((v) =>
      completedVideos.has(v.videoId),
    ).length;
    return Math.round((completed / allVideos.length) * 100);
  }, [completedVideos, allVideos]);

  useEffect(() => {
    if (!currentVideo) return;
    const containingGroup = groupedSections.find((g) =>
      g.videos.some((v) => v.videoId === currentVideo.videoId),
    );
    if (!containingGroup) return;
    const key = containingGroup.sectionId ?? UNASSIGNED_KEY;
    setExpandedSections((prev) =>
      prev.has(key) ? prev : new Set(prev).add(key),
    );
  }, [currentVideo, groupedSections]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const watermark = document.querySelector(
        ".watermark-container",
      ) as HTMLElement;

      if (!watermark) return;

      const fullscreenElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement;

      if (fullscreenElement) {
        fullscreenElement.appendChild(watermark);
        watermark.style.position = "fixed";
        watermark.style.bottom = "6rem";
        watermark.style.right = "2rem";
        watermark.style.zIndex = "2147483647";
      } else {
        const videoContainer = document.querySelector(".video-container");
        if (videoContainer) {
          videoContainer.appendChild(watermark);
          watermark.style.position = "absolute";
          watermark.style.bottom = "1.5rem";
          watermark.style.right = "1.5rem";
          watermark.style.zIndex = "50";
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange,
      );
    };
  }, []);

  // Mint a signed playback JWT whenever the active lesson changes.
  // Keyed on videoId (stable lesson identity), not playbackId (derived
  // asset reference). AbortController prevents stale tokens from a slow
  // request landing after the user has clicked a different lesson.
  useEffect(() => {
    if (!currentVideo || !auth?.user || !canAccessVideo) {
      setPlaybackToken(null);
      setThumbnailToken(null);
      setTokenError(null);
      setTokenLoading(false);
      return;
    }

    if (!currentVideo.playbackId) {
      setPlaybackToken(null);
      setThumbnailToken(null);
      setTokenError(null);
      setTokenLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    setTokenLoading(true);
    setTokenError(null);
    setPlaybackToken(null);
    setThumbnailToken(null);

    (async () => {
      try {
        const idToken = await auth.user!.getIdToken(true);
        const res = await fetch("/api/mux/playback-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            videoId: currentVideo.videoId,
            courseId: course.id,
          }),
          signal: controller.signal,
        });

        const json = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok || !json?.success || !json?.data?.token) {
          const message =
            json?.error?.message || "تعذّر تحميل الفيديو. حاول مرة أخرى.";
          setTokenError(message);
          setTokenLoading(false);
          return;
        }

        setPlaybackToken(json.data.token);
        setThumbnailToken(json.data.thumbnailToken ?? null);
        setTokenLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setTokenError(
          err instanceof Error ? err.message : "حدث خطأ غير متوقع",
        );
        setTokenLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentVideo?.videoId,
    canAccessVideo,
    course.id,
    auth?.user,
    tokenRetryCount,
  ]);

  const handleVideoComplete = useCallback(async () => {
    if (
      !currentVideo ||
      !auth?.user ||
      completedVideos.has(currentVideo.videoId)
    ) {
      return;
    }

    // Update local state immediately
    setCompletedVideos((prev) => new Set(prev).add(currentVideo.videoId));

    // Save to Firebase
    try {
      const token = await auth.user.getIdToken(true); // Force refresh token

      await saveVideoProgress(
        course.id,
        currentVideo.videoId,
        currentVideo.duration || 0, // watched full duration
        true, // completed
        token,
      );

      console.log("✅ Progress saved to Firebase");
    } catch (error) {
      console.error("❌ Failed to save progress:", error);
      // Don't remove from local state even if save fails
      // User still sees it as complete
    }
  }, [currentVideo, completedVideos, auth, course.id]);

  const handleMarkComplete = async () => {
    if (!currentVideo) return;
    setMarkingComplete(true);
    await handleVideoComplete();
    setMarkingComplete(false);
  };

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

  const totalDuration = useMemo(() => {
    return allVideos.reduce((sum, v) => sum + (v.duration || 0), 0);
  }, [allVideos]);

  // Sections Component (reusable for both sidebar and mobile tab)
  const SectionsContent = () => (
    <div className="divide-y divide-gray-200">
      {groupedSections.map((group) => {
        const sectionKey = group.sectionId ?? UNASSIGNED_KEY;
        const videos = group.videos;
        const isExpanded = expandedSections.has(sectionKey);
        const sectionCompleted = videos.filter((v) =>
          completedVideos.has(v.videoId),
        ).length;
        const sectionProgress = Math.round(
          (sectionCompleted / videos.length) * 100,
        );

        return (
          <div key={sectionKey} className="bg-gray-50/30">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(sectionKey)}
              className="w-full p-3 lg:p-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 lg:gap-3">
                <div
                  className={`p-1.5 lg:p-2 rounded-lg ${
                    isExpanded ? "bg-blue-100" : "bg-gray-100"
                  } transition-colors`}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-600" />
                  ) : (
                    <ChevronLeft className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-gray-600" />
                  )}
                </div>
                <div className="text-right">
                  <h3 className="font-semibold text-sm lg:text-base text-gray-900">
                    {group.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {videos.length} دروس • {sectionCompleted} مكتمل
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-10 h-10 lg:w-12 lg:h-12 relative">
                  <svg className="w-10 h-10 lg:w-12 lg:h-12 transform -rotate-90">
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      className="text-gray-200 lg:hidden"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      className="text-gray-200 hidden lg:block"
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 16}`}
                      strokeDashoffset={`${
                        2 * Math.PI * 16 * (1 - sectionProgress / 100)
                      }`}
                      className="text-blue-600 transition-all duration-500 lg:hidden"
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
                      className="text-blue-600 transition-all duration-500 hidden lg:block"
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
                  const isCompleted = completedVideos.has(video.videoId);
                  const isLocked = isVideoLockedForUser(video, course, {
                    isEnrolled,
                    accessScope,
                    ownedSectionIds,
                  });

                  return (
                    <button
                      key={video.videoId}
                      onClick={() => {
                        if (!isLocked) {
                          setCurrentVideoIndex(videoIndex);
                          setVideoError(null);
                          // Switch to sections tab on mobile when video is selected
                          if (window.innerWidth < 1024) {
                            setActiveTab("sections");
                          }
                        }
                      }}
                      disabled={isLocked}
                      className={`w-full p-3 lg:p-4 flex items-center gap-2 lg:gap-3 transition-all border-b border-gray-100 last:border-b-0 ${
                        isActive
                          ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-r-4 border-blue-600"
                          : "hover:bg-gray-50"
                      } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div
                        className={`flex-shrink-0 w-8 h-8 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center font-bold text-xs lg:text-sm transition-all ${
                          isCompleted
                            ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white"
                            : isActive
                              ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {isLocked ? (
                          <Lock className="w-4 h-4 lg:w-5 lg:h-5" />
                        ) : isCompleted ? (
                          <CheckCircle className="w-4 h-4 lg:w-5 lg:h-5" />
                        ) : (
                          idx + 1
                        )}
                      </div>

                      <div className="flex-1 text-right min-w-0">
                        <p
                          className={`font-medium text-sm lg:text-base truncate ${
                            isActive ? "text-blue-900" : "text-gray-900"
                          }`}
                        >
                          {video.title}
                        </p>
                        <div className="flex items-center gap-2 lg:gap-3 mt-1">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(video.duration)}
                          </span>
                          {video.isFreePreview && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 lg:px-2 py-0.5 rounded-full font-medium">
                              معاينة مجانية
                            </span>
                          )}
                        </div>
                      </div>

                      {isActive && !isLocked && (
                        <PlayCircle className="w-4 h-4 lg:w-5 lg:h-5 text-blue-600 flex-shrink-0 animate-pulse" />
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
  );

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900" dir="rtl">
      {/* Desktop Sidebar - Hidden on mobile/tablet */}
      <aside className="hidden lg:block lg:sticky top-0 h-screen w-96 border-l border-gray-200 backdrop-blur-xl">
        <div className="flex flex-col h-full bg-white">
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
              </div>
            </div>
          </div>

          {/* Scrollable Sections */}
          <div className="flex-1 overflow-y-auto custom-scrollbar border-t border-gray-200 bg-white">
            <SectionsContent />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-3 lg:px-4 py-2 lg:py-3 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
            <div className="min-w-0">
              <h1 className="text-sm lg:text-lg font-semibold truncate">
                {course.title}
              </h1>
              <p className="hidden sm:inline-flex mt-1 items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-slate-100 to-gray-100 border border-slate-200 text-slate-700 text-xs font-medium max-w-fit">
                <User className="w-3 h-3 text-slate-500" />
                <span className="truncate max-w-[220px]">
                  {course.instructorName || "مدرب غير معروف"}
                </span>
              </p>
            </div>
          </div>
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0 text-xs lg:text-sm"
            >
              <ChevronLeft className="w-3 h-3 lg:w-4 lg:h-4 ml-1" />
              <span className="hidden sm:inline">العودة</span>
            </Button>
          </Link>
        </header>

        {/* Video Player */}
        <div
          className="relative bg-black flex justify-center items-center min-h-[250px] sm:min-h-[400px]"
          {...videoContainerProps}
        >
          {/* Loading State */}
          {isLoadingVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <Loader2 className="w-8 h-8 lg:w-12 lg:h-12 text-blue-500 animate-spin" />
            </div>
          )}

          {/* Error State */}
          {videoError && (
            <div className="aspect-video flex flex-col items-center justify-center text-center p-4 lg:p-6">
              <AlertCircle className="w-12 h-12 lg:w-16 lg:h-16 text-red-500 mb-4" />
              <p className="text-white mb-4 text-sm lg:text-base">
                {videoError}
              </p>
              <Button
                onClick={() => {
                  setVideoError(null);
                  setIsLoadingVideo(false);
                }}
                variant="outline"
                size="sm"
                className="text-white border-white hover:bg-white/10"
              >
                إعادة المحاولة
              </Button>
            </div>
          )}

          {/* Video Player */}
          {!videoError && currentVideo && canAccessVideo && (
            <>
              {/* playbackId is the canonical Mux asset reference for this file. */}
              {!currentVideo.playbackId ? (
                <div className="aspect-video flex flex-col items-center justify-center text-center p-4 lg:p-6">
                  <AlertCircle className="w-12 h-12 lg:w-16 lg:h-16 text-yellow-500 mb-4" />
                  <h3 className="text-lg lg:text-xl font-semibold text-white mb-2">
                    معرف الفيديو مفقود
                  </h3>
                  <p className="text-sm lg:text-base text-gray-400">
                    لم يتم العثور على معرف Mux لهذا الفيديو
                  </p>
                </div>
              ) : (
                <div className="relative w-full aspect-video video-container">
                  {tokenLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                      <Loader2 className="w-8 h-8 lg:w-12 lg:h-12 text-blue-500 animate-spin" />
                    </div>
                  )}

                  {tokenError && !tokenLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 lg:p-6 bg-black z-10">
                      <AlertCircle className="w-12 h-12 lg:w-16 lg:h-16 text-red-500 mb-4" />
                      <p className="text-white mb-4 text-sm lg:text-base">
                        {tokenError}
                      </p>
                      <Button
                        onClick={() => setTokenRetryCount((n) => n + 1)}
                        variant="outline"
                        size="sm"
                        className="text-white border-white hover:bg-white/10"
                      >
                        إعادة المحاولة
                      </Button>
                    </div>
                  )}

                  {!tokenLoading && !tokenError && playbackToken && (
                    <MuxPlayer
                      key={currentVideo.videoId}
                      playbackId={currentVideo.playbackId}
                      tokens={{
                        playback: playbackToken,
                        thumbnail: thumbnailToken ?? undefined,
                      }}
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

                  {isEnrolled && <VideoWatermark text={watermarkText} />}
                </div>
              )}
            </>
          )}

          {/* Locked Content */}
          {!videoError && currentVideo && !canAccessVideo && (() => {
            // Sectional-locked: enrolled with sectional scope, but this
            // video's section is not in ownedSectionIds. Distinct headline
            // so the user knows it's a section to buy, not "log in / pay".
            const sectionalLock =
              isEnrolled &&
              accessScope === "sectional" &&
              typeof currentVideo.sectionId === "string" &&
              !(ownedSectionIds ?? []).includes(currentVideo.sectionId);

            return (
              <div className="aspect-video flex flex-col items-center justify-center text-center p-4 lg:p-6 bg-gradient-to-br from-gray-100 to-gray-200">
                <Lock className="w-12 h-12 lg:w-16 lg:h-16 mb-4 text-gray-400" />
                <h3 className="text-lg lg:text-xl font-semibold mb-2 text-gray-900">
                  {sectionalLock ? "هذا القسم غير مشترى بعد" : "محتوى مقفل"}
                </h3>
                <p className="text-sm lg:text-base text-gray-600 mb-4">
                  {sectionalLock
                    ? "لم تقم بشراء هذا القسم بعد."
                    : isEnrolled
                    ? "هذا الفيديو غير متاح حالياً"
                    : "قم بالتسجيل في الدورة للوصول إلى هذا المحتوى"}
                </p>
                {!isEnrolled && (
                  <Link href={`/courses/${course.id}`}>
                    <Button className="bg-blue-600 hover:bg-blue-700" size="sm">
                      التسجيل في الدورة
                    </Button>
                  </Link>
                )}
              </div>
            );
          })()}

          {/* No Video Selected */}
          {!currentVideo && (
            <div className="aspect-video flex flex-col items-center justify-center text-center p-4 lg:p-6">
              <PlayCircle className="w-12 h-12 lg:w-16 lg:h-16 mb-4 text-gray-400" />
              <p className="text-sm lg:text-base text-gray-400">
                اختر درساً من القائمة لبدء المشاهدة
              </p>
            </div>
          )}
        </div>

        {/* Video Controls */}
        {currentVideo && canAccessVideo && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 px-3 lg:px-6 py-3 lg:py-4 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
            <div className="flex items-center justify-center gap-2">
              <Button
                onClick={goToPreviousVideo}
                disabled={currentVideoIndex === 0}
                variant="outline"
                size="sm"
                className="hover:bg-blue-50 hover:border-blue-300 transition-all flex-1 sm:flex-none"
              >
                <ChevronRight className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                <span className="text-xs lg:text-sm">السابق</span>
              </Button>
              <Button
                onClick={goToNextVideo}
                disabled={currentVideoIndex === allVideos.length - 1}
                variant="outline"
                size="sm"
                className="hover:bg-blue-50 hover:border-blue-300 transition-all flex-1 sm:flex-none"
              >
                <span className="text-xs lg:text-sm">التالي</span>
                <ChevronLeft className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </Button>
            </div>
            {!completedVideos.has(currentVideo.videoId) && (
              <Button
                onClick={handleMarkComplete}
                disabled={markingComplete}
                size="sm"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md hover:shadow-lg transition-all w-full sm:w-auto"
              >
                {markingComplete ? (
                  <Loader2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 animate-spin ml-2" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 lg:w-4 lg:h-4 ml-2" />
                )}
                <span className="text-xs lg:text-sm">تحديد كمكتمل</span>
              </Button>
            )}
          </div>
        )}

        {/* Video Title & Description - Mobile/Tablet Only */}
        <div className="lg:hidden bg-white border-b border-gray-200 p-4">
          <h3 className="text-base font-bold mb-2 text-gray-900">
            {currentVideo?.title || "عنوان الدرس"}
          </h3>
          {currentVideo?.description && (
            <p className="text-sm text-gray-600 leading-relaxed">
              {currentVideo.description}
            </p>
          )}
        </div>

        {/* Tabs - Different layout for mobile vs desktop */}
        <div className="bg-white/80 backdrop-blur-xl flex border-b border-gray-200/50">
          {/* Mobile/Tablet: Sections + Resources */}
          <button
            onClick={() => setActiveTab("sections")}
            className={`lg:hidden flex-1 px-4 py-3 text-xs font-medium border-b-2 transition-all relative ${
              activeTab === "sections"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <List className="w-3.5 h-3.5" />
              الأقسام
            </span>
            {activeTab === "sections" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
            )}
          </button>

          <button
            onClick={() => setActiveTab("resources")}
            className={`flex-1 px-4 lg:px-8 py-3 lg:py-4 text-xs lg:text-sm font-medium border-b-2 transition-all relative ${
              activeTab === "resources"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5 lg:gap-2">
              <FileText className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              الملفات ({currentVideoFiles.length + generalFiles.length})
            </span>
            {activeTab === "resources" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Sections Tab - Mobile/Tablet Only */}
          {activeTab === "sections" && (
            <div className="lg:hidden">
              <SectionsContent />
            </div>
          )}

          {/* Resources Tab */}
          {activeTab === "resources" && (
            <div className="p-4 lg:p-8">
              <div className="max-w-5xl mx-auto">
                {currentVideoFiles.length === 0 && generalFiles.length === 0 ? (
                  <div className="text-center py-12 lg:py-16 bg-white rounded-xl lg:rounded-2xl shadow-md border border-gray-100">
                    <div className="bg-gray-50 rounded-full w-16 h-16 lg:w-24 lg:h-24 flex items-center justify-center mx-auto mb-3 lg:mb-4">
                      <FileText className="w-8 h-8 lg:w-12 lg:h-12 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-base lg:text-lg font-medium">
                      لا توجد ملفات متاحة لهذا الدرس
                    </p>
                    <p className="text-gray-400 text-xs lg:text-sm mt-2">
                      سيتم إضافة الملفات والموارد هنا عند توفرها
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 lg:space-y-6">
                    {currentVideoFiles.length > 0 && (
                      <div>
                        <h4 className="text-xs lg:text-sm font-semibold text-gray-700 mb-3 lg:mb-4 flex items-center gap-2">
                          <div className="w-1 h-4 lg:h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full"></div>
                          ملفات هذا الدرس
                        </h4>
                        <div className="space-y-2 lg:space-y-3">
                          {currentVideoFiles.map((file) => (
                            <FileCard
                              key={file.id}
                              file={file}
                              courseId={course.id}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {generalFiles.length > 0 && (
                      <div>
                        <h4 className="text-xs lg:text-sm font-semibold text-gray-700 mb-3 lg:mb-4 flex items-center gap-2">
                          <div className="w-1 h-4 lg:h-5 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full"></div>
                          ملفات عامة للدورة
                        </h4>
                        <div className="space-y-2 lg:space-y-3">
                          {generalFiles.map((file) => (
                            <FileCard
                              key={file.id}
                              file={file}
                              courseId={course.id}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
          background: #f3f4f6;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }

        /* Watermark in fullscreen */
        .video-container:fullscreen .watermark-container,
        .video-container:-webkit-full-screen .watermark-container,
        .video-container:-moz-full-screen .watermark-container {
          position: fixed !important;
          bottom: 4rem !important;
          right: 1.5rem !important;
          z-index: 2147483647 !important;
        }
      `}</style>
    </div>
  );
}

// --- File Card Component ---
function FileCard({ file, courseId }: { file: CourseFile; courseId: string }) {
  const auth = useAuth();

  const [error, setError] = useState<string>("");
  const [isViewing, setIsViewing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const viewFile = async (filename: string, originalName: string) => {
    if (!auth?.user) {
      toast.error("يرجى تسجيل الدخول لعرض الملفات");
      return;
    }

    setIsViewing(true);
    setError("");

    try {
      const token = await auth.user.getIdToken();

      const result = await viewCourseFile({
        filename,
        courseId,
        token,
      });

      if (result.success && result.url) {
        window.open(result.url, "_blank");
        toast.success("تم فتح الملف");
      } else {
        toast.error(result.error || "فشل في فتح الملف");
        setError(result.error || "فشل في فتح الملف");
      }
    } catch (error) {
      console.error("Error accessing file:", error);
      toast.error("حدث خطأ أثناء فتح الملف");
      setError("حدث خطأ أثناء فتح الملف");
    } finally {
      setIsViewing(false);
    }
  };

  const downloadFile = async (filename: string, originalName: string) => {
    if (!auth?.user) {
      toast.error("يرجى تسجيل الدخول لتحميل الملفات");
      return;
    }

    setIsDownloading(true);
    setError("");

    try {
      const token = await auth.user.getIdToken();

      const result = await downloadCourseFile({
        filename,
        courseId,
        token,
      });

      if (result.success && result.url) {
        const link = document.createElement("a");
        link.href = result.url;
        link.download = originalName;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("تم بدء التحميل");
      } else {
        toast.error(result.error || "فشل في تحميل الملف");
        setError(result.error || "فشل في تحميل الملف");
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("حدث خطأ أثناء تحميل الملف");
      setError("حدث خطأ أثناء تحميل الملف");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 lg:p-4 bg-white rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
        <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
          {getFileIcon(file.originalName)}
          <div className="min-w-0">
            <p className="font-medium text-sm lg:text-base truncate">
              {file.originalName}
            </p>
            <p className="text-xs lg:text-sm text-gray-500">
              {formatFileSize(file.size)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 lg:gap-2 flex-shrink-0">
          <button
            onClick={() => viewFile(file.filename, file.originalName)}
            disabled={isViewing || isDownloading}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50 touch-manipulation"
            title="عرض"
          >
            {isViewing ? (
              <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" />
            ) : (
              <Eye className="w-4 h-4 lg:w-5 lg:h-5" />
            )}
          </button>
          <button
            onClick={() => downloadFile(file.filename, file.originalName)}
            disabled={isViewing || isDownloading}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50 touch-manipulation"
            title="تحميل"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" />
            ) : (
              <Download className="w-4 h-4 lg:w-5 lg:h-5" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-2 p-2 lg:p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs lg:text-sm text-red-600">{error}</p>
        </div>
      )}
    </>
  );
}
