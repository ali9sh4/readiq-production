"use client";

import { memo, useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Edit, Trash2, BookOpen, AlertCircle, Users } from "lucide-react";
import { Course, CourseResponse } from "@/types/types";
import { checkUserEnrollments } from "@/app/actions/enrollment_action";
import { useAuth } from "@/context/authContext";
import FavoriteButton from "./favoritesButton";
import { checkUserFavorites } from "@/app/actions/favorites_actions";
import { softDeleteCourse } from "@/app/actions/course_deletion_action";

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
  <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center min-h-[400px]">
    <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8 max-w-md w-full">
      <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
        <BookOpen className="w-8 h-8 md:w-10 md:h-10 text-white" aria-hidden="true" />
      </div>
      <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-2">لا توجد دورات</h3>
      <p className="text-sm md:text-base text-gray-600">لا توجد دورات متاحة في الوقت الحالي</p>
    </div>
  </div>
));
EmptyState.displayName = "EmptyState";

const ErrorState = memo(({ message }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center min-h-[400px]">
    <div className="bg-gradient-to-br from-red-50 to-rose-100 rounded-2xl shadow-lg border border-red-200 p-6 md:p-8 max-w-md w-full">
      <div className="w-16 h-16 md:w-20 md:h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-8 h-8 md:w-10 md:h-10 text-white" aria-hidden="true" />
      </div>
      <h3 className="text-lg md:text-xl font-bold text-red-800 mb-2">خطأ في التحميل</h3>
      <p className="text-sm md:text-base text-red-600">{message || "حدث خطأ غير متوقع"}</p>
    </div>
  </div>
));
ErrorState.displayName = "ErrorState";

