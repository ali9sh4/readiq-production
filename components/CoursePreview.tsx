"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Course, CourseVideo, Enrollment } from "@/types/types";
import {
  Clock,
  Users,
  Award,
  CheckCircle,
  Lock,
  ChevronDown,
  BookOpen,
  FileText,
  Globe,
  BarChart3,
  Video,
  ArrowDown,
  Play,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EnrollButton from "./EnrollButton";
import SignedMuxPlayer from "@/components/SignedMuxPlayer";
import { useAuth } from "@/context/authContext";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import FavoriteButton from "./favoritesButton";
import { groupVideosBySection } from "@/lib/sectional/grouping";
import { getCourseDisplayPrice } from "@/lib/sectional/displayPrice";
import SectionalCoursePurchase from "@/components/sectional/SectionalCoursePurchase";
import SectionalBuyButtons from "@/components/sectional/SectionalBuyButtons";

// React key for the synthetic "unassigned" bucket (GroupedSection.sectionId
// is `null` there).
const UNASSIGNED_KEY = "__unassigned__";

interface CoursePreviewProps {
  course: Course;
  initialIsFavorited: boolean;
  // Phase 6b: present only when a logged-in user lands on the preview
  // page WITHOUT being enrolled (sectional buyers with partial ownership
  // typically route to CoursePlayer instead, so this is usually null).
  // When provided, sectional CTAs use it for smart-subtract pricing and
  // bundle break-even math.
  enrollment?: Enrollment | null;
}

export default function CoursePreview({
  course,
  initialIsFavorited: initialIsFavorite = false,
  enrollment = null,
}: CoursePreviewProps) {
  const isSectional = course.purchaseMode === "sectional";
  const searchParams = useSearchParams();
  // Only consumed by the legacy <EnrollButton> below, which is gated
  // behind !isSectional. Sectional courses use SectionalCoursePurchase
  // and never read this value. Derived from the same helper that drives
  // every other price surface so the math stays in one place.
  const actualPrice = getCourseDisplayPrice(course).numeric ?? 0;
  // Initial expansion: first non-empty section (matches the spirit of the
  // legacy "auto-expand المقدمة" behavior — section 1 is whatever the
  // instructor put first, ordered by `course.sections[].order`).
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(),
  );

  // Free-preview playback (Option A — signed-in visitors only). The signal
  // is the per-video `isFreePreview` boolean — the same field the backend
  // playback-token route, CoursePlayer, and `lib/sectional/access.ts`
  // (`getLockReason`) all key off. Free-preview is the highest-priority
  // unlock rule there, so a free-preview video plays regardless of section
  // ownership on a sectional course.
  const { user, isLoading: authLoading } = useAuth();
  const isSignedIn = Boolean(user);

  const freePreviewVideos = useMemo(
    () =>
      (course.videos || []).filter(
        (v) => v.isFreePreview === true && v.isVisible !== false,
      ),
    [course.videos],
  );
  const hasFreePreview = freePreviewVideos.length > 0;

  // Which free-preview lesson is loaded into the player. Defaults to the
  // first; clicking another free-preview lesson row swaps it.
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(
    () => freePreviewVideos[0]?.videoId ?? null,
  );
  const selectedPreviewVideo = useMemo(
    () =>
      freePreviewVideos.find((v) => v.videoId === selectedPreviewId) ??
      freePreviewVideos[0] ??
      null,
    [freePreviewVideos, selectedPreviewId],
  );

  // Render the player only for a signed-in visitor — the token route
  // requires auth, so a signed-out request would just 401. For signed-out
  // visitors we show the thumbnail + a sign-in prompt and fire no request.
  const showPreviewPlayer =
    hasFreePreview && isSignedIn && selectedPreviewVideo !== null;

  const handlePreviewLessonClick = useCallback((video: CourseVideo) => {
    setSelectedPreviewId(video.videoId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const enrollWrapperRef = useRef<HTMLDivElement | null>(null);
  const setEnrollWrapperRef = useCallback((el: HTMLDivElement | null) => {
    if (el && el.offsetParent !== null) {
      enrollWrapperRef.current = el;
    }
  }, []);

  // Phase 6b: sectional courses scroll the curriculum block into view
  // (where per-section CTAs live) instead of the now-hidden enroll button.
  const curriculumRef = useRef<HTMLDivElement | null>(null);

  const scrollToCurriculum = useCallback(() => {
    const el = curriculumRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("scroll-target-pulse");
    window.setTimeout(() => {
      el.classList.remove("scroll-target-pulse");
    }, 1500);
  }, []);

  const scrollToEnroll = useCallback(() => {
    if (isSectional) {
      scrollToCurriculum();
      return;
    }
    const el = enrollWrapperRef.current;
    if (!el || el.offsetParent === null) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("scroll-target-pulse");
    window.setTimeout(() => {
      el.classList.remove("scroll-target-pulse");
    }, 1500);
  }, [isSectional, scrollToCurriculum]);

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");

    if (paymentStatus === "failed") {
      toast.error("فشل الدفع", {
        description:
          "حدث خطأ أثناء معالجة الدفع. لم يتم خصم أي مبلغ. يمكنك المحاولة مرة أخرى.",
        duration: 5000,
      });

      // Clean URL
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

  // Organize videos by section. Preserves the legacy preview visibility
  // filter (`v.isVisible !== false`, treats `undefined` as visible) — note
  // CoursePlayer uses a stricter `v.isVisible` check; the two have always
  // differed and Phase 6a does not change that.
  const groupedSections = useMemo(() => {
    const visibleVideos = (course.videos || []).filter(
      (v) => v.isVisible !== false,
    );
    return groupVideosBySection({
      sections: course.sections,
      videos: visibleVideos,
    }).filter((g) => g.videos.length > 0);
  }, [course.videos, course.sections]);

  // Auto-expand the first section on first render (or when the section
  // list changes from empty to non-empty), without clobbering subsequent
  // user toggles.
  useEffect(() => {
    if (groupedSections.length === 0) return;
    setExpandedSections((prev) => {
      if (prev.size > 0) return prev;
      const firstKey = groupedSections[0].sectionId ?? UNASSIGNED_KEY;
      return new Set([firstKey]);
    });
  }, [groupedSections]);

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
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

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Hero Section */}
      <div className="bg-gray-900 text-white">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start">
            {/* Left: Course Info */}
            <div className="space-y-3 sm:space-y-4 md:space-y-6">
              {/* Breadcrumb or Category */}
              {course.category && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-xs sm:text-sm">
                    {course.category}
                  </Badge>
                  {course.status === "published" && (
                    <Badge className="bg-yellow-400 text-black font-semibold hover:bg-yellow-500 text-xs sm:text-sm">
                      الأكثر مبيعاً
                    </Badge>
                  )}
                </div>
              )}

              {/* Title */}
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3 leading-tight">
                  {course.title}
                </h1>
                {course.subtitle && (
                  <p className="text-base sm:text-lg md:text-xl text-gray-300 leading-relaxed">
                    {course.subtitle}
                  </p>
                )}
              </div>

              {/* Description */}
              {course.description && (
                <p className="text-gray-300 leading-relaxed text-xs sm:text-sm md:text-base line-clamp-3 sm:line-clamp-none">
                  {course.description}
                </p>
              )}

              {/* Stats Row */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 lg:gap-6 text-xs sm:text-sm">
                {/* Students */}
                <div className="flex items-center gap-1.5 sm:gap-2 text-gray-300">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>
                    {(course.studentsCount || 0).toLocaleString()} طالب
                  </span>
                </div>
              </div>

              {/* Instructor */}
              {course.instructorName && (
                <div className="flex items-center gap-2 sm:gap-3 bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 backdrop-blur-sm">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Award className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">أنشأها</p>
                    <p className="font-semibold text-sm sm:text-base">
                      {course.instructorName}
                    </p>
                  </div>
                </div>
              )}

              {/* Course Meta */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-300">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{totalVideos} درس</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{formatTotalDuration(totalDuration)}</span>
                </div>
                {course.language && (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{course.language}</span>
                  </div>
                )}
                {course.level && (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{course.level}</span>
                  </div>
                )}
              </div>

              {/* ========================================
                  ENROLLMENT CARD - MOBILE/TABLET ONLY
                  Shown on screens smaller than lg (< 1024px)
                  ======================================== */}
              <div className="lg:hidden">
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                  {isSectional ? (
                    <div className="mb-2" ref={setEnrollWrapperRef}>
                      <SectionalCoursePurchase
                        course={course}
                        enrollment={enrollment}
                        onScrollToCurriculum={scrollToCurriculum}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Price Display */}
                      <div className="mb-3">
                        {(course.salePrice ?? 0) > 0 &&
                        course.salePrice! < (course.price ?? 0) ? (
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-green-600">
                              {course.salePrice!.toLocaleString()} د.ع
                            </span>
                            <span className="text-sm text-gray-400 line-through">
                              {course.price!.toLocaleString()} د.ع
                            </span>
                          </div>
                        ) : course.price === 0 ? (
                          <span className="text-2xl font-bold text-green-600">
                            مجاني
                          </span>
                        ) : (
                          <span className="text-2xl font-bold text-gray-900">
                            {course.price!.toLocaleString()} د.ع
                          </span>
                        )}
                      </div>

                      {/* Enroll Button */}
                      <div className="mb-2" ref={setEnrollWrapperRef}>
                        <EnrollButton
                          courseTitle={course.title}
                          price={actualPrice}
                          courseId={course.id}
                          isFree={course.price === 0}
                          fullWidth
                        />
                      </div>
                    </>
                  )}

                  {/* Favorite Button */}
                  <FavoriteButton
                    courseId={course.id}
                    initialIsFavorited={initialIsFavorite}
                    showLabel={false}
                  />
                </div>
              </div>
            </div>

            {/* Right: Course Thumbnail */}
            <div className="lg:sticky lg:top-4">
              <Card className="overflow-hidden shadow-2xl border-0">
                <div className="relative bg-black">
                  {showPreviewPlayer && selectedPreviewVideo ? (
                    /* Signed-in visitor — play the free-preview lesson.
                       SignedMuxPlayer mints the token via useMuxPlaybackToken;
                       no hand-rolled fetch, no raw Mux URL. */
                    <div className="relative aspect-video">
                      <SignedMuxPlayer
                        key={selectedPreviewVideo.videoId}
                        courseId={course.id}
                        videoId={selectedPreviewVideo.videoId}
                        playbackId={selectedPreviewVideo.playbackId}
                        streamType="on-demand"
                        metadata={{
                          video_id: selectedPreviewVideo.videoId,
                          video_title: selectedPreviewVideo.title,
                        }}
                        className="w-full h-full aspect-video bg-black"
                      />
                      <span className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-green-600 text-white text-xs font-semibold rounded-full px-2.5 py-1 pointer-events-none">
                        <Play className="w-3 h-3 fill-current" />
                        معاينة مجانية
                      </span>
                    </div>
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
                      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                      {hasFreePreview && !isSignedIn && !authLoading ? (
                        /* Free preview exists but the visitor is signed out.
                           Prompt sign-in — do NOT request a token. */
                        <Link
                          href="/login"
                          className="absolute inset-x-0 bottom-0 mx-auto mb-4 sm:mb-6 flex items-center justify-center gap-2 bg-green-600/90 hover:bg-green-600 backdrop-blur-sm text-white text-sm sm:text-base font-semibold rounded-full px-4 py-2 sm:px-5 sm:py-2.5 ring-1 ring-white/30 transition-colors w-fit"
                        >
                          <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                          <span>سجّل الدخول لمشاهدة المعاينة المجانية</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={scrollToEnroll}
                          className="absolute inset-x-0 bottom-0 mx-auto mb-4 sm:mb-6 flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm sm:text-base font-semibold rounded-full px-4 py-2 sm:px-5 sm:py-2.5 ring-1 ring-white/30 transition-colors w-fit"
                        >
                          <span>اشترك للمشاهدة</span>
                          <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* ========================================
                    ENROLLMENT CARD - DESKTOP ONLY
                    Shown below video on lg+ screens (≥ 1024px)
                    ======================================== */}
                <div className="hidden lg:block">
                  <CardContent className="p-5 bg-white border-t border-gray-200">
                    {isSectional ? (
                      <div className="mb-3" ref={setEnrollWrapperRef}>
                        <SectionalCoursePurchase
                          course={course}
                          enrollment={enrollment}
                          onScrollToCurriculum={scrollToCurriculum}
                        />
                      </div>
                    ) : (
                      <>
                        {/* Price Display - Centered */}
                        <div className="text-center mb-4">
                          {(course.salePrice ?? 0) > 0 &&
                          course.salePrice! < (course.price ?? 0) ? (
                            <div className="flex items-baseline justify-center gap-3">
                              <span className="text-3xl font-bold text-green-600">
                                {course.salePrice!.toLocaleString()} د.ع
                              </span>
                              <span className="text-lg text-gray-400 line-through">
                                {course.price!.toLocaleString()} د.ع
                              </span>
                            </div>
                          ) : course.price === 0 ? (
                            <span className="text-3xl font-bold text-green-600">
                              مجاني
                            </span>
                          ) : (
                            <span className="text-3xl font-bold text-gray-900">
                              {course.price!.toLocaleString()} د.ع
                            </span>
                          )}
                        </div>

                        {/* Enroll Button */}
                        <div className="mb-3" ref={setEnrollWrapperRef}>
                          <EnrollButton
                            courseTitle={course.title}
                            price={actualPrice}
                            courseId={course.id}
                            isFree={course.price === 0}
                            fullWidth
                          />
                        </div>
                      </>
                    )}

                    {/* Favorite Button */}
                    <FavoriteButton
                      courseId={course.id}
                      initialIsFavorited={initialIsFavorite}
                      showLabel={false}
                    />

                    {/* Trust Badge */}
                    <p className="text-xs text-center text-gray-500 mt-4 pt-3 border-t">
                      💳 دفع آمن • 🔄 ضمان استرداد 30 يوم
                    </p>
                  </CardContent>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {/* Left: Main Content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 md:space-y-8">
            {/* What You'll Learn */}
            {course.learningPoints && course.learningPoints.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4 sm:p-6 md:p-8">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-green-600 flex-shrink-0" />
                    ماذا ستتعلم
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {course.learningPoints.map((point, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 sm:gap-3"
                      >
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-xs sm:text-sm leading-relaxed">
                          {point}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Course Content (Curriculum) */}
            <div ref={curriculumRef}>
            <Card className="border-0 shadow-lg">
              <CardContent className="p-4 sm:p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-blue-600 flex-shrink-0" />
                    محتوى الدورة
                  </h2>
                  <div className="text-xs sm:text-sm text-gray-600">
                    <span className="font-medium">{totalVideos}</span> درس •{" "}
                    <span className="font-medium">
                      {formatTotalDuration(totalDuration)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {groupedSections.map((group, idx) => {
                    const sectionKey = group.sectionId ?? UNASSIGNED_KEY;
                    const videos = group.videos;
                    const isExpanded = expandedSections.has(sectionKey);
                    const sectionDuration = videos.reduce(
                      (sum, v) => sum + (v.duration || 0),
                      0
                    );
                    // Look up the canonical section (carries price/lock
                    // metadata) — null for the synthetic "unassigned"
                    // bucket, where buy buttons don't apply.
                    const realSection = group.sectionId
                      ? course.sections?.find(
                          (s) => s.sectionId === group.sectionId
                        ) ?? null
                      : null;

                    return (
                      <div
                        key={sectionKey}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors"
                      >
                        {/* Section Header */}
                        <button
                          onClick={() => toggleSection(sectionKey)}
                          className="w-full p-3 sm:p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <ChevronDown
                              className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 transition-transform flex-shrink-0 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                            <div className="text-right">
                              <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                                {group.title}
                              </h3>
                            </div>
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600 whitespace-nowrap mr-2">
                            {videos.length} دروس •{" "}
                            {formatDuration(sectionDuration)}
                          </div>
                        </button>

                        {/* Per-section CTAs (sectional courses only) */}
                        {isSectional && realSection && (
                          <div className="px-3 sm:px-4 py-2 bg-white border-t border-gray-100">
                            <SectionalBuyButtons
                              course={course}
                              section={realSection}
                              enrollment={enrollment}
                              positionInOrder={idx}
                            />
                          </div>
                        )}

                        {/* Videos List */}
                        {isExpanded && (
                          <div className="divide-y divide-gray-100 bg-white">
                            {videos.map((video) => {
                              // Free-preview lessons are playable (signed-in)
                              // or prompt sign-in; everything else stays
                              // locked and scrolls to the Enroll CTA.
                              const isPreview = video.isFreePreview === true;
                              return (
                                <div
                                  key={video.videoId}
                                  onClick={() =>
                                    isPreview
                                      ? handlePreviewLessonClick(video)
                                      : scrollToEnroll()
                                  }
                                  className="p-3 sm:p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                                >
                                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                    <div
                                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        isPreview
                                          ? "bg-green-100"
                                          : "bg-gray-100"
                                      }`}
                                    >
                                      {isPreview ? (
                                        <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 fill-current" />
                                      ) : (
                                        <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                                      )}
                                    </div>
                                    <div className="flex-1 text-right min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">
                                          {video.title}
                                        </p>
                                        {isPreview && (
                                          <span className="text-[10px] sm:text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0">
                                            معاينة مجانية
                                          </span>
                                        )}
                                      </div>
                                      {video.description && (
                                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                          {video.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-xs sm:text-sm text-gray-600 font-medium mr-2 sm:mr-4 whitespace-nowrap">
                                    {formatDuration(video.duration)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            </div>

            {/* Requirements */}
            {course.requirements && course.requirements.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4 sm:p-6 md:p-8">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-orange-600 flex-shrink-0" />
                    المتطلبات
                  </h2>
                  <ul className="space-y-2 sm:space-y-3">
                    {course.requirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-2 sm:gap-3">
                        <div className="w-2 h-2 bg-orange-600 rounded-full mt-2 flex-shrink-0" />
                        <span className="text-gray-700 leading-relaxed text-xs sm:text-sm md:text-base">
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
                <CardContent className="p-4 sm:p-6 md:p-8">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-6">
                    الوصف
                  </h2>
                  <div className="prose prose-gray max-w-none text-right">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line text-xs sm:text-sm md:text-base">
                      {course.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ========================================
              SIDEBAR - DESKTOP ONLY
              Sticky info card with course details and enrollment
              Shown on lg+ screens (≥ 1024px)
              ======================================== */}
          <div className="hidden lg:block">
            <Card className="sticky top-4 border-0 shadow-lg">
              <CardContent className="p-5 space-y-5">
                {/* Sidebar Title */}
                <h3 className="font-bold text-lg border-b border-gray-200 pb-3">
                  معلومات الدورة
                </h3>

                {/* Course Metadata */}
                <div className="space-y-3">
                  {/* Level */}
                  {course.level && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-gray-600 flex items-center gap-2 text-sm">
                        <BarChart3 className="w-4 h-4" />
                        المستوى
                      </span>
                      <span className="font-semibold text-gray-900 text-sm">
                        {course.level}
                      </span>
                    </div>
                  )}

                  {/* Language */}
                  {course.language && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-gray-600 flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4" />
                        اللغة
                      </span>
                      <span className="font-semibold text-gray-900 text-sm">
                        {course.language}
                      </span>
                    </div>
                  )}

                  {/* Total Lessons */}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-600 flex items-center gap-2 text-sm">
                      <Video className="w-4 h-4" />
                      عدد الدروس
                    </span>
                    <span className="font-semibold text-gray-900 text-sm">
                      {totalVideos}
                    </span>
                  </div>

                  {/* Total Duration */}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-600 flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4" />
                      المدة الإجمالية
                    </span>
                    <span className="font-semibold text-gray-900 text-sm">
                      {formatTotalDuration(totalDuration)}
                    </span>
                  </div>

                  {/* Students Count */}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-600 flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4" />
                      الطلاب
                    </span>
                    <span className="font-semibold text-gray-900 text-sm">
                      {(course.studentsCount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Enroll Button */}
                <div
                  className="pt-3 border-t border-gray-200"
                  ref={setEnrollWrapperRef}
                >
                  {isSectional ? (
                    <SectionalCoursePurchase
                      course={course}
                      enrollment={enrollment}
                      onScrollToCurriculum={scrollToCurriculum}
                    />
                  ) : (
                    <EnrollButton
                      courseTitle={course.title}
                      price={actualPrice}
                      courseId={course.id}
                      isFree={course.price === 0}
                      fullWidth
                    />
                  )}
                </div>

                {/* Trust Badge */}
                <p className="text-xs text-center text-gray-500 pt-1">
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
