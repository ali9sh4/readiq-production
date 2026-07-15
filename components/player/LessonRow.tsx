"use client";

import { Check, Lock, Play } from "lucide-react";
import { CourseVideo } from "@/types/types";
import { formatDuration } from "./shared";

// One lesson row on the progress spine. The 14px dot is a pure state
// indicator (no numbering): hollow = not started, success check = done,
// brand-accent play = active, dashed lock = locked.
export default function LessonRow({
  video,
  isActive,
  isCompleted,
  isLocked,
  showFreePreviewBadge,
  onSelect,
}: {
  video: CourseVideo;
  isActive: boolean;
  isCompleted: boolean;
  isLocked: boolean;
  showFreePreviewBadge: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={() => {
        if (!isLocked) {
          onSelect();
        }
      }}
      disabled={isLocked}
      className={`relative w-full ps-4 pe-3 py-2.5 flex items-center gap-3 transition-colors ${
        isActive ? "bg-navy-100" : isLocked ? "" : "hover:bg-surface"
      } ${isLocked ? "cursor-not-allowed" : ""}`}
    >
      {/* Active marker on the row's inline-start edge */}
      {isActive && (
        <span className="absolute inset-y-0 start-0 w-[3.5px] bg-brand-accent" />
      )}

      {/* Spine dot — state only */}
      <span
        className={`relative z-[1] flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${
          isCompleted
            ? "bg-success text-white"
            : isActive
              ? "bg-brand-accent text-navy-950"
              : isLocked
                ? "bg-white border-2 border-dashed border-gray-300 text-gray-400"
                : "bg-white border-2 border-gray-300"
        }`}
      >
        {isCompleted ? (
          <Check className="w-2.5 h-2.5" strokeWidth={3.5} />
        ) : isActive ? (
          <Play className="w-2 h-2 fill-current" />
        ) : isLocked ? (
          <Lock className="w-2 h-2" />
        ) : null}
      </span>

      <span className="flex-1 text-start min-w-0">
        <span
          title={video.title}
          className={`block leading-snug line-clamp-2 break-words text-sm ${
            isActive
              ? "font-bold text-navy-950"
              : isCompleted
                ? "font-normal text-gray-600"
                : isLocked
                  ? "font-normal text-gray-400"
                  : "font-medium text-gray-900"
          }`}
        >
          {video.title}
        </span>
        {video.isFreePreview && showFreePreviewBadge && (
          <span className="mt-0.5 inline-block text-xs bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium">
            معاينة مجانية
          </span>
        )}
      </span>

      <span
        dir="ltr"
        className="flex-shrink-0 text-xs font-mono text-gray-400 text-end"
      >
        {formatDuration(video.duration)}
      </span>
    </button>
  );
}
