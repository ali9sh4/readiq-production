"use client";

import React from "react";
import { BookOpen, ChevronDown, ChevronLeft, Lock } from "lucide-react";
import { Course, CourseVideo, Enrollment } from "@/types/types";
import { GroupedSection } from "@/lib/sectional/grouping";
import { isVideoLockedForUser } from "@/lib/sectional/access";
import SectionalBuyButtons from "@/components/sectional/SectionalBuyButtons";
import LessonRow from "./LessonRow";
import { UNASSIGNED_KEY, formatTotalDuration } from "./shared";

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
        const realSection = group.sectionId
          ? ((course.sections ?? []).find(
              (s) => s.sectionId === group.sectionId,
            ) ?? null)
          : null;
        // Display-only mirror of the server gate (invariant 7): the same
        // client predicate the rows use, aggregated per section. Drives the
        // 🔒 counter and the buy-chip shell — never the actual access.
        const lockStates = videos.map((v) =>
          isVideoLockedForUser(v, course, {
            isEnrolled,
            accessScope,
            ownedSectionIds,
          }),
        );
        const sectionFullyLocked = lockStates.every(Boolean);

        return (
          <div key={sectionKey} className="bg-white">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(sectionKey)}
              className="w-full p-3 flex items-center justify-between gap-2 bg-surface hover:bg-navy-100/40 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="flex-shrink-0 p-1.5 rounded-sm bg-white text-navy-900">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronLeft className="w-3.5 h-3.5" />
                  )}
                </span>
                <span className="text-start min-w-0">
                  <span
                    title={group.title}
                    className="block font-bold text-sm text-navy-950 leading-snug line-clamp-2 break-words"
                  >
                    {group.title}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {videos.length} دروس
                  </span>
                </span>
              </div>

              <span className="flex-shrink-0 text-xs font-mono text-gray-500">
                {sectionFullyLocked ? (
                  <Lock className="w-3.5 h-3.5 text-gray-400" />
                ) : (
                  <span dir="ltr">
                    {sectionCompleted}/{videos.length}
                  </span>
                )}
              </span>
            </button>

            {/* Per-section purchase (sectional courses only). The buy
                components hide themselves for owned sections / non-sectional
                access; the yellow chip shell only wraps fully locked
                sections so it never renders empty. Purchase logic and
                handlers are the existing SectionalBuyButtons, unmodified. */}
            {isSectionalCourse &&
              realSection &&
              (sectionFullyLocked ? (
                <div className="mx-3 mb-2 rounded-md border border-brand-yellow-200 bg-brand-yellow-50 p-3">
                  <p className="text-sm font-bold text-navy-950 leading-snug">
                    {realSection.title}
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    {videos.length} دروس مقفلة
                  </p>
                  <SectionalBuyButtons
                    course={course}
                    section={realSection}
                    enrollment={enrollment}
                    positionInOrder={idx}
                  />
                </div>
              ) : (
                <div className="px-3 py-2 bg-white border-t border-gray-100">
                  <SectionalBuyButtons
                    course={course}
                    section={realSection}
                    enrollment={enrollment}
                    positionInOrder={idx}
                  />
                </div>
              ))}

            {/* Videos on the progress spine */}
            {isExpanded && (
              <div className="relative border-t border-gray-100">
                {/* The rail: a 2px line running along the lesson dots. */}
                <span className="absolute inset-y-0 start-[25px] w-0.5 bg-gray-200" />
                {videos.map((video, idx) => {
                  const videoIndex = allVideos.indexOf(video);
                  const isActive = videoIndex === currentVideoIndex;
                  const isCompleted = completedVideos.has(video.videoId);
                  const isLocked = lockStates[idx];

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
  totalVideos,
  totalDuration,
  children,
}: {
  progress: number;
  totalVideos: number;
  totalDuration: number;
  children: React.ReactNode;
}) {
  return (
    <aside className="hidden lg:block bg-white border-s border-gray-200">
      <div className="lg:sticky lg:top-14 flex flex-col h-[calc(100vh-3.5rem)]">
        {/* Header */}
        <div className="flex-shrink-0 bg-white p-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-navy-950 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-navy-800" />
              محتوى الدورة
            </h2>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {totalVideos} درسًا · {formatTotalDuration(totalDuration)}
            </span>
          </div>
          <div className="mt-3 h-[7px] rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Scrollable Sections */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          {children}
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: var(--surface);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--muted-foreground);
        }
      `}</style>
    </aside>
  );
}
