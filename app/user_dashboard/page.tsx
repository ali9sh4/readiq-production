"use client";

import { useEffect, useState } from "react";
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
import { getUserEnrolledCoursesWithStats } from "./actions";
import CoursesCardList from "@/components/CoursesCardList.tsx  ";
import { Course } from "@/types/types";
import { getUserFavorites } from "../actions/favorites_actions";

interface DashboardStats {
  enrolledCoursesCount: number;
  createdCoursesCount: number;
  completedCoursesCount: number;
  totalLearningTime: number;
}

export default function DashboardHome() {
  const auth = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!auth.user) return;

      try {
        setLoading(true);
        setError(null);
        const token = await auth.user.getIdToken();
        const [enrolledData, favoritesResult] = await Promise.all([
          getUserEnrolledCoursesWithStats(token, 20),
          getUserFavorites(token, 6),
        ]);

        if (
          enrolledData.success &&
          enrolledData.stats &&
          enrolledData.courses
        ) {
          setStats(enrolledData.stats);
          setEnrolledCourses(enrolledData.courses);
        } else {
          setError("حدث خطأ أثناء تحميل بيانات لوحة التحكم");
        }

        if (favoritesResult.success && favoritesResult.favorites) {
          setFavorites(favoritesResult.favorites);
        }
      } catch (err) {
        console.error("Dashboard error:", {
          message: err instanceof Error ? err.message : "Unknown error",
        });
        setError("حدث خطأ أثناء تحميل البيانات");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [auth.user]);

  if (!auth.isClient || loading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="h-6 sm:h-8 bg-gray-200 rounded-lg animate-pulse w-1/2 sm:w-1/3"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse shadow-sm rounded-xl">
              <CardContent className="p-4 sm:p-6">
                <div className="h-3 sm:h-4 bg-gray-200 rounded mb-2 sm:mb-3"></div>
                <div className="h-6 sm:h-8 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="p-6 sm:p-8 text-center shadow-lg border border-red-100 rounded-2xl max-w-md w-full">
          <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-red-700 mb-2">
            خطأ في التحميل
          </h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
            {error}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
          >
            إعادة المحاولة
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      {/* Welcome Header - Enhanced */}
      <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-6 sm:p-8 lg:p-10 text-white shadow-2xl overflow-hidden group">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,_rgba(120,119,198,0.3),_rgba(255,255,255,0))]"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-blue-400/20 rounded-full blur-2xl"></div>

        <div className="relative z-10">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3 drop-shadow-lg">
                مرحباً، {auth.user?.displayName || "عزيزي المتعلم"} 👋
              </h1>
              <p className="text-blue-50 text-sm sm:text-base lg:text-lg max-w-2xl">
                استمر في رحلة التعلم وحقق أهدافك التعليمية اليوم
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/30">
              <p className="text-xs text-blue-50">📚 دوراتي</p>
              <p className="text-2xl font-bold">{enrolledCourses.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Enrolled Courses - Enhanced */}
      <section className="relative">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 px-6 py-8 sm:px-8 sm:py-10 border-b border-gray-100">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-4">
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
            />
          </div>
        </div>
      </section>

      {/* Favorites - Enhanced */}
      {favorites.length > 0 && (
        <section className="relative">
          <div className="bg-gradient-to-br from-pink-50 via-red-50 to-orange-50 rounded-3xl shadow-lg border border-pink-100 overflow-hidden">
            <div className="px-6 py-6 sm:px-8 sm:py-8 border-b border-pink-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
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

      {/* Quick Actions - Enhanced */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 px-6 py-6 sm:px-8 sm:py-8 border-b border-gray-100">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg mb-3">
              <span className="text-2xl">⚡</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">
              الإجراءات السريعة
            </h2>
            <p className="text-gray-600 text-sm sm:text-base">
              اختصارات لأهم الوظائف التي تحتاجها بسرعة
            </p>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/" className="group">
              <div className="relative h-full bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100 hover:border-blue-400 rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-semibold text-gray-800 text-sm sm:text-base">
                    استكشف الدورات
                  </span>
                </div>
              </div>
            </Link>
            <Link href="/course-upload" className="group">
              <div className="relative h-full bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-100 hover:border-green-400 rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-semibold text-gray-800 text-sm sm:text-base">
                    إنشاء دورة جديدة
                  </span>
                </div>
              </div>
            </Link>
            <Link href="/user_dashboard/certificates" className="group sm:col-span-2 lg:col-span-1">
              <div className="relative h-full bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-100 hover:border-amber-400 rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-semibold text-gray-800 text-sm sm:text-base">
                    عرض الشهادات
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
