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

// Level colors mapping
const levelColors = {
  beginner: "bg-green-100 text-green-800 border-green-200",
  intermediate: "bg-yellow-100 text-yellow-800 border-yellow-200",
  advanced: "bg-red-100 text-red-800 border-red-200",
  all_levels: "bg-blue-100 text-blue-800 border-blue-200",
};

// Level labels in Arabic
const levelLabelsAr = {
  beginner: "مبتدئ",
  intermediate: "متوسط",
  advanced: "متقدم",
  all_levels: "جميع المستويات",
};

// Star Rating Component
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
            className="w-4 h-4 fill-yellow-400 text-yellow-400"
          />
        ))}
      {hasHalfStar && (
        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 opacity-50" />
      )}
      {Array(emptyStars)
        .fill(0)
        .map((_, i) => (
          <Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />
        ))}
      <span className="text-sm font-medium text-gray-700 mr-1">
        {rating.toFixed(1)}
      </span>
    </div>
  );
};

// ✅ Fixed interface name
interface CoursesCardListProps {
  data: CourseResponse;
  isAdminView?: boolean; // Optional prop to show admin controls
}

// ✅ Removed async keyword and fixed component
export default function CoursesCardList({
  data,
  isAdminView = false,
}: CoursesCardListProps) {
  // ✅ Single error handling block
  if (!data.success || data.error) {
    return (
      <div className="flex items-center justify-center p-8 text-xl font-medium text-red-600 bg-red-50 rounded-lg shadow-sm border border-red-200">
        خطأ في تحميل الدورات: {data.error || "حدث خطأ غير متوقع"}
      </div>
    );
  }

  // ✅ Single empty state check
  if (!data.courses || data.courses.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-xl font-medium text-gray-600 bg-gray-100 rounded-lg shadow-sm border border-gray-200">
        لا توجد دورات متاحة
      </div>
    );
  }

  return (
    <>
      {/* Enhanced header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ادارة الدورات
        </h1>
        <p className="text-gray-600">
          {isAdminView
            ? `إجمالي الدورات: ${data.courses.length} دورة`
            : `اكتشف أفضل الدورات التدريبية (${data.courses.length} دورة)`}
        </p>
      </div>

      {/* Enhanced grid */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {data.courses.map((course) => {
          // Use real data if available, otherwise mock data
          const rating = course.rating || 4.0 + Math.random() * 0.9;
          const studentsCount =
            course.studentsCount || Math.floor(Math.random() * 5000) + 100;
          const instructor =
            course.instructor || course.createdBy || "مدرب محترف";

          return (
            <Card
              key={course.id}
              className="group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border-0 shadow-lg overflow-hidden bg-white"
            >
              {/* Course Image */}
              <div className="relative overflow-hidden bg-gray-200">
                <img
                  src={
                    course.image ||
                    `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&h=280&fit=crop&auto=format`
                  }
                  alt={course.title}
                  className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-500"
                />

                {/* Play overlay - only for non-admin view */}
                {!isAdminView && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur-sm rounded-full p-3 transform scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="w-5 h-5 text-gray-800 fill-current" />
                    </div>
                  </div>
                )}

                {/* Badges */}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                  <Badge
                    className={`${
                      levelColors[course.level]
                    } border font-medium text-xs`}
                  >
                    {levelLabelsAr[course.level]}
                  </Badge>

                  {/* Admin controls or heart button */}
                  {isAdminView ? (
                    <div className="flex gap-1">
                      <button className="p-1.5 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors">
                        <Edit className="w-4 h-4 text-gray-600 hover:text-blue-500 transition-colors" />
                      </button>
                      <button className="p-1.5 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors">
                        <Trash2 className="w-4 h-4 text-gray-600 hover:text-red-500 transition-colors" />
                      </button>
                    </div>
                  ) : (
                    <button className="p-1.5 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors">
                      <Heart className="w-4 h-4 text-gray-600 hover:text-red-500 transition-colors" />
                    </button>
                  )}
                </div>
              </div>

              {/* Enhanced Card Content */}
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors text-right">
                  {course.title}
                </CardTitle>
                <CardDescription className="mt-1 text-sm text-gray-600 text-right line-clamp-1">
                  {course.subtitle || `تخصص: ${course.category}`}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0 text-right">
                {/* Instructor */}
                <div className="flex items-center gap-1 mb-3 flex-row-reverse">
                  <Award className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600 truncate">
                    {instructor}
                  </span>
                </div>

                {/* Rating and Students */}
                <div className="flex items-center gap-3 mb-3 flex-row-reverse justify-end">
                  <StarRating rating={rating} />
                  <div className="flex items-center text-sm text-gray-500 gap-1">
                    <Users className="w-4 h-4" />
                    <span>({formatStudentsCount(studentsCount)})</span>
                  </div>
                </div>

                {/* Duration and Language */}
                <div className="flex items-center gap-4 mb-4 text-sm text-gray-500 flex-row-reverse">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration(course.duration)}</span>
                  </div>
                  <div className="text-sm">
                    اللغة:{" "}
                    <span className="font-medium">
                      {course.language === "arabic"
                        ? "العربية"
                        : course.language}
                    </span>
                  </div>
                </div>

                {/* Level and Price */}
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-gray-700 text-right">
                    المستوى:{" "}
                    <span className="font-medium">
                      {levelLabelsAr[course.level]}
                    </span>
                  </p>
                </div>

                {/* Enhanced Price and Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 flex-row-reverse">
                  <div className="text-right">
                    <span className="text-xl font-bold text-gray-900">
                      {formatPrice(course.price)}
                    </span>
                    {course.price > 50 && (
                      <div className="text-sm text-gray-500 line-through">
                        {formatPrice(course.price * 1.4)}
                      </div>
                    )}
                  </div>

                  {/* Different actions for admin vs public view */}
                  <div className="flex gap-2 order-first">
                    {isAdminView ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs px-3"
                        >
                          <Edit className="w-3 h-3 ml-1" />
                          تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs px-3"
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
                          className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs px-3"
                        >
                          <ShoppingCart className="w-3 h-3 ml-1" />
                          إضافة
                        </Button>
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3"
                        >
                          تسجيل
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination info for admin view */}
      {isAdminView && data.hasMore && (
        <div className="text-center mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-600">
            يوجد المزيد من الدورات. استخدم أدوات التصفية أو البحث لعرض دورات
            أخرى.
          </p>
        </div>
      )}
    </>
  );
}