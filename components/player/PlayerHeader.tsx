"use client";

import { ChevronLeft, User } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Course } from "@/types/types";

export default function PlayerHeader({ course }: { course: Course }) {
  return (
    <header className="flex items-center justify-between px-3 lg:px-4 py-2 lg:py-3 bg-white border-b border-gray-200">
      <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
        <div className="min-w-0">
          <h1
            title={course.title}
            className="text-sm lg:text-lg font-semibold truncate"
          >
            {course.title}
          </h1>
          <p className="hidden sm:inline-flex mt-1 items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-slate-100 to-gray-100 border border-slate-200 text-slate-700 text-xs font-medium max-w-fit">
            <User className="w-3 h-3 text-slate-500" />
            <span className="truncate max-w-[220px]">
              {course.instructorName || "مدرب غير معروف"}
            </span>
          </p>
        </div>
      </div>
      <Link href="/">
        <Button
          variant="outline"
          size="sm"
          className="flex-shrink-0 text-xs lg:text-sm"
        >
          <ChevronLeft className="w-3 h-3 lg:w-4 lg:h-4 ml-1" />
          <span className="hidden sm:inline">العودة</span>
        </Button>
      </Link>
    </header>
  );
}
