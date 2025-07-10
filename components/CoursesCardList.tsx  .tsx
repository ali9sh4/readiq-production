import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { CourseResponse } from "@/types/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Star,
  Clock,
  Users,
  Heart,
  ShoppingCart,
  Play,
  Award,
  Edit,
  Trash2,
  Eye,
  BookOpen,
  TrendingUp,
} from "lucide-react";

// Utility functions
const formatPrice = (price: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
};

const formatStudentsCount = (count: number): string => {
  if (!count) return "0";
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

const formatDuration = (duration: number): string => {
  const hours = Math.floor(duration);
  const minutes = Math.round((duration - hours) * 60);
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
};

// Enhanced level colors with gradients
const levelColors = {
  beginner:
    "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border-emerald-200 shadow-sm",
  intermediate:
    "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border-amber-200 shadow-sm",
  advanced:
    "bg-gradient-to-r from-rose-100 to-red-100 text-rose-800 border-rose-200 shadow-sm",
  all_levels:
    "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border-blue-200 shadow-sm",
};

// Level labels in Arabic
const levelLabelsAr = {
  beginner: "مبتدئ",
  intermediate: "متوسط",
  advanced: "متقدم",
  all_levels: "جميع المستويات",
};

// Enhanced Star Rating Component
const StarRating = ({ rating = 4.0 }: { rating?: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-1">
      {Array(fullStars)
        .fill(0)
        .map((_, i) => (
          <Star
            key={`full-${i}`}
            className="w-4 h-4 fill-amber-400 text-amber-400 drop-shadow-sm"
          />
        ))}
      {hasHalfStar && (
        <Star className="w-4 h-4 fill-amber-400 text-amber-400 opacity-60 drop-shadow-sm" />
      )}
      {Array(emptyStars)
        .fill(0)
        .map((_, i) => (
          <Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />
        ))}
      <span className="text-sm font-semibold text-gray-700 mr-1 bg-white/80 px-1.5 py-0.5 rounded-full">
        {rating.toFixed(1)}
      </span>
    </div>
  );
};

interface CoursesCardListProps {
  data: CourseResponse;
  isAdminView?: boolean;
}

export default function CoursesCardList({
  data,
  isAdminView = false,
}: CoursesCardListProps) {
  // Error handling with enhanced design
  if (!data.success || data.error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="bg-gradient-to-br from-red-50 to-rose-100 rounded-2xl shadow-lg border border-red-200 p-8 max-w-md">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-800 mb-2">
            خطأ في التحميل
          </h3>
          <p className="text-red-600">{data.error || "حدث خطأ غير متوقع"}</p>
        </div>
      </div>
    );
  }

  // Empty state with enhanced design
  if (!data.courses || data.courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md">
          <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            لا توجد دورات
          </h3>
          <p className="text-gray-600">لا توجد دورات متاحة في الوقت الحالي</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Enhanced header with gradient background */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border border-blue-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              {isAdminView ? (
                <Edit className="w-5 h-5 text-white" />
              ) : (
                <TrendingUp className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isAdminView ? "إدارة الدورات" : "الدورات التدريبية"}
              </h2>
              <p className="text-gray-600 text-sm">
                {isAdminView
                  ? `إجمالي الدورات: ${data.courses.length} دورة`
                  : `اكتشف أفضل الدورات التدريبية (${data.courses.length} دورة)`}
              </p>
            </div>
          </div>
          {!isAdminView && (
            <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-lg">
              جديد
            </Badge>
          )}
        </div>
      </div>

      {/* Enhanced grid with better responsive design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {data.courses.map((course) => {
          // ✅ Use static fallback values
          const rating = course.rating || 4.2;
          const studentsCount = course.studentsCount || 1250;
          const instructor =
            course.instructor || course.createdBy || "مدرب محترف";

          return (
            <Card
              key={course.id}
              className="group cursor-pointer transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-3 border-0 shadow-xl overflow-hidden bg-white rounded-2xl backdrop-blur-sm"
            >
              {/* Enhanced Course Image with better overlay */}
              <div className="relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-2xl">
                <img
                  src={
                    course.image ||
                    `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&h=280&fit=crop&auto=format`
                  }
                  alt={course.title}
                  className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-700"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

                {/* Enhanced play overlay */}
                {!isAdminView && (
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-[2px]">
                    <div className="bg-white/95 backdrop-blur-md rounded-full p-4 transform scale-75 group-hover:scale-100 transition-all duration-500 shadow-2xl border border-white/50">
                      <Play className="w-6 h-6 text-gray-800 fill-current" />
                    </div>
                  </div>
                )}

                {/* Enhanced badges */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                  <Badge
                    className={`${
                      levelColors[course.level]
                    } border-0 font-semibold text-xs px-3 py-1.5 rounded-full backdrop-blur-sm`}
                  >
                    {levelLabelsAr[course.level]}
                  </Badge>

                  {/* Enhanced admin controls */}
                  {isAdminView ? (
                    <div className="flex gap-2">
                      <Link href={`/courses/${course.id}`}>
                        <button className="p-2 bg-white/95 backdrop-blur-md rounded-full hover:bg-white transition-all duration-300 shadow-lg hover:shadow-xl border border-white/50">
                          <Eye className="w-4 h-4 text-gray-600 hover:text-blue-500 transition-colors" />
                        </button>
                      </Link>
                      <Link href={`/dashboard/courses/edit/${course.id}`}>
                        <button className="p-2 bg-white/95 backdrop-blur-md rounded-full hover:bg-white transition-all duration-300 shadow-lg hover:shadow-xl border border-white/50">
                          <Edit className="w-4 h-4 text-gray-600 hover:text-blue-500 transition-colors" />
                        </button>
                      </Link>
                      <button className="p-2 bg-white/95 backdrop-blur-md rounded-full hover:bg-white transition-all duration-300 shadow-lg hover:shadow-xl border border-white/50">
                        <Trash2 className="w-4 h-4 text-gray-600 hover:text-red-500 transition-colors" />
                      </button>
                    </div>
                  ) : (
                    <button className="p-2 bg-white/95 backdrop-blur-md rounded-full hover:bg-white transition-all duration-300 shadow-lg hover:shadow-xl border border-white/50">
                      <Heart className="w-4 h-4 text-gray-600 hover:text-red-500 transition-colors" />
                    </button>
                  )}
                </div>

                {/* New: Price badge on image */}
                <div className="absolute bottom-4 right-4">
                  <div className="bg-white/95 backdrop-blur-md rounded-full px-3 py-1.5 shadow-lg border border-white/50">
                    <span className="text-sm font-bold text-gray-900">
                      {formatPrice(course.price)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Enhanced Card Content */}
              <CardHeader className="pb-3 pt-6">
                <CardTitle className="text-lg font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors text-right mb-2">
                  {course.title}
                </CardTitle>
                <CardDescription className="text-sm text-gray-600 text-right line-clamp-2 leading-relaxed">
                  {course.subtitle || `تخصص: ${course.category}`}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0 text-right space-y-4">
                {/* Enhanced Instructor */}
                <div className="flex items-center gap-2 mb-3 flex-row-reverse bg-gray-50 rounded-lg p-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <Award className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm text-gray-700 font-medium truncate">
                    {instructor}
                  </span>
                </div>

                {/* Enhanced Rating and Students */}
                <div className="flex items-center gap-4 mb-3 flex-row-reverse justify-between">
                  <StarRating rating={rating} />
                  <div className="flex items-center text-sm text-gray-600 gap-1 bg-blue-50 rounded-full px-3 py-1">
                    <Users className="w-4 h-4" />
                    <span className="font-medium">
                      ({formatStudentsCount(studentsCount)})
                    </span>
                  </div>
                </div>

                {/* Enhanced Duration and Language */}
                <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">
                      {formatDuration(course.duration)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">
                      {course.language === "arabic"
                        ? "العربية"
                        : course.language}
                    </span>
                  </div>
                </div>

                {/* Enhanced Actions */}
                <div className="flex gap-2 pt-4 border-t border-gray-100">
                  {isAdminView ? (
                    <>
                      <Link
                        href={`/course-upload/edit/${course.id}`}
                        className="flex-1"
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 font-medium text-xs py-2 rounded-xl transition-all duration-300 hover:shadow-lg"
                        >
                          <Edit className="w-3 h-3 ml-1" />
                          تعديل
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="font-medium text-xs py-2 px-4 rounded-xl transition-all duration-300 hover:shadow-lg"
                      >
                        <Trash2 className="w-3 h-3 ml-1" />
                        حذف
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50 font-medium text-xs py-2 rounded-xl transition-all duration-300 hover:shadow-lg"
                      >
                        <ShoppingCart className="w-3 h-3 ml-1" />
                        إضافة
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-xs py-2 rounded-xl transition-all duration-300 hover:shadow-lg shadow-blue-500/25"
                      >
                        تسجيل
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
