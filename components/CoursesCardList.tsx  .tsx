"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Star,
  Users,
  Play,
  Award,
  Edit,
  Trash2,
  BookOpen,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Course, CourseResponse } from "@/types/types";
import {
  checkUserEnrollments,
  enrollInFreeCourse,
} from "@/app/actions/enrollment_action";
import { useAuth } from "@/context/authContext";

// ===== TYPES =====

interface CoursesCardListProps {
  data: CourseResponse;
  isAdminView?: boolean;
  onDeleteCourse?: (courseId: string) => void;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Formats Firebase Storage path to full URL
 */
const getImageUrl = (thumbnailUrl?: string): string => {
  // No thumbnail provided
  if (!thumbnailUrl) {
    return "/images/course-placeholder.jpg";
  }

  // Already a full URL
  if (thumbnailUrl.startsWith("http")) {
    return thumbnailUrl;
  }

  // Format Firebase Storage URL
  return `https://firebasestorage.googleapis.com/v0/b/readiq-1f109.firebasestorage.app/o/${encodeURIComponent(
    thumbnailUrl
  )}?alt=media`;
};

/**
 * Formats student count with K notation
 */
const formatStudentsCount = (count?: number): string => {
  if (!count || count === 0) return "0";
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

/**
 * Formats duration in minutes to readable string
 */
const formatDuration = (minutes?: number): string => {
  if (!minutes || minutes === 0) return "غير محدد";
  if (minutes < 60) return `${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) return `${hours} ساعة`;
  return `${hours} س ${remainingMins} د`;
};

/**
 * Gets localized language name
 */
const getLanguageName = (lang?: string): string => {
  const languageMap: Record<string, string> = {
    arabic: "العربية",
    english: "English",
    french: "Français",
    spanish: "Español",
  };
  return languageMap[lang || "arabic"] || lang || "العربية";
};

/**
 * Gets localized level name
 */
const getLevelName = (level?: string): string => {
  const levelMap: Record<string, string> = {
    beginner: "مبتدئ",
    intermediate: "متوسط",
    advanced: "متقدم",
    all_levels: "جميع المستويات",
  };
  return levelMap[level || "beginner"] || "مبتدئ";
};

// ===== SUB-COMPONENTS =====

/**
 * Star Rating Component
 */
const StarRating = memo(({ rating = 4.0 }: { rating?: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`تقييم ${rating} من 5`}
    >
      {/* Full Stars */}
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star
          key={`full-${i}`}
          className="w-4 h-4 fill-amber-400 text-amber-400"
          aria-hidden="true"
        />
      ))}
      {/* Half Star */}
      {hasHalfStar && (
        <Star
          className="w-4 h-4 fill-amber-400 text-amber-400 opacity-60"
          aria-hidden="true"
        />
      )}
      {/* Empty Stars */}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star
          key={`empty-${i}`}
          className="w-4 h-4 text-gray-300"
          aria-hidden="true"
        />
      ))}
      <span className="text-sm font-semibold text-gray-700 mr-1 bg-white/80 px-1.5 py-0.5 rounded-full">
        {rating.toFixed(1)}
      </span>
    </div>
  );
});
StarRating.displayName = "StarRating";

/**
 * Empty State Component
 */
const EmptyState = memo(() => (
  <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
    <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md">
      <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
        <BookOpen className="w-8 h-8 text-white" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">لا توجد دورات</h3>
      <p className="text-gray-600">لا توجد دورات متاحة في الوقت الحالي</p>
    </div>
  </div>
));
EmptyState.displayName = "EmptyState";

/**
 * Error State Component
 */
const ErrorState = memo(({ message }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
    <div className="bg-gradient-to-br from-red-50 to-rose-100 rounded-2xl shadow-lg border border-red-200 p-8 max-w-md">
      <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-8 h-8 text-white" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-bold text-red-800 mb-2">خطأ في التحميل</h3>
      <p className="text-red-600">{message || "حدث خطأ غير متوقع"}</p>
    </div>
  </div>
));
ErrorState.displayName = "ErrorState";

/**
 * Course Card Component
 */
// Update the CourseCard component
const CourseCard = memo(
  ({
    course,
    isAdminView,
    onDelete,
    isEnrolled = false,
    enrollmentLoading = false,
    onEnrollmentUpdate,
  }: {
    course: Course;
    isAdminView: boolean;
    onDelete?: (id: string) => void;
    isEnrolled?: boolean;
    enrollmentLoading?: boolean;
    onEnrollmentUpdate?: (courseId: string) => void;
  }) => {
    const auth = useAuth();
    const handleFreeEnrollment = async (courseId: string) => {
      if (!auth?.user) {
        return;
      }

      const token = await auth.user.getIdToken();
      const result = await enrollInFreeCourse(courseId, token);

      if (result.success) {
        // Update local enrollment status
        onEnrollmentUpdate?.(courseId); // Show success message, redirect to course page
        window.location.href = `/Course/${courseId}`;
      } else {
        // Show error message
        alert(result.message || "فشل الاشتراك في الدورة");
      }
    };
    const imageUrl = useMemo(
      () => getImageUrl(course.thumbnailUrl),
      [course.thumbnailUrl]
    );
    const languageName = useMemo(
      () => getLanguageName(course.language),
      [course.language]
    );
    const levelName = useMemo(() => getLevelName(course.level), [course.level]);

    const rating = course.rating || 4.2;
    const studentsCount = course.studentsCount || 0;
    const instructor = course.instructor || "مدرب محترف";

    // ✅ Card content component
    const cardContent = (
      <Card className="group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border-0 shadow-lg overflow-hidden bg-white rounded-2xl">
        {/* Course Image */}
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 h-48">
          <Image
            src={imageUrl}
            fill
            alt={course.title}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            priority={false}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

          {!isAdminView && (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-purple-600/0 group-hover:from-blue-600/20 group-hover:to-purple-600/20 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center">
              <div className="bg-white/95 rounded-full p-4 transform scale-75 group-hover:scale-100 transition-all duration-300 shadow-2xl">
                <Play className="w-6 h-6 text-gray-800 fill-current" />
              </div>
            </div>
          )}

          {course.status === "published" && (
            <Badge className="absolute top-3 right-3 bg-green-500 text-white border-0 shadow-lg">
              منشور
            </Badge>
          )}
        </div>

        <CardHeader className="pb-3 pt-5">
          <CardTitle className="text-lg font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors text-right">
            {course.title}
          </CardTitle>
          {course.subtitle && (
            <CardDescription className="text-sm text-gray-600 text-right line-clamp-2 mt-1">
              {course.subtitle}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="pt-0 text-right space-y-3">
          <div className="flex items-center gap-2 flex-row-reverse bg-gray-50 rounded-lg p-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Award className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-gray-700 font-medium truncate">
              {instructor}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-row-reverse justify-between">
            <StarRating rating={rating} />
            <div className="flex items-center text-sm text-gray-600 gap-1 bg-blue-50 rounded-full px-3 py-1">
              <Users className="w-4 h-4" />
              <span className="font-medium">
                {formatStudentsCount(studentsCount)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5 gap-2">
            {course.duration && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatDuration(course.duration)}</span>
              </div>
            )}
            <span className="font-medium text-gray-700">{languageName}</span>
            <span className="text-blue-600 font-medium">{levelName}</span>
          </div>

          {course.price !== undefined && (
            <div className="text-center py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
              <span className="text-2xl font-bold text-blue-600">
                {course.price === 0 ? "مجاني" : `$${course.price}`}
              </span>
            </div>
          )}

          {/* ✅ Admin buttons */}
          {isAdminView && (
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <Link
                href={`/course-upload/edit/${course.id}`}
                className="flex-1"
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  <Edit className="w-3.5 h-3.5 ml-1" />
                  تعديل
                </Button>
              </Link>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(course.id);
                }}
              >
                <Trash2 className="w-3.5 h-3.5 ml-1" />
                حذف
              </Button>
            </div>
          )}
          {!isAdminView && (
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              {enrollmentLoading ? (
                <Button size="sm" variant="outline" className="w-full" disabled>
                  جاري التحميل...
                </Button>
              ) : isEnrolled ? (
                <Link href={`/Course/${course.id}`} className="w-full">
                  <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    متابعة الدورة
                  </Button>
                </Link>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!auth?.user) {
                      alert("يرجى تسجيل الدخول أولاً");
                      return;
                    }
                    if (course.price === 0) {
                      handleFreeEnrollment(course.id);
                    } else {
                      // Handle paid course enrollment here
                      // You can call initiatePurchase or redirect to payment
                      console.log("Handle paid course:", course.id);
                    }
                  }}
                >
                  {course.price === 0
                    ? "اشتراك مجاني"
                    : `شراء الدورة - $${course.price}`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );

    // ✅ Conditionally wrap with Link
    return isAdminView || isEnrolled ? (
      isAdminView ? (
        cardContent
      ) : (
        <Link href={`/Course/${course.id}`} className="block">
          {cardContent}
        </Link>
      )
    ) : (
      cardContent
    );
  }
);

CourseCard.displayName = "CourseCard";

// ===== MAIN COMPONENT =====

export default function CoursesCardList({
  data,
  isAdminView = false,
  onDeleteCourse,
}: CoursesCardListProps) {
  const auth = useAuth();
  const [enrollmentStatus, setEnrollmentStatus] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnrollments = async () => {
      if (!auth?.user || isAdminView || !data.courses) {
        setLoading(false);
        return;
      }

      const courseIds = data.courses.map((course) => course.id);
      const result = await checkUserEnrollments(auth.user.uid, courseIds);

      if (result.success) {
        setEnrollmentStatus(result.enrollments);
      } else {
        console.error("Failed to check enrollments:", result.message);
        setEnrollmentStatus({});
      }
      setLoading(false);
    };

    fetchEnrollments();
  }, [auth?.user, data.courses, isAdminView]);

  // Error State
  if (!data.success || data.error) {
    return <ErrorState message={data.error} />;
  }

  // Empty State
  if (!data.courses || data.courses.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-8" role="region" aria-label="قائمة الدورات">
      {/* Courses Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {data.courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            isAdminView={isAdminView}
            onDelete={onDeleteCourse}
            isEnrolled={enrollmentStatus[course.id] || false}
            enrollmentLoading={loading}
            onEnrollmentUpdate={(courseId) => {
              setEnrollmentStatus((prev) => ({ ...prev, [courseId]: true }));
            }}
          />
        ))}
      </div>

      {/* Pagination Info */}
      {data.hasMore && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-600">المزيد من الدورات متاحة...</p>
        </div>
      )}
    </div>
  );
}
