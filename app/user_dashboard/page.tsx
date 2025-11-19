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
  const [favorites, setFavorites] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          return;
        }

        if (favoritesResult.success && favoritesResult.favorites) {
          setFavorites(favoritesResult.favorites);
        } else if (!favoritesResult.success) {
          console.error("Failed to load favorites:", favoritesResult);
          // Continue without favorites - non-critical error
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

  // Loading skeleton
  if (!auth.isClient || loading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="h-7 sm:h-8 bg-gray-200 rounded-lg animate-pulse w-1/2 sm:w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse shadow-sm rounded-2xl">
              <CardContent className="p-4 sm:p-6 space-y-3">
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-6 sm:h-7 bg-gray-200 rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="p-6 sm:p-8 text-center shadow-lg border border-red-100 rounded-3xl max-w-md w-full">
          <CardHeader className="space-y-3">
            <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 mx-auto" />
            <CardTitle className="text-lg sm:text-xl text-red-700">
              خطأ في التحميل
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-gray-600">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
            >
              إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = auth.user?.displayName || "عزيزي المتعلم";

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      {/* Welcome Header */}
      <section>
        <div className="bg-blue-600 rounded-3xl p-6 sm:p-8 lg:p-10 text-white shadow-lg">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex-1 space-y-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                مرحباً، {displayName} 👋
              </h1>
              <p className="text-blue-100 text-sm sm:text-base lg:text-lg max-w-2xl">
                استمر في رحلة التعلم وحقق أهدافك التعليمية اليوم.
              </p>
            </div>

            <div className="bg-blue-700 rounded-2xl px-4 py-3 border border-blue-500 min-w-[120px] text-center shadow-md">
              <p className="text-xs text-blue-100 mb-1">📚 دوراتي المسجلة</p>
              <p className="text-2xl font-extrabold">
                {enrolledCourses.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      {stats && (
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card className="rounded-2xl shadow-sm border border-blue-100">
              <CardContent className="p-4 sm:p-5 space-y-2">
                <p className="text-xs text-gray-500">الدورات المسجلة</p>
                <p className="text-2xl font-bold text-blue-700">
                  {stats.enrolledCoursesCount}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border border-emerald-100">
              <CardContent className="p-4 sm:p-5 space-y-2">
                <p className="text-xs text-gray-500">الدورات المكتملة</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {stats.completedCoursesCount}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border border-amber-100">
              <CardContent className="p-4 sm:p-5 space-y-2">
                <p className="text-xs text-gray-500">الدورات التي أنشأتها</p>
                <p className="text-2xl font-bold text-amber-700">
                  {stats.createdCoursesCount}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border border-purple-100">
              <CardContent className="p-4 sm:p-5 space-y-2">
                <p className="text-xs text-gray-500">
                  إجمالي وقت التعلم (ساعة)
                </p>
                <p className="text-2xl font-bold text-purple-700">
                  {stats.totalLearningTime}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Enrolled Courses */}
      <section>
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-6 sm:px-8 sm:py-8 border-b border-gray-100">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-500 rounded-2xl shadow-md">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                دوراتي المسجلة
              </h2>
              <p className="text-gray-600 max-w-2xl text-sm sm:text-base">
                تابع تقدمك في الدورات التي التحقت بها مؤخراً واستمر في التعلم.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {enrolledCourses.length === 0 ? (
              <div className="text-center space-y-4">
                <p className="text-gray-600 text-sm sm:text-base">
                  لم تقم بالتسجيل في أي دورة بعد.
                </p>
                <Link href="/" className="inline-block">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    استكشف الدورات الآن
                  </Button>
                </Link>
              </div>
            ) : (
              <CoursesCardList
                data={{
                  success: true,
                  courses: enrolledCourses,
                  hasMore: false,
                  nextCursor: null,
                }}
              />
            )}
          </div>
        </div>
      </section>

      {/* Favorites */}
      {favorites.length > 0 && (
        <section>
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-6 py-6 sm:px-8 sm:py-8 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-pink-500 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-xl">❤️</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  المفضلة
                </h2>
              </div>
              <p className="text-gray-600 text-sm sm:text-base">
                الدورات التي قمت بحفظها في قائمة المفضلة للرجوع إليها لاحقاً.
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

      {/* Quick Actions */}
      <section>
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-6 sm:px-8 sm:py-8 border-b border-gray-100">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500 rounded-2xl shadow-md">
                <span className="text-2xl">⚡</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                الإجراءات السريعة
              </h2>
              <p className="text-gray-600 text-sm sm:text-base">
                اختصارات لأهم الوظائف التي تحتاجها بسرعة.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link href="/" className="group">
                <div className="relative h-full bg-blue-50 border-2 border-blue-100 hover:border-blue-400 rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-semibold text-gray-800 text-sm sm:text-base">
                      استكشف الدورات
                    </span>
                  </div>
                </div>
              </Link>

              <Link href="/course-upload" className="group">
                <div className="relative h-full bg-green-50 border-2 border-green-100 hover:border-green-400 rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <Plus className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-semibold text-gray-800 text-sm sm:text-base">
                      إنشاء دورة جديدة
                    </span>
                  </div>
                </div>
              </Link>

              <Link
                href="/user_dashboard/certificates"
                className="group sm:col-span-2 lg:col-span-1"
              >
                <div className="relative h-full bg-amber-50 border-2 border-amber-100 hover:border-amber-400 rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
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
      </section>
    </div>
  );
}
