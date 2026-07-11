// /components/DashboardHome.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/authContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Award, Plus, AlertCircle } from "lucide-react";
import CoursesCardList from "@/components/CoursesCardList";
import PhoneNudgeBanner from "@/components/PhoneNudgeBanner";
import PhoneConsentCard from "@/components/PhoneConsentCard";
import { Course } from "@/types/types";

interface DashboardStats {
  enrolledCoursesCount: number;
  createdCoursesCount: number;
  completedCoursesCount: number;
  totalLearningTime: number;
}

interface DashboardHomeProps {
  initialEnrolledCourses: Course[];
  initialFavorites: any[];
  initialStats: DashboardStats | null;
  // Time-limited access: courseId -> accessExpiresAt stamp for the
  // remaining-days counter on the enrolled-courses cards.
  accessExpiresAtByCourseId?: Record<string, string>;
  // True when the logged-in user is a course creator with no phone on file.
  needsPhone?: boolean;
  // True when the post-login phone+consent capture card should be shown (user
  // has no phone and hasn't chosen "don't ask again").
  showPhonePrompt?: boolean;
}

export default function DashboardHome({
  initialEnrolledCourses,
  initialFavorites,
  initialStats,
  accessExpiresAtByCourseId,
  needsPhone = false,
  showPhonePrompt = false,
}: DashboardHomeProps) {
  const auth = useAuth();

  // ✅ Use initial data - no loading state needed!
  const [enrolledCourses] = useState<Course[]>(initialEnrolledCourses);
  const [favorites] = useState<any[]>(initialFavorites);
  const [stats] = useState<DashboardStats | null>(initialStats);

  // ✅ No useEffect, no loading, instant render!

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      {/* Post-login phone + WhatsApp marketing-consent capture (web-only). */}
      <PhoneConsentCard initialShow={showPhonePrompt} />

      {/* Instructor contact-phone nudge (shared with the course edit page). The
          page suppresses this when the capture card above is showing. */}
      <PhoneNudgeBanner needsPhone={needsPhone} />

      {/* Welcome Header */}
      <div className="bg-blue-600 rounded-3xl p-6 sm:p-8 lg:p-10 text-white shadow-lg">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3">
              مرحباً، {auth.user?.displayName || "عزيزي المتعلم"} 👋
            </h1>
            <p className="text-blue-100 text-sm sm:text-base lg:text-lg max-w-2xl">
              استمر في رحلة التعلم وحقق أهدافك التعليمية اليوم
            </p>
          </div>
          <div className="bg-blue-700 rounded-2xl px-4 py-3 border border-blue-500">
            <p className="text-xs text-blue-100">📚 دوراتي</p>
            <p className="text-2xl font-bold">{enrolledCourses.length}</p>
          </div>
        </div>
      </div>

      {/* Enrolled Courses */}
      <section className="relative">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-8 sm:px-8 sm:py-10 border-b border-gray-100">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-500 rounded-2xl shadow-md mb-4">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
                دوراتي المسجلة
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto text-sm sm:text-base lg:text-lg">
                تابع الدورات التي التحقت بها مؤخرًا واستمر بالتعلم
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <CoursesCardList
              data={{
                success: true,
                courses: enrolledCourses,
                hasMore: false,
                nextCursor: null,
              }}
              accessExpiresAtByCourseId={accessExpiresAtByCourseId}
            />
          </div>
        </div>
      </section>

      {/* Favorites */}
      {favorites.length > 0 && (
        <section className="relative">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-6 py-6 sm:px-8 sm:py-8 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-pink-500 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-xl">❤️</span>
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                  المفضلة
                </h2>
              </div>
              <p className="text-gray-600 text-sm sm:text-base">
                الدورات التي قمت بحفظها في قائمة المفضلة
              </p>
            </div>
            <div className="p-6 sm:p-8">
              <CoursesCardList
                data={{
                  success: true,
                  courses: favorites,
                  hasMore: false,
                  nextCursor: null,
                }}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}