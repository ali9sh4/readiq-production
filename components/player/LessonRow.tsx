"use client";

import { CheckCircle, Clock, Lock, PlayCircle } from "lucide-react";
import { CourseVideo } from "@/types/types";
import { formatDuration } from "./shared";

export default function LessonRow({
  video,
  idx,
  isActive,
  isCompleted,
  isLocked,
  onSelect,
}: {
  video: CourseVideo;
  idx: number;
  isActive: boolean;
  isCompleted: boolean;
  isLocked: boolean;
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
          title={video.title}
          className={`font-medium text-sm lg:text-base leading-snug line-clamp-2 break-words ${
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
}
