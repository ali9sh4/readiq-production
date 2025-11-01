"use client";

import { memo, useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Edit, Trash2, BookOpen, AlertCircle } from "lucide-react";
import { Course, CourseResponse } from "@/types/types";
import { checkUserEnrollments } from "@/app/actions/enrollment_action";
import { useAuth } from "@/context/authContext";

// ===== TYPES =====

interface CoursesCardListProps {
  data: CourseResponse;
  isAdminView?: boolean;
  onDeleteCourse?: (courseId: string) => void;
}

// ===== UTILITY FUNCTIONS =====

const getImageUrl = (thumbnailUrl?: string): string => {
  if (!thumbnailUrl) {
    return "/images/course-placeholder.jpg";
  }
  if (thumbnailUrl.startsWith("http")) {
    return thumbnailUrl;
  }
  return `https://firebasestorage.googleapis.com/v0/b/readiq-1f109.firebasestorage.app/o/${encodeURIComponent(
    thumbnailUrl
  )}?alt=media`;
};

// ===== SUB-COMPONENTS =====

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

// ✅ BEST PRACTICE S: Simple, clean course card
const CourseCard = memo(
  ({
    course,
    isAdminView,
    onDelete,
  }: {
    course: Course;
    isAdminView: boolean;
    onDelete?: (id: string) => void;
  }) => {
    const [imageError, setImageError] = useState(false);
    const imageUrl = useMemo(
      () => getImageUrl(course.thumbnailUrl),
      [course.thumbnailUrl]
    );

    // ✅ YOUR IMPROVEMENT: Better default values
    const rating = course.rating || 4.7;
    const studentsCount = course.studentsCount || 235305;
    const instructor = course.instructor || "Academind by Maximilian";
    const price = course.price ?? 11.99;
    const originalPrice = price > 0 ? price * 5.83 : 69.99; // Calculate to show ~$69.99

    // ✅ BEST PRACTICE: Determine which badges to show
    const showBestseller =
      course.status === "published" || studentsCount > 10000;
    const showPremium = price > 0;
    const showFree = price === 0;

    // Admin View - Not wrapped in Link
    if (isAdminView) {
      return (
        <div className="group block rounded-xl overflow-hidden bg-white shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:-translate-y-1">
          {/* Image */}
          {/* Image with Preview Overlay */}
          <Link href={`/Course/${course.id}`} className="relative block">
            <div className="relative h-40 sm:h-44 bg-gray-100 overflow-hidden group/image">
              {!imageError ? (
                <Image
                  src={imageUrl}
                  alt={course.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <BookOpen className="w-10 h-10 text-gray-400" />
                </div>
              )}

              {/* ✨ Preview Overlay - appears on hover */}
              <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/40 transition-all duration-300 flex items-center justify-center">
                <div className="opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 flex flex-col items-center gap-2">
                  <BookOpen className="w-8 h-8 text-white" />
                  <span className="text-white text-sm font-semibold">
                    معاينة الدورة
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Content */}
          <div className="p-3 space-y-2 text-right">
            <h3 className="text-sm font-bold text-gray-900 line-clamp-2">
              {course.title}
            </h3>
            <p className="text-xs text-gray-600 truncate">{instructor}</p>

            {/* Admin Actions */}
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50 text-xs"
                asChild
              >
                <Link href={`/course-upload/edit/${course.id}`}>
                  <Edit className="w-3 h-3 ml-1" />
                  تعديل
                </Link>
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(course.id);
                }}
              >
                <Trash2 className="w-3 h-3 ml-1" />
                حذف
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // ✅ YOUR IMPROVEMENT: User View - Entire card is a Link (simpler!)
    return (
      <Link
        href={`/Course/${course.id}`}
        className="group block rounded-xl overflow-hidden bg-white shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:-translate-y-1"
      >
        {/* Image with Badges */}
        <div className="relative h-40 sm:h-44 bg-gray-100 overflow-hidden">
          {!imageError ? (
            <Image
              src={imageUrl}
              alt={course.title}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-500"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <BookOpen className="w-10 h-10 text-gray-400" />
            </div>
          )}

          {/* ✅ YOUR IMPROVEMENT: Badges ON the image (bottom-left) - Very Udemy! */}
          <div className="absolute bottom-2 left-2 flex gap-2">
            {showFree && (
              <Badge className="bg-green-500 text-white font-semibold text-xs px-2 py-0.5 rounded-md shadow-sm">
                مجاني
              </Badge>
            )}
            {showBestseller && (
              <Badge className="bg-yellow-400 text-black font-semibold text-xs px-2 py-0.5 rounded-md shadow-sm">
                الأكثر مبيعاً
              </Badge>
            )}
            {showPremium && (
              <Badge className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-md shadow-sm">
                مميز
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2 text-right">
          {/* Title */}
          <h3 className="text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition">
            {course.title}
          </h3>

          {/* Instructor */}
          <p className="text-xs text-gray-600 truncate">{instructor}</p>

          {/* ✅ YOUR IMPROVEMENT: Single star + rating (cleaner than 5 stars) */}
          <div className="flex justify-end items-center gap-1 text-xs">
            <span className="font-semibold text-gray-900">
              {rating.toFixed(1)}
            </span>
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-gray-500">
              ({studentsCount.toLocaleString()})
            </span>
          </div>

          {/* ✅ YOUR IMPROVEMENT: Clean price display */}
          <div className="flex justify-end items-baseline gap-2">
            <span className="text-base font-bold text-gray-900">
              {price === 0 ? "مجاني" : `$${price.toFixed(2)}`}
            </span>
            {price > 0 && (
              <span className="text-xs text-gray-400 line-through">
                ${originalPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </Link>
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

  // Check enrollments on mount
  const fetchEnrollments = useCallback(async () => {
    if (!auth?.user || isAdminView || !data.courses) {
      setLoading(false);
      return;
    }

    try {
      const courseIds = data.courses.map((course) => course.id);
      const result = await checkUserEnrollments(auth.user.uid, courseIds);

      if (result.success) {
        setEnrollmentStatus(result.enrollments);
      }
    } catch (error) {
      console.error("Error fetching enrollments:", error);
    } finally {
      setLoading(false);
    }
  }, [auth?.user, data.courses, isAdminView]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  if (!data.success || data.error) {
    return <ErrorState message={data.error} />;
  }

  if (!data.courses || data.courses.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6" role="region" aria-label="قائمة الدورات">
      {/* Courses Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {data.courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            isAdminView={isAdminView}
            onDelete={onDeleteCourse}
          />
        ))}
      </div>

      {/* Pagination */}
      {data.hasMore && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-600">المزيد من الدورات متاحة...</p>
        </div>
      )}
    </div>
  );
}
