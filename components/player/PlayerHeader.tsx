"use client";

import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Course } from "@/types/types";

// Sticky theater top bar: navy shell, course identity, and the session
// progress ring. Progress derives from the same completed-lessons state the
// sidebar uses — no logic of its own.
export default function PlayerHeader({
  course,
  currentSectionTitle,
  progress,
  completedCount,
  totalVideos,
  sidebarOpen,
  onToggleSidebar,
}: {
  course: Course;
  currentSectionTitle: string | null;
  progress: number;
  completedCount: number;
  totalVideos: number;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-50 h-14 flex items-center justify-between gap-2 px-3 lg:px-4 bg-navy-950 border-b border-white/5">
      <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
        <Link href="/">
          <Button
            variant="outline"
            size="sm"
            className="flex-shrink-0 gap-1 text-xs lg:text-sm bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
          >
            <ChevronRight className="w-3 h-3 lg:w-4 lg:h-4" />
            <span className="hidden sm:inline">العودة</span>
          </Button>
        </Link>
        <div className="min-w-0">
          <h1
            title={course.title}
            className="text-sm lg:text-base font-bold text-white truncate leading-tight"
          >
            {course.title}
          </h1>
          {currentSectionTitle && (
            <p className="text-xs text-navy-100/70 truncate leading-tight">
              {currentSectionTitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
        <span className="hidden sm:block text-xs text-navy-100/70 whitespace-nowrap">
          {completedCount} من {totalVideos} درسًا
        </span>
        {/* Conic progress ring — brand-accent fill over a white/10 track. */}
        <div
          role="img"
          aria-label={`اكتمل ${progress}%`}
          className="relative w-9 h-9 rounded-full flex-shrink-0"
          style={{
            background: `conic-gradient(var(--brand-accent) ${
              progress * 3.6
            }deg, rgba(255, 255, 255, 0.1) 0deg)`,
          }}
        >
          <div className="absolute inset-[3px] rounded-full bg-navy-950 flex items-center justify-center">
            <span
              dir="ltr"
              className="text-[10px] font-mono font-bold text-white leading-none"
            >
              {progress}%
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "وضع التركيز" : "إظهار قائمة الدروس"}
          className="hidden lg:inline-flex bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
        >
          {/* The sidebar is the inline-end column — visually LEFT under the
              app's permanent RTL — so the left-panel glyphs are correct. */}
          {sidebarOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
