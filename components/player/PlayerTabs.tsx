"use client";

import React, { type RefObject } from "react";
import { Brain, FileText, List, User } from "lucide-react";
import { Course, CourseVideo } from "@/types/types";
import { CourseFile } from "@/components/fileUplaodtoR2";
import QaStudyDeck from "@/components/study/QaStudyDeck";
import FilesTab from "./FilesTab";
import { toArabicIndic, type MainPlayerHandle } from "./shared";

export type PlayerTab = "lessons" | "overview" | "resources" | "practice";

const ACTIVE_TAB_CLASSES = "text-navy-950 font-bold border-brand-accent";
const INACTIVE_TAB_CLASSES =
  "text-gray-600 border-transparent hover:text-navy-950";

export default function PlayerTabs({
  activeTab,
  setActiveTab,
  hasLessonFiles,
  currentVideoFiles,
  generalFiles,
  canPractice,
  approvedQaCount,
  practiceSessionVideoId,
  currentVideo,
  course,
  mainPlayerRef,
  mainPlaySignal,
  sectionsList,
}: {
  activeTab: PlayerTab;
  setActiveTab: (tab: PlayerTab) => void;
  hasLessonFiles: boolean;
  currentVideoFiles: CourseFile[];
  generalFiles: CourseFile[];
  canPractice: boolean;
  approvedQaCount: number;
  practiceSessionVideoId: string | null;
  currentVideo: CourseVideo | undefined;
  course: Course;
  mainPlayerRef: RefObject<MainPlayerHandle | null>;
  mainPlaySignal: number;
  sectionsList: React.ReactNode;
}) {
  const tabButtonClasses = (tab: PlayerTab) =>
    `flex-1 lg:flex-none px-4 lg:px-8 py-3 text-xs lg:text-sm font-medium border-b-[3px] transition-colors ${
      activeTab === tab ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
    }`;

  return (
    <>
      {/* Tab bar — on mobile a fourth first tab "الدروس" carries the lesson
          list; on desktop the sidebar owns it. */}
      <div className="bg-surface flex border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab("lessons")}
          className={`lg:hidden ${tabButtonClasses("lessons")}`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <List className="w-3.5 h-3.5" />
            الدروس
          </span>
        </button>

        <button
          onClick={() => setActiveTab("overview")}
          className={tabButtonClasses("overview")}
        >
          <span className="flex items-center justify-center gap-1.5">
            نظرة عامة
          </span>
        </button>

        {/* Files tab — only for lessons with something to show (own or
            course-general files); see hasLessonFiles above. */}
        {hasLessonFiles && (
          <button
            onClick={() => setActiveTab("resources")}
            className={tabButtonClasses("resources")}
          >
            <span className="flex items-center justify-center gap-1.5 lg:gap-2">
              <FileText className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              الملفات
              <span
                dir="ltr"
                className="font-mono text-xs bg-navy-100 text-navy-900 rounded-full px-1.5 py-0.5 leading-none"
              >
                {currentVideoFiles.length + generalFiles.length}
              </span>
            </span>
          </button>
        )}

        {/* Practice tab — only for lessons with approved Q&A the student's
            enrollment actually covers (see canPractice above). */}
        {canPractice && (
          <button
            onClick={() => setActiveTab("practice")}
            className={tabButtonClasses("practice")}
          >
            <span className="flex items-center justify-center gap-1.5 lg:gap-2">
              <Brain className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              بطاقات المراجعة
              <span
                dir="ltr"
                className="font-mono text-xs bg-navy-100 text-navy-900 rounded-full px-1.5 py-0.5 leading-none"
              >
                {approvedQaCount}
              </span>
            </span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto bg-surface">
        {/* Lessons Tab - Mobile/Tablet Only */}
        {activeTab === "lessons" && (
          <div className="lg:hidden bg-white">{sectionsList}</div>
        )}

        {/* Overview Tab — lesson description + course facts. */}
        {activeTab === "overview" && (
          <div className="p-4 lg:p-8">
            <div className="max-w-3xl mx-auto bg-white rounded-md border border-gray-200 p-4 lg:p-6">
              <h3 className="text-sm lg:text-base font-bold text-navy-950 mb-2">
                عن هذا الدرس
              </h3>
              {currentVideo?.description ? (
                <p className="text-sm text-gray-600 leading-relaxed break-words">
                  {currentVideo.description}
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  لا يوجد وصف لهذا الدرس.
                </p>
              )}
              <p className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-500">
                <User className="w-3.5 h-3.5 text-navy-800" />
                <span className="truncate">
                  {course.instructorName || "مدرب غير معروف"}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Practice Tab — QaStudyDeck (Phase 3 slice 4). Keyed by videoId
            so switching lessons starts a fresh deck; hidden (not
            unmounted) on tab switches within the same lesson. */}
        {canPractice &&
          currentVideo &&
          practiceSessionVideoId === currentVideo.videoId && (
            <div className={activeTab === "practice" ? "p-4 lg:p-8" : "hidden"}>
              <div className="max-w-3xl mx-auto">
                <QaStudyDeck
                  key={currentVideo.videoId}
                  courseId={course.id}
                  videoId={currentVideo.videoId}
                  playbackId={currentVideo.playbackId ?? null}
                  active={activeTab === "practice"}
                  onClipPlay={() => mainPlayerRef.current?.pause()}
                  closeClipSignal={mainPlaySignal}
                />
              </div>
            </div>
          )}

        {/* Resources Tab — gated like the tab button so a lesson switch
            can't flash the empty panel before the fallback effect runs. */}
        {activeTab === "resources" && hasLessonFiles && (
          <FilesTab
            currentVideoFiles={currentVideoFiles}
            generalFiles={generalFiles}
            courseId={course.id}
          />
        )}
      </div>
    </>
  );
}
