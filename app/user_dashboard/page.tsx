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
import {
  BookOpen,
  Users,
  Award,
  Clock,
  Plus,
  AlertCircle,
  Play,
} from "lucide-react";
import { getDashboardStats, getUserEnrolledCourses } from "./actions";

interface DashboardStats {
  enrolledCoursesCount: number;
  createdCoursesCount: number;
  completedCoursesCount: number;
  totalLearningTime: number;
}

interface Course {
  id: string;
  title: string;
  thumbnailUrl?: string;
  instructor?: string;
  level?: string;
  duration?: number;
}

export default function DashboardHome() {
  const auth = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllCourses, setShowAllCourses] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!auth.user) return;

      try {
        setLoading(true);
        setError(null);

        // ✅ Force token refresh for security
        const token = await auth.user.getIdToken(true);

        const [statsResult, coursesResult] = await Promise.all([
          getDashboardStats(token),
          getUserEnrolledCourses(token),
        ]);

        if (statsResult.success && statsResult.stats) {
          setStats(statsResult.stats);
        }

        if (coursesResult.success && coursesResult.courses) {
          setEnrolledCourses(coursesResult.courses);
        }

        if (!statsResult.success || !coursesResult.success) {
          setError("حدث خطأ أثناء تحميل بيانات لوحة التحكم");
        }
      } catch (err) {
        // ✅ Safe error logging
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

  const formatDuration = (minutes: number): string => {
    if (!minutes || minutes < 60) return `${minutes || 0} دقيقة`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (remainingMins === 0) return `${hours} ساعة`;
    return `${hours} س ${remainingMins} د`;
  };

  // ✅ Show first 6, with option to show more
  const displayedCourses = showAllCourses
    ? enrolledCourses
    : enrolledCourses.slice(0, 6);

  if (!auth.isClient || loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="p-6 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">
            خطأ في التحميل
          </h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            إعادة المحاولة
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-l from-blue-600 to-indigo-700 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">
          مرحباً، {auth.user?.displayName || "عزيزي المتعلم"}
        </h1>
        <p className="text-blue-100 text-lg">
          استمر في رحلة التعلم وحقق أهدافك التعليمية
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">
                  الدورات المسجلة
                </p>
                <p className="text-2xl font-bold text-blue-700">
                  {stats?.enrolledCoursesCount || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">
                  الدورات المكتملة
                </p>
                <p className="text-2xl font-bold text-green-700">
                  {stats?.completedCoursesCount || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">
                  الدورات المنشأة
                </p>
                <p className="text-2xl font-bold text-purple-700">
                  {stats?.createdCoursesCount || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium">
                  إجمالي ساعات التعلم
                </p>
                <p className="text-2xl font-bold text-orange-700">
                  {stats?.totalLearningTime
                    ? formatDuration(stats.totalLearningTime)
                    : "0 د"}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enrolled Courses */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">دوراتي المسجلة</CardTitle>
          <CardDescription>
            {enrolledCourses.length > 0
              ? `${enrolledCourses.length} دورة`
              : "لا توجد دورات"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enrolledCourses.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedCourses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">
                        {course.title || "دورة بدون عنوان"}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {course.instructor || "بدون مدرس"} •{" "}
                        {course.level || "جميع المستويات"}
                      </p>
                    </div>
                    <Link href={`/Course/${course.id}`}>
                      <Button size="sm" variant="outline">
                        <Play className="w-4 h-4 ml-1" />
                        متابعة
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>

              {enrolledCourses.length > 6 && (
                <div className="mt-4 text-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowAllCourses(!showAllCourses)}
                  >
                    {showAllCourses
                      ? "عرض أقل"
                      : `عرض الكل (${enrolledCourses.length - 6} أخرى)`}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">لم تسجل في أي دورة بعد</p>
              <Link href="/">
                <Button>استكشف الدورات</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg bg-gradient-to-l from-gray-50 to-white">
        <CardHeader>
          <CardTitle className="text-xl">الإجراءات السريعة</CardTitle>
          <CardDescription>اختصارات لأهم الوظائف</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/">
              <Button
                variant="outline"
                className="w-full h-16 flex flex-col gap-2"
              >
                <BookOpen className="w-5 h-5" />
                <span>استكشف الدورات</span>
              </Button>
            </Link>
            <Link href="/course-upload">
              <Button
                variant="outline"
                className="w-full h-16 flex flex-col gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>إنشاء دورة جديدة</span>
              </Button>
            </Link>
            <Link href="/dashboard/certificates">
              <Button
                variant="outline"
                className="w-full h-16 flex flex-col gap-2"
              >
                <Award className="w-5 h-5" />
                <span>عرض الشهادات</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
