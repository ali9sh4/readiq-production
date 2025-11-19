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
    <div className="space-y-8 sm:space-y-12 lg:space-y-16">
      {/* Welcome Header - Responsive */}
      <div className="bg-gradient-to-l from-blue-700 via-blue-600 to-indigo-700 rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/patterns/waves.svg')] opacity-10"></div>
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3 drop-shadow">
            مرحباً، {auth.user?.displayName || "عزيزي المتعلم"} 👋
          </h1>
          <p className="text-blue-100 text-sm sm:text-base lg:text-lg">
            استمر في رحلة التعلم وحقق أهدافك التعليمية اليوم
          </p>
        </div>
      </div>

      {/* Enrolled Courses - Responsive */}
      <section className="py-8 sm:py-12 lg:py-16 bg-gray-50 rounded-2xl sm:rounded-3xl">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-10 lg:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
              📘 دوراتي المسجلة
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-sm sm:text-base lg:text-lg px-4">
              تابع الدورات التي التحقت بها مؤخرًا واستمر بالتعلم
            </p>
          </div>

          <CoursesCardList
            data={{
              success: true,
              courses: enrolledCourses,
              hasMore: false,
              nextCursor: null,
            }}
          />
        </div>
      </section>

      {/* Favorites - Responsive */}
      {favorites.length > 0 && (
        <section className="py-8 sm:py-12 lg:py-16 bg-white">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-6 sm:mb-8 lg:mb-10">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
                ❤️ المفضلة
              </h2>
            </div>
            <CoursesCardList
              data={{
                success: true,
                courses: favorites,
                hasMore: false,
                nextCursor: null,
              }}
            />
          </div>
        </section>
      )}

      {/* Quick Actions - Responsive */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-gray-50 to-white rounded-2xl sm:rounded-3xl hover:shadow-2xl transition-all duration-300">
        <CardHeader className="text-center px-4 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl font-semibold text-gray-800">
            ⚡ الإجراءات السريعة
          </CardTitle>
          <CardDescription className="text-gray-500 mt-1 text-sm sm:text-base">
            اختصارات لأهم الوظائف التي تحتاجها بسرعة
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            <Link href="/">
              <Button
                variant="outline"
                className="w-full h-16 sm:h-20 flex flex-col justify-center items-center gap-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-300 rounded-lg sm:rounded-xl"
              >
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                <span className="font-medium text-gray-800 text-sm sm:text-base">
                  استكشف الدورات
                </span>
              </Button>
            </Link>
            <Link href="/course-upload">
              <Button
                variant="outline"
                className="w-full h-16 sm:h-20 flex flex-col justify-center items-center gap-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all duration-300 rounded-lg sm:rounded-xl"
              >
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                <span className="font-medium text-gray-800 text-sm sm:text-base">
                  إنشاء دورة جديدة
                </span>
              </Button>
            </Link>
            <Link href="/user_dashboard/certificates">
              <Button
                variant="outline"
                className="w-full h-16 sm:h-20 flex flex-col justify-center items-center gap-2 border-gray-200 hover:border-yellow-500 hover:bg-yellow-50 transition-all duration-300 rounded-lg sm:rounded-xl sm:col-span-2 lg:col-span-1"
              >
                <Award className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                <span className="font-medium text-gray-800 text-sm sm:text-base">
                  عرض الشهادات
                </span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
