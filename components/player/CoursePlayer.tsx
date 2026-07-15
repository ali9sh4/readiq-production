"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Course, Enrollment } from "@/types/types";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/context/authContext";
import { saveVideoProgress } from "@/app/actions/progress_actions";
import { groupVideosBySection } from "@/lib/sectional/grouping";
import { isVideoLockedForUser } from "@/lib/sectional/access";
import PlayerHeader from "./PlayerHeader";
import VideoStage from "./VideoStage";
import LessonSidebar, { SectionsContent } from "./LessonSidebar";
import PlayerTabs, { type PlayerTab } from "./PlayerTabs";
import {
  UNASSIGNED_KEY,
  type MainPlayerHandle,
  type VideoProgress,
} from "./shared";

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
  enrollment = null,
  approvedQaCounts = {},
}: {
  course: Course;
  isEnrolled?: boolean;
  userProgress?: VideoProgress[];
  onProgressUpdate?: (videoId: string, completed: boolean) => Promise<void>;
  accessScope?: "full" | "sectional";
  ownedSectionIds?: string[];
  // Phase 6b: needed by SectionalBuyDialog (for totalSpent / break-even
  // math). Existing `accessScope` and `ownedSectionIds` props remain for
  // backward compat and continue to drive the lock predicate.
  enrollment?: Enrollment | null;
  // Phase 3 (study deck): approved Q&A pairs per videoId, computed
  // server-side in app/course/[courseId]/page.tsx. Drives the practice-tab
  // affordance only — the deck's server action re-enforces the gate.
  approvedQaCounts?: Record<string, number>;
}) {
  const searchParams = useSearchParams();
  const auth = useAuth();

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
  // Desktop default is the files tab (the fallback effect below bounces to
  // flashcards when the lesson has no files); the mount effect flips mobile
  // to the "الدروس" tab (SSR renders desktop markup, so the initial state
  // must match it — a breakpoint check in the initializer would
  // hydrate-mismatch on phones).
  const [activeTab, setActiveTab] = useState<PlayerTab>("resources");
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setActiveTab("lessons");
    }
  }, []);

  // Theater mode: hide the global navbar while the enrolled player is
  // mounted (globals.css rule on body.player-theater).
  useEffect(() => {
    document.body.classList.add("player-theater");
    return () => {
      document.body.classList.remove("player-theater");
    };
  }, []);
  const [completedVideos, setCompletedVideos] = useState<Set<string>>(
    new Set(),
  );

  const [videoError, setVideoError] = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);

  // Focus mode: collapsing the sidebar gives the stage the full width.
  // Deliberately session-only state — nothing is persisted.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Phase 3 slice 4: lets the practice deck pause the main lesson player
  // when a clip jump starts, so two audio streams never overlap. The
  // counter signals the reverse direction: main player starts → deck
  // closes its clip.
  const mainPlayerRef = useRef<MainPlayerHandle>(null);
  const [mainPlaySignal, setMainPlaySignal] = useState(0);

  // --- Organize Videos ---
  // Filter to visible videos first, then group by section. `isVisible
  // !== false` treats undefined as visible — matches CoursePreview's
  // filter and the upload-default of `true`. Only explicitly-hidden
  // videos (instructor toggled off) are filtered out.
  const groupedSections = useMemo(() => {
    const visibleVideos = (course?.videos || []).filter(
      (v) => v.isVisible !== false,
    );
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

  // Section label for the header crumb + lesson meta line. The synthetic
  // unassigned bucket carries a real display title too ("دروس الدورة").
  const currentSectionTitle = useMemo(() => {
    if (!currentVideo) return null;
    const group = groupedSections.find((g) =>
      g.videos.some((v) => v.videoId === currentVideo.videoId),
    );
    return group?.title ?? null;
  }, [currentVideo, groupedSections]);

  const canAccessVideo = useMemo(() => {
    if (!currentVideo) return false;
    return !isVideoLockedForUser(currentVideo, course, {
      isEnrolled,
      accessScope,
      ownedSectionIds,
    });
  }, [currentVideo, course, isEnrolled, accessScope, ownedSectionIds]);

  // Phase 3 (study deck, slice 2): practice-tab visibility. Enrolled-only by
  // owner decision (docs/AUDIT_STUDY_DECK.md §3) — deliberately NOT
  // `canAccessVideo`: getLockReason grants free-preview / free-course before
  // its enrollment checks, but those grants play the video without opening
  // the deck. This mirrors the enrollment branch of the study gate (full
  // purchase, full/legacy scope, owned section, or untagged video); the
  // server re-enforces it when the deck loads.
  const approvedQaCount = currentVideo
    ? (approvedQaCounts[currentVideo.videoId] ?? 0)
    : 0;
  const canPractice = useMemo(() => {
    if (!currentVideo || !isEnrolled || approvedQaCount === 0) return false;
    if (course.purchaseMode !== "sectional") return true;
    if (accessScope !== "sectional") return true; // full-bundle or legacy scope
    if (!currentVideo.sectionId) return true; // untagged-video grant
    return (ownedSectionIds ?? []).includes(currentVideo.sectionId);
  }, [
    currentVideo,
    isEnrolled,
    approvedQaCount,
    course.purchaseMode,
    accessScope,
    ownedSectionIds,
  ]);

  // Leaving a practice-eligible lesson while its tab is active would strand
  // the tab content — fall back to the lessons tab on mobile, the files
  // slot on desktop (renders nothing if this lesson has no files, which is
  // exactly the no-tab-bar state).
  useEffect(() => {
    if (activeTab === "practice" && !canPractice) {
      setActiveTab(window.innerWidth < 1024 ? "lessons" : "resources");
    }
  }, [activeTab, canPractice]);

  // Phase 3 slice 4: the deck mounts on first practice-tab activation for
  // the current lesson and then stays mounted (hidden) across tab switches,
  // so session state + the deck's single signed player survive a peek at
  // الملفات (§8.3 — remounting re-mints playback tokens).
  const [practiceSessionVideoId, setPracticeSessionVideoId] = useState<
    string | null
  >(null);
  useEffect(() => {
    if (
      activeTab === "practice" &&
      canPractice &&
      currentVideo &&
      // 2D completion gate: the deck must not mount (and mint tokens)
      // behind the locked placeholder.
      completedVideos.has(currentVideo.videoId)
    ) {
      setPracticeSessionVideoId(currentVideo.videoId);
    } else if (
      practiceSessionVideoId !== null &&
      currentVideo?.videoId !== practiceSessionVideoId
    ) {
      // Lesson changed away: drop the keep-alive, otherwise re-selecting a
      // previously-practiced lesson on ANY tab would auto-mount a hidden
      // deck (server-action read + token mint) on every sidebar bounce
      // (adversarial-review finding). Keep-alive is for tab switches
      // within the SAME lesson only.
      setPracticeSessionVideoId(null);
    }
  }, [
    activeTab,
    canPractice,
    currentVideo,
    practiceSessionVideoId,
    completedVideos,
  ]);

  // Fail-soft on malformed data: a non-array `files` field must hide the
  // tab, never crash the player.
  const courseFiles = useMemo(
    () => (Array.isArray(course?.files) ? course.files : []),
    [course?.files],
  );

  const currentVideoFiles = useMemo(() => {
    return courseFiles.filter(
      (f) => f.relatedVideoId === currentVideo?.videoId,
    );
  }, [courseFiles, currentVideo]);

  const generalFiles = useMemo(() => {
    return courseFiles.filter((f) => !f.relatedVideoId);
  }, [courseFiles]);

  // Files-tab conditional (mirrors the التدريب pattern): render the tab
  // only when this lesson's panel would show something — its own files or
  // course-general files (the same sum the tab label displays). Where
  // files load is unchanged; empty lessons keep the other tabs as focus.
  const hasLessonFiles = currentVideoFiles.length + generalFiles.length > 0;

  // Landing on a lesson with no files while the files tab is active:
  // mobile bounces to the lessons tab, desktop to flashcards when they
  // exist. With neither files nor cards the value stays "resources" —
  // harmless, since the desktop bar and every panel are hidden then.
  useEffect(() => {
    if (activeTab === "resources" && !hasLessonFiles) {
      if (window.innerWidth < 1024) {
        setActiveTab("lessons");
      } else if (canPractice) {
        setActiveTab("practice");
      }
    }
  }, [activeTab, hasLessonFiles, canPractice]);

  const completedCount = useMemo(
    () => allVideos.filter((v) => completedVideos.has(v.videoId)).length,
    [completedVideos, allVideos],
  );

  const progress = useMemo(() => {
    if (!allVideos.length) return 0;
    return Math.round((completedCount / allVideos.length) * 100);
  }, [completedCount, allVideos]);

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
    // Reward moment: completing via the button jumps straight to the
    // flashcards it just unlocked. Never fires for an already-complete
    // lesson — the button is hidden then — and not from onEnded.
    if (auth?.user && canPractice) {
      setActiveTab("practice");
    }
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

  const handleSelectVideo = useCallback((videoIndex: number) => {
    setCurrentVideoIndex(videoIndex);
    setVideoError(null);
    // Keep the lessons tab active on mobile when a video is selected
    if (window.innerWidth < 1024) {
      setActiveTab("lessons");
    }
  }, []);

  const isSectionalCourse = course.purchaseMode === "sectional";

  // Sections list (reusable for both the sidebar and the mobile tab)
  const sectionsList = (
    <SectionsContent
      groupedSections={groupedSections}
      expandedSections={expandedSections}
      toggleSection={toggleSection}
      completedVideos={completedVideos}
      allVideos={allVideos}
      currentVideoIndex={currentVideoIndex}
      onSelectVideo={handleSelectVideo}
      course={course}
      isSectionalCourse={isSectionalCourse}
      enrollment={enrollment}
      isEnrolled={isEnrolled}
      accessScope={accessScope}
      ownedSectionIds={ownedSectionIds}
    />
  );

  return (
    <div className="min-h-screen flex flex-col bg-navy-950" dir="rtl">
      <PlayerHeader
        course={course}
        currentSectionTitle={currentSectionTitle}
        progress={progress}
        completedCount={completedCount}
        totalVideos={allVideos.length}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />

      {/* Theater grid: the stage is the inline-start column, the sidebar the
          350px inline-end column. Collapsing the sidebar (focus mode) drops
          the grid to one column. */}
      <div
        className={`flex-1 lg:grid lg:items-stretch ${
          sidebarOpen ? "lg:grid-cols-[minmax(0,1fr)_350px]" : ""
        }`}
      >
        {/* Main Content */}
        <main className="flex flex-col min-w-0 bg-surface min-h-[calc(100vh-3.5rem)]">
          <VideoStage
            course={course}
            currentVideo={currentVideo}
            currentVideoIndex={currentVideoIndex}
            totalVideos={allVideos.length}
            currentSectionTitle={currentSectionTitle}
            canAccessVideo={canAccessVideo}
            isEnrolled={isEnrolled}
            accessScope={accessScope}
            ownedSectionIds={ownedSectionIds}
            enrollment={enrollment}
            completedVideos={completedVideos}
            videoError={videoError}
            setVideoError={setVideoError}
            markingComplete={markingComplete}
            onMarkComplete={handleMarkComplete}
            handleVideoComplete={handleVideoComplete}
            goToNextVideo={goToNextVideo}
            goToPreviousVideo={goToPreviousVideo}
            mainPlayerRef={mainPlayerRef}
            onMainPlay={() => setMainPlaySignal((n) => n + 1)}
          />

          <PlayerTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            hasLessonFiles={hasLessonFiles}
            currentVideoFiles={currentVideoFiles}
            generalFiles={generalFiles}
            canPractice={canPractice}
            approvedQaCount={approvedQaCount}
            currentLessonCompleted={
              currentVideo ? completedVideos.has(currentVideo.videoId) : false
            }
            practiceSessionVideoId={practiceSessionVideoId}
            currentVideo={currentVideo}
            course={course}
            mainPlayerRef={mainPlayerRef}
            mainPlaySignal={mainPlaySignal}
            sectionsList={sectionsList}
          />
        </main>

        {/* Sidebar — desktop only; mobile reads the lessons tab instead. */}
        {sidebarOpen && (
          <LessonSidebar
            progress={progress}
            totalVideos={allVideos.length}
            totalDuration={totalDuration}
          >
            {sectionsList}
          </LessonSidebar>
        )}
      </div>
    </div>
  );
}
