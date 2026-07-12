"use client";
import "@mux/mux-player/themes/minimal";

import React, { useState, useEffect, type RefObject } from "react";
import MuxPlayer from "@mux/mux-player-react";
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Course, CourseVideo, Enrollment } from "@/types/types";
import { useVideoProtection } from "@/hooks/useVideoProtection";
import { useAuth } from "@/context/authContext";
import VideoWatermark from "@/components/VideoWatermark";
import SectionalLock from "./SectionalLock";
import { formatDuration, type MainPlayerHandle } from "./shared";

export default function VideoStage({
  course,
  currentVideo,
  currentVideoIndex,
  totalVideos,
  currentSectionTitle,
  canAccessVideo,
  isEnrolled,
  accessScope,
  ownedSectionIds,
  enrollment,
  completedVideos,
  videoError,
  setVideoError,
  markingComplete,
  onMarkComplete,
  handleVideoComplete,
  goToNextVideo,
  goToPreviousVideo,
  mainPlayerRef,
  onMainPlay,
}: {
  course: Course;
  currentVideo: CourseVideo | undefined;
  currentVideoIndex: number;
  totalVideos: number;
  currentSectionTitle: string | null;
  canAccessVideo: boolean;
  isEnrolled: boolean;
  accessScope?: "full" | "sectional";
  ownedSectionIds?: string[];
  enrollment: Enrollment | null;
  completedVideos: Set<string>;
  videoError: string | null;
  setVideoError: (error: string | null) => void;
  markingComplete: boolean;
  onMarkComplete: () => void;
  handleVideoComplete: () => Promise<void>;
  goToNextVideo: () => void;
  goToPreviousVideo: () => void;
  mainPlayerRef: RefObject<MainPlayerHandle | null>;
  onMainPlay: () => void;
}) {
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
    auth?.user?.email || auth?.user?.displayName || "Rubik - اقْرَأْ";

  const [isLoadingVideo, setIsLoadingVideo] = useState(false);

  // Signed playback token state. Kept separate from videoError /
  // isLoadingVideo so token-mint failures stay distinguishable from
  // playback failures during the 3.5 rollout.
  const [playbackToken, setPlaybackToken] = useState<string | null>(null);
  const [thumbnailToken, setThumbnailToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenRetryCount, setTokenRetryCount] = useState(0);

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
        setTokenError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
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

  return (
    <>
      {/* Video zone — dark theater surface. Mux element and watermark are
          untouched; only the shell around them is styled. */}
      <div
        className="relative bg-navy-950 flex justify-center items-center min-h-[250px] sm:min-h-[400px]"
        {...videoContainerProps}
      >
        {/* Loading State */}
        {isLoadingVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-navy-950/60 z-10">
            <Loader2 className="w-8 h-8 lg:w-12 lg:h-12 text-brand-accent animate-spin" />
          </div>
        )}

        {/* Error State */}
        {videoError && (
          <div className="aspect-video flex flex-col items-center justify-center text-center p-4 lg:p-6">
            <AlertCircle className="w-12 h-12 lg:w-16 lg:h-16 text-destructive mb-4" />
            <p className="text-white mb-4 text-sm lg:text-base">{videoError}</p>
            <Button
              onClick={() => {
                setVideoError(null);
                setIsLoadingVideo(false);
              }}
              variant="outline"
              size="sm"
              className="bg-transparent text-white border-white/40 hover:bg-white/10 hover:text-white"
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
                <AlertCircle className="w-12 h-12 lg:w-16 lg:h-16 text-warning mb-4" />
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
                  <div className="absolute inset-0 flex items-center justify-center bg-navy-950 z-10">
                    <Loader2 className="w-8 h-8 lg:w-12 lg:h-12 text-brand-accent animate-spin" />
                  </div>
                )}

                {tokenError && !tokenLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 lg:p-6 bg-navy-950 z-10">
                    <AlertCircle className="w-12 h-12 lg:w-16 lg:h-16 text-destructive mb-4" />
                    <p className="text-white mb-4 text-sm lg:text-base">
                      {tokenError}
                    </p>
                    <Button
                      onClick={() => setTokenRetryCount((n) => n + 1)}
                      variant="outline"
                      size="sm"
                      className="bg-transparent text-white border-white/40 hover:bg-white/10 hover:text-white"
                    >
                      إعادة المحاولة
                    </Button>
                  </div>
                )}

                {!tokenLoading && !tokenError && playbackToken && (
                  <MuxPlayer
                    key={currentVideo.videoId}
                    ref={mainPlayerRef}
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
                    // Hide the player's built-in title overlay — it clips
                    // long titles to one line. The lesson-title bar below
                    // the player is the visible title; metadata keeps
                    // feeding Mux Data.
                    style={{ "--title-display": "none" }}
                    className="w-full h-full aspect-video bg-black"
                    onPlay={onMainPlay}
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

        {/* Locked content + buy dialog (sectional). The dialog mounts
            whenever the lesson has a sectionId, matching the original
            placement inside the video zone. */}
        <SectionalLock
          course={course}
          currentVideo={currentVideo}
          canAccessVideo={canAccessVideo}
          videoError={videoError}
          isEnrolled={isEnrolled}
          accessScope={accessScope}
          ownedSectionIds={ownedSectionIds}
          enrollment={enrollment}
        />

        {/* No Video Selected */}
        {!currentVideo && (
          <div className="aspect-video flex flex-col items-center justify-center text-center p-4 lg:p-6">
            <PlayCircle className="w-12 h-12 lg:w-16 lg:h-16 mb-4 text-navy-100/50" />
            <p className="text-sm lg:text-base text-navy-100/70">
              اختر درساً من القائمة لبدء المشاهدة
            </p>
          </div>
        )}
      </div>

      {/* Lesson header row — title, meta, and the actions row, on the light
          stage surface below the video. */}
      {currentVideo && (
        <div className="bg-surface border-b border-gray-200 px-3 lg:px-6 py-3 lg:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base lg:text-2xl font-extrabold text-navy-950 leading-snug break-words">
                {currentVideo.title}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs lg:text-sm text-gray-500">
                <span>
                  الدرس {currentVideoIndex + 1} من {totalVideos}
                </span>
                {currentSectionTitle && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate max-w-[240px]">
                      {currentSectionTitle}
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span dir="ltr" className="font-mono">
                  {formatDuration(currentVideo.duration)}
                </span>
              </p>
            </div>
            {completedVideos.has(currentVideo.videoId) && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">
                <CheckCircle className="w-3.5 h-3.5" />
                مكتمل
              </span>
            )}
          </div>

          {/* Actions row */}
          {canAccessVideo && (
            <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                onClick={goToPreviousVideo}
                disabled={currentVideoIndex === 0}
                variant="outline"
                size="sm"
                className="gap-1 bg-white border-gray-200 text-navy-950 hover:bg-navy-100/50"
              >
                <ChevronRight className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                <span className="text-xs lg:text-sm">السابق</span>
              </Button>
              {!completedVideos.has(currentVideo.videoId) && (
                <Button
                  onClick={onMarkComplete}
                  disabled={markingComplete}
                  size="sm"
                  className="gap-2 bg-success hover:bg-success/90 text-white sm:flex-none flex-1"
                >
                  {markingComplete ? (
                    <Loader2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 lg:w-4 lg:h-4" strokeWidth={3} />
                  )}
                  <span className="text-xs lg:text-sm">أكملتُ الدرس</span>
                </Button>
              )}
              <Button
                onClick={goToNextVideo}
                disabled={currentVideoIndex === totalVideos - 1}
                variant="outline"
                size="sm"
                className="gap-1 bg-white border-gray-200 text-navy-950 hover:bg-navy-100/50"
              >
                <span className="text-xs lg:text-sm">التالي</span>
                <ChevronLeft className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Watermark in fullscreen */}
      <style jsx global>{`
        .video-container:fullscreen .watermark-container,
        .video-container:-webkit-full-screen .watermark-container,
        .video-container:-moz-full-screen .watermark-container {
          position: fixed !important;
          bottom: 4rem !important;
          right: 1.5rem !important;
          z-index: 2147483647 !important;
        }
      `}</style>
    </>
  );
}
