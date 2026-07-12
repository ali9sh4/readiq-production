"use client";

import React, { type RefObject } from "react";
import { Brain, FileText, List } from "lucide-react";
import { Course, CourseVideo } from "@/types/types";
import { CourseFile } from "@/components/fileUplaodtoR2";
import QaStudyDeck from "@/components/study/QaStudyDeck";
import FilesTab from "./FilesTab";
import { type MainPlayerHandle } from "./shared";

export type PlayerTab = "sections" | "resources" | "practice";

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
  return (
    <>
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

        {/* Files tab — only for lessons with something to show (own or
            course-general files); see hasLessonFiles above. */}
        {hasLessonFiles && (
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
        )}

        {/* Practice tab — only for lessons with approved Q&A the student's
            enrollment actually covers (see canPractice above). */}
        {canPractice && (
          <button
            onClick={() => setActiveTab("practice")}
            className={`flex-1 px-4 lg:px-8 py-3 lg:py-4 text-xs lg:text-sm font-medium border-b-2 transition-all relative ${
              activeTab === "practice"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5 lg:gap-2">
              <Brain className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              التدريب ({approvedQaCount})
            </span>
            {activeTab === "practice" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
            )}
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Sections Tab - Mobile/Tablet Only */}
        {activeTab === "sections" && (
          <div className="lg:hidden">{sectionsList}</div>
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
