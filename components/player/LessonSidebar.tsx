"use client";

import React from "react";
import { BookOpen, ChevronDown, ChevronLeft } from "lucide-react";
import { Course, CourseVideo, Enrollment } from "@/types/types";
import { GroupedSection } from "@/lib/sectional/grouping";
import { isVideoLockedForUser } from "@/lib/sectional/access";
import SectionalBuyButtons from "@/components/sectional/SectionalBuyButtons";
import LessonRow from "./LessonRow";
import { UNASSIGNED_KEY } from "./shared";

export function SectionsContent({
  groupedSections,
  expandedSections,
  toggleSection,
  completedVideos,
  allVideos,
  currentVideoIndex,
  onSelectVideo,
  course,
  isSectionalCourse,
  enrollment,
  isEnrolled,
  accessScope,
  ownedSectionIds,
}: {
  groupedSections: GroupedSection[];
  expandedSections: Set<string>;
  toggleSection: (section: string) => void;
  completedVideos: Set<string>;
  allVideos: CourseVideo[];
  currentVideoIndex: number;
  onSelectVideo: (videoIndex: number) => void;
  course: Course;
  isSectionalCourse: boolean;
  enrollment: Enrollment | null;
  isEnrolled: boolean;
  accessScope?: "full" | "sectional";
  ownedSectionIds?: string[];
}) {
  return (
    <div className="divide-y divide-gray-200">
      {groupedSections.map((group, idx) => {
        const sectionKey = group.sectionId ?? UNASSIGNED_KEY;
        const videos = group.videos;
        const isExpanded = expandedSections.has(sectionKey);
        const sectionCompleted = videos.filter((v) =>
          completedVideos.has(v.videoId),
        ).length;
        const sectionProgress = Math.round(
          (sectionCompleted / videos.length) * 100,
        );
        const realSection = group.sectionId
          ? ((course.sections ?? []).find(
              (s) => s.sectionId === group.sectionId,
            ) ?? null)
          : null;

        return (
          <div key={sectionKey} className="bg-gray-50/30">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(sectionKey)}
              className="w-full p-3 lg:p-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
                <div
                  className={`flex-shrink-0 p-1.5 lg:p-2 rounded-lg ${
                    isExpanded ? "bg-blue-100" : "bg-gray-100"
                  } transition-colors`}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-600" />
                  ) : (
                    <ChevronLeft className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-gray-600" />
                  )}
                </div>
                <div className="text-right min-w-0">
                  <h3
                    title={group.title}
                    className="font-semibold text-sm lg:text-base text-gray-900 leading-snug line-clamp-2 break-words"
                  >
                    {group.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {videos.length} دروس • {sectionCompleted} مكتمل
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
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

            {/* Per-section CTAs (sectional courses only). The component
                hides itself for owned sections / non-sectional access. */}
            {isSectionalCourse && realSection && (
              <div className="px-3 lg:px-4 py-2 bg-white border-t border-gray-100">
                <SectionalBuyButtons
                  course={course}
                  section={realSection}
                  enrollment={enrollment}
                  positionInOrder={idx}
                />
              </div>
            )}

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
                    <LessonRow
                      key={video.videoId}
                      video={video}
                      idx={idx}
                      isActive={isActive}
                      isCompleted={isCompleted}
                      isLocked={isLocked}
                      onSelect={() => onSelectVideo(videoIndex)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function LessonSidebar({
  progress,
  children,
}: {
  progress: number;
  children: React.ReactNode;
}) {
  return (
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
          {children}
        </div>
      </div>

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
      `}</style>
    </aside>
  );
}