const CourseCard = memo(
  ({
    course,
    isAdminView,
    onDelete,
    isEnrolled = false,
    isFavorited = false,
  }: {
    course: Course;
    isAdminView: boolean;
    onDelete?: (id: string) => void;
    isEnrolled?: boolean;
    isFavorited?: boolean;
  }) => {
    const auth = useAuth();
    const [imageError, setImageError] = useState(false);
    const imageUrl = useMemo(
      () => getImageUrl(course.thumbnailUrl),
      [course.thumbnailUrl]
    );

    const rating = course.rating || 4.7;
    const studentsCount = course.studentsCount || 0;
    const instructor = course.instructorName || "مدرب غير معروف";
    const originalPrice = course.price ?? 99.99;
    const salePrice = course.salePrice || null;
    const currentPrice = salePrice || originalPrice;

    const showBestseller = studentsCount > 20;
    const showPremium = originalPrice > 0;
    const showFree = originalPrice === 0;

    // Admin View
    if (isAdminView) {
      return (
        <div className="group block rounded-xl lg:rounded-2xl overflow-hidden bg-white 
          border-[4px] border-gray-400 md:border-[5px] md:border-gray-500
          lg:border-2 lg:border-gray-200 lg:shadow-lg
          hover:border-blue-600 lg:hover:border-blue-500
          transition-all duration-300 hover:-translate-y-1 
          hover:bg-blue-50 lg:hover:bg-white
          [filter:drop-shadow(0_4px_6px_rgba(0,0,0,0.2))] md:[filter:drop-shadow(0_6px_8px_rgba(0,0,0,0.25))]
          lg:[filter:none]
          transform-gpu will-change-transform">
          {/* Image with Preview Overlay */}
          <Link href={`/Course/${course.id}`} className="relative block">
            <div className="relative h-40 sm:h-48 md:h-52 lg:h-44 bg-gray-100 overflow-hidden rounded-t-[8px] md:rounded-t-[7px] lg:rounded-t-[13px] group/image">
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
                  <BookOpen className="w-12 h-12 md:w-14 md:h-14 lg:w-10 lg:h-10 text-gray-400" />
                </div>
              )}

              {/* Preview Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/40 transition-all duration-300 flex items-center justify-center">
                <div className="opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 flex flex-col items-center gap-2">
                  <BookOpen className="w-10 h-10 md:w-12 md:h-12 lg:w-8 lg:h-8 text-white" />
                  <span className="text-white text-sm md:text-base lg:text-sm font-semibold">
                    معاينة الدورة
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Content */}
          <div className="p-3 md:p-4 lg:p-4 space-y-1.5 md:space-y-2.5 lg:space-y-2 text-right">
            <h3 className="text-sm md:text-base lg:text-sm font-bold text-gray-900 line-clamp-2 leading-snug">
              {course.title}
            </h3>
            <p className="text-xs md:text-sm lg:text-xs text-gray-600 truncate">{instructor}</p>
            
            {course.enrollmentCount !== undefined &&
              course.enrollmentCount > 0 && (
                <div className="flex items-center gap-1 md:gap-1.5 lg:gap-1 text-xs md:text-sm lg:text-xs text-gray-600">
                  <Users className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4 lg:h-4" />
                  <span>{course.enrollmentCount} طالب مسجل</span>
                </div>
              )}

            {/* Admin Actions */}
            <div className="flex gap-1.5 md:gap-2 lg:gap-2 pt-2 md:pt-3 lg:pt-2 border-t border-gray-100">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50 text-xs md:text-sm lg:text-xs h-8 md:h-9 lg:h-8"
                onClick={() => {
                  console.log("🔍 Navigating to edit page");
                  console.log("🔍 Course ID:", course.id);
                  console.log(
                    "🔍 Full URL:",
                    `/course-upload/edit/${course.id}`
                  );
                }}
                asChild
              >
                <Link href={`/course-upload/edit/${course.id}`}>
                  <Edit className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-3 lg:h-3 ml-1 md:ml-1.5 lg:ml-1" />
                  تعديل
                </Link>
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="text-xs md:text-sm lg:text-xs h-8 md:h-9 lg:h-8"
                onClick={async (e) => {
                  e.stopPropagation();

                  if (!confirm("هل تريد طلب حذف هذه الدورة؟")) {
                    return;
                  }

                  try {
                    if (!auth?.user) {
                      alert("يرجى تسجيل الدخول");
                      return;
                    }

                    const token = await auth.user.getIdToken();
                    const result = await softDeleteCourse(course.id, token);

                    if (result.success) {
                      alert(result.message);
                    } else {
                      alert(result.error || "حدث خطأ");
                    }
                  } catch (error) {
                    console.error("Error requesting deletion:", error);
                    alert("حدث خطأ أثناء طلب الحذف");
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-3 lg:h-3 ml-1 md:ml-1.5 lg:ml-1" />
                حذف الدوره
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // User View
    return (
      <Link
        href={`/Course/${course.id}`}
        className="group block rounded-xl lg:rounded-2xl overflow-hidden bg-white 
          border-[4px] border-gray-400 md:border-[5px] md:border-gray-500
          lg:border-2 lg:border-gray-200 lg:shadow-lg
          hover:border-blue-600 lg:hover:border-blue-500
          transition-all duration-300 hover:-translate-y-1 
          hover:bg-blue-50 lg:hover:bg-white
          [filter:drop-shadow(0_4px_6px_rgba(0,0,0,0.2))] md:[filter:drop-shadow(0_6px_8px_rgba(0,0,0,0.25))]
          lg:[filter:none]
          transform-gpu will-change-transform"
      >
        {/* Image with Badges */}
        <div className="relative h-40 sm:h-48 md:h-52 lg:h-44 bg-gray-100 overflow-hidden rounded-t-[8px] md:rounded-t-[7px] lg:rounded-t-[13px]">
          {!imageError ? (
            <Image
              src={imageUrl}
              alt={course.title}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-500"
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <BookOpen className="w-12 h-12 md:w-14 md:h-14 lg:w-10 lg:h-10 text-gray-400" />
            </div>
          )}
          
          {/* Favorite Button */}
          {!isAdminView && (
            <div className="absolute top-2 md:top-2.5 lg:top-2 right-2 md:right-2.5 lg:right-2 z-10">
              <FavoriteButton
                courseId={course.id}
                courseTitle={course.title}
                courseThumbnail={course.thumbnailUrl}
                variant="ghost"
                initialIsFavorited={isFavorited}
              />
            </div>
          )}

          {/* Badges */}
          <div className="absolute bottom-2 md:bottom-2.5 lg:bottom-2 left-2 md:left-2.5 lg:left-2 flex flex-wrap gap-1 md:gap-1.5 lg:gap-1.5">
            {showFree && (
              <Badge className="bg-green-500 text-white font-semibold text-xs md:text-sm lg:text-xs px-2 md:px-2.5 lg:px-2 py-0.5 md:py-1 lg:py-0.5 rounded-md shadow-sm">
                مجاني
              </Badge>
            )}
            {showBestseller && (
              <Badge className="bg-yellow-400 text-black font-semibold text-xs md:text-sm lg:text-xs px-2 md:px-2.5 lg:px-2 py-0.5 md:py-1 lg:py-0.5 rounded-md shadow-sm">
                الأكثر مبيعاً
              </Badge>
            )}
            {showPremium && (
              <Badge className="bg-purple-600 text-white text-xs md:text-sm lg:text-xs px-2 md:px-2.5 lg:px-2 py-0.5 md:py-1 lg:py-0.5 rounded-md shadow-sm">
                مميز
              </Badge>
            )}
            {isEnrolled && (
              <Badge className="bg-blue-600 text-white text-xs md:text-sm lg:text-xs px-2 md:px-2.5 lg:px-2 py-0.5 md:py-1 lg:py-0.5 rounded-md shadow-sm">
                مسجل
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 md:p-4 lg:p-4 space-y-1.5 md:space-y-2.5 lg:space-y-2 text-right">
          {/* Title */}
          <h3 className="text-sm md:text-base lg:text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition leading-snug">
            {course.title}
          </h3>

          {/* Instructor */}
          <p className="text-xs md:text-sm lg:text-xs text-gray-600 truncate">{instructor}</p>
          
          {/* Enrollment Count */}
          {course.enrollmentCount !== undefined &&
            course.enrollmentCount > 0 && (
              <div className="flex items-center gap-1 md:gap-1.5 lg:gap-1 text-xs md:text-sm lg:text-xs text-gray-600">
                <Users className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4 lg:h-4" />
                <span>{course.enrollmentCount} طالب مسجل</span>
              </div>
            )}

          {/* Rating */}
          <div className="flex justify-end items-center gap-1 md:gap-1.5 lg:gap-1 text-xs md:text-sm lg:text-xs">
            <span className="font-semibold text-gray-900">
              {rating.toFixed(1)}
            </span>
            <Star className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-3.5 lg:h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-gray-500">
              ({studentsCount.toLocaleString()})
            </span>
          </div>

          {/* Price */}
          <div className="flex justify-end items-baseline gap-1.5 md:gap-2 lg:gap-2">
            <span className="text-base md:text-lg lg:text-base font-bold text-gray-900">
              {currentPrice === 0
                ? "مجاني"
                : `${currentPrice.toLocaleString()} د.ع`}
            </span>

            {salePrice && salePrice < originalPrice && (
              <span className="text-sm md:text-base lg:text-xs text-gray-400 line-through">
                {originalPrice.toLocaleString()} د.ع
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
  const [favoriteStatus, setFavoriteStatus] = useState<Record<string, boolean>>(
    {}
  );

  const [loading, setLoading] = useState(true);

  const fetchEnrollments = useCallback(async () => {
    if (!auth?.user || isAdminView || !data.courses) {
      setLoading(false);
      return;
    }

    try {
      const courseIds = data.courses.map((course) => course.id);
      const token = await auth.user.getIdToken();
      const [enrollmentResult, favoriteResult] = await Promise.all([
        checkUserEnrollments(auth.user.uid, courseIds),
        checkUserFavorites(token, courseIds),
      ]);
      if (enrollmentResult.success) {
        setEnrollmentStatus(enrollmentResult.enrollments);
      }

      if (favoriteResult.success) {
        setFavoriteStatus(favoriteResult.favorites);
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
    <div className="space-y-6 md:space-y-8 p-4 md:p-6 lg:p-0 bg-gray-100 lg:bg-transparent rounded-2xl lg:rounded-none" role="region" aria-label="قائمة الدورات">
      {/* Courses Grid - Optimized for all screen sizes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4 lg:gap-4">
        {data.courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            isAdminView={isAdminView}
            onDelete={onDeleteCourse}
            isEnrolled={enrollmentStatus[course.id]}
            isFavorited={favoriteStatus[course.id]}
          />
        ))}
      </div>

      {/* Pagination */}
      {data.hasMore && (
        <div className="text-center py-4 md:py-6">
          <p className="text-sm md:text-base text-gray-600">المزيد من الدورات متاحة...</p>
        </div>
      )}

      {/* Safari Shadow Fix */}
      <style jsx global>{`
        /* Force Safari to render shadows properly */
        @supports (-webkit-touch-callout: none) {
          .group {
            -webkit-transform: translateZ(0);
            -webkit-backface-visibility: hidden;
            -webkit-perspective: 1000px;
          }
        }
      `}</style>
    </div>
  );
}