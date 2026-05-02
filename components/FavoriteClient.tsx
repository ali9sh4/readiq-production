"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Heart,
  BookOpen,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
  TrendingUp,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/authContext";
import { getUserFavorites } from "@/app/actions/favorites_actions";
import { Course } from "@/types/types"; // ✅ Import the actual Course type
import CoursesCardList from "@/components/CoursesCardList";

interface FavoritesClientProps {
  initialFavorites?: Course[];
  initialHasMore?: boolean;
  initialLastDocId?: string | null;
}

export default function FavoritesClient({
  initialFavorites = [],
  initialHasMore = false,
  initialLastDocId = null,
}: FavoritesClientProps) {
  const auth = useAuth();

  const [favorites, setFavorites] = useState<Course[]>(initialFavorites);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [lastDocId, setLastDocId] = useState<string | null>(initialLastDocId);
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "title" | "popular"
  >("newest");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [removingCourseId, setRemovingCourseId] = useState<string | null>(null);

  // Extract unique categories
  const categories = useMemo(() => {
    if (!favorites.length) return ["all"];

    const cats = new Set(favorites.map((c) => c.category).filter(Boolean));
    return ["all", ...Array.from(cats)];
  }, [favorites]);

  // Filter and sort favorites
  const filteredAndSortedFavorites = useMemo(() => {
    let result = [...favorites];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((course) =>
        course.title.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (filterCategory !== "all") {
      result = result.filter((course) => course.category === filterCategory);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        case "oldest":
          return (a.createdAt || "").localeCompare(b.createdAt || "");
        case "title":
          return a.title.localeCompare(b.title, "ar");
        case "popular":
          return (b.studentsCount || 0) - (a.studentsCount || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [favorites, searchQuery, sortBy, filterCategory]);

  // Handle removing a course from favorites
  const handleRemoveFavorite = useCallback((courseId: string) => {
    setRemovingCourseId(courseId);

    setTimeout(() => {
      setFavorites((prev) => prev.filter((c) => c.id !== courseId)); // ✅ Fixed filter
      setRemovingCourseId(null);
    }, 300);
  }, []);

  // Load more favorites
  const loadMore = async () => {
    if (isLoading || !hasMore || !lastDocId) return;

    setIsLoading(true);
    try {
      const token = await auth.user?.getIdToken();
      if (!token) {
        console.error("No authentication token available");
        return;
      }

      const result = await getUserFavorites(token, 20, lastDocId);

      if (result.success && result.favorites) {
        setFavorites((prev) => [...prev, ...result.favorites]); // ✅ Fixed - result.favorites is already Course[]
        setHasMore(result.hasMore);
        setLastDocId(result.lastDocId);
      }
    } catch (error) {
      console.error("Load more error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setFilterCategory("all");
    setSortBy("newest");
  };

  const hasActiveFilters =
    searchQuery || filterCategory !== "all" || sortBy !== "newest";
  const favoritesCount = favorites.length;

  // Empty State
  if (favoritesCount === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="bg-gradient-to-br from-pink-500 via-red-500 to-rose-600 rounded-3xl p-8 sm:p-12 text-white shadow-2xl mb-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 backdrop-blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center ring-4 ring-white/30">
                <Heart className="w-8 h-8 text-white fill-current" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold">المفضلة</h1>
                <p className="text-pink-100 mt-1">الدورات المحفوظة</p>
              </div>
            </div>
          </div>

          {/* Empty State */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-12 text-center transform hover:scale-[1.01] transition-transform">
            <div className="w-32 h-32 bg-gradient-to-br from-pink-100 to-red-100 rounded-full flex items-center justify-center mx-auto mb-6 relative">
              <Heart className="w-16 h-16 text-pink-500" />
              <div className="absolute inset-0 rounded-full bg-pink-500/20 animate-ping" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              لا توجد دورات مفضلة
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg">
              ابدأ بإضافة دورات إلى قائمة المفضلة لتتمكن من الوصول إليها بسهولة
              لاحقاً
            </p>
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all text-lg px-8 py-6"
            >
              <Link href="/courses">
                <BookOpen className="w-6 h-6 ml-2" />
                استكشف الدورات
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header with Stats */}
        <div className="bg-gradient-to-br from-pink-500 via-red-500 to-rose-600 rounded-3xl p-8 sm:p-12 text-white shadow-2xl mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-3xl" />
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center ring-4 ring-white/30">
                <Heart className="w-8 h-8 text-white fill-current" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold">المفضلة</h1>
                <p className="text-pink-100 mt-1">
                  {filteredAndSortedFavorites.length} من {favoritesCount} دورة
                </p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="flex gap-3 flex-wrap">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/30">
                <p className="text-xs text-pink-100 flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  إجمالي الدورات
                </p>
                <p className="text-2xl font-bold">{favoritesCount}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/30">
                <p className="text-xs text-pink-100 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  التصنيفات
                </p>
                <p className="text-2xl font-bold">{categories.length - 1}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="ابحث في المفضلة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 border-gray-200 focus:border-pink-500 focus:ring-pink-500"
              />
            </div>

            {/* Category Filter */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px] border-gray-200">
                <SlidersHorizontal className="w-4 h-4 ml-2" />
                <SelectValue placeholder="التصنيف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع التصنيفات</SelectItem>
                {categories.slice(1).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[180px] border-gray-200">
                <Clock className="w-4 h-4 ml-2" />
                <SelectValue placeholder="الترتيب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">الأحدث أولاً</SelectItem>
                <SelectItem value="oldest">الأقدم أولاً</SelectItem>
                <SelectItem value="title">حسب الاسم</SelectItem>
                <SelectItem value="popular">الأكثر شعبية</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-pink-600 hover:text-pink-700 hover:bg-pink-50"
              >
                <X className="w-4 h-4 ml-1" />
                مسح الفلاتر
              </Button>
            )}
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500">الفلاتر النشطة:</span>
              {searchQuery && (
                <Badge
                  variant="secondary"
                  className="bg-pink-100 text-pink-700"
                >
                  البحث: {searchQuery}
                </Badge>
              )}
              {filterCategory !== "all" && (
                <Badge
                  variant="secondary"
                  className="bg-purple-100 text-purple-700"
                >
                  {filterCategory}
                </Badge>
              )}
              {sortBy !== "newest" && (
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-700"
                >
                  {sortBy === "oldest"
                    ? "الأقدم"
                    : sortBy === "title"
                    ? "الاسم"
                    : "الشعبية"}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Results Count */}
        {filteredAndSortedFavorites.length !== favoritesCount && (
          <div className="mb-4 text-center">
            <p className="text-gray-600">
              عرض {filteredAndSortedFavorites.length} من {favoritesCount} دورة
            </p>
          </div>
        )}

        {/* Courses Grid */}
        {filteredAndSortedFavorites.length > 0 ? (
          <>
            <CoursesCardList
              data={{
                success: true,
                courses: filteredAndSortedFavorites, // ✅ Pass filtered courses
                hasMore: false,
                nextCursor: null,
              }}
            />
          </>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              لا توجد نتائج
            </h3>
            <p className="text-gray-500 mb-4">
              جرب تغيير معايير البحث أو الفلتر
            </p>
            <Button
              onClick={clearFilters}
              variant="outline"
              className="border-pink-500 text-pink-500 hover:bg-pink-50"
            >
              مسح الفلاتر
            </Button>
          </div>
        )}

        {/* Load More */}
        {hasMore && !searchQuery && filterCategory === "all" && (
          <div className="text-center mt-8">
            <Button
              onClick={loadMore}
              disabled={isLoading}
              size="lg"
              className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all min-w-[200px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                  جاري التحميل...
                </>
              ) : (
                <>
                  <Heart className="w-5 h-5 ml-2 fill-current" />
                  عرض المزيد
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
