"use client";

import { useState, useMemo, useEffect } from "react";
import { Course } from "@/types/types";
import { Search, X } from "lucide-react";
const CATEGORY_LABELS: Record<string, string> = {
  programming: "البرمجة",
  design: "التصميم",
  business: "الأعمال",
  marketing: "التسويق",
  photography: "التصوير",
  music: "الموسيقى",
  health_fitness: "الصحة واللياقة",
  medicine: "الطب والصحة",
  teaching: "التعليم والتدريس",
  languages: "اللغات",
  personal_development: "التنمية الذاتية",
  science: "العلوم",
  technology: "التقنية",
};
const getCategoryLabel = (value: string) => CATEGORY_LABELS[value] || value;

interface CourseSearchProps {
  courses: Course[];
  onFilteredResults: (filtered: Course[]) => void;
}

export default function CourseSearch({
  courses,
  onFilteredResults,
}: CourseSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // ✅ Extract unique categories from courses
  const categories = useMemo(() => {
    const cats = new Set(courses.map((c) => c.category).filter(Boolean));
    return Array.from(cats);
  }, [courses]);

  // ✅ Client-side filtering (INSTANT!)
  const filteredCourses = useMemo(() => {
    let filtered = courses;

    // Category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter((c) => c.category === selectedCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((course) => {
        return (
          course.title?.toLowerCase().includes(query) ||
          course.description?.toLowerCase().includes(query) ||
          course.subtitle?.toLowerCase().includes(query) ||
          course.instructorName?.toLowerCase().includes(query) ||
          course.category?.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [courses, searchQuery, selectedCategory]);

  // ✅ Update parent with filtered results
  useEffect(() => {
    onFilteredResults(filteredCourses);
  }, [filteredCourses]);

  return (
    <div className="space-y-4 mb-8">
      {/* Search Bar */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن دورة... (العنوان، الوصف، المدرب)"
            className="w-full pr-12 pl-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex justify-between gap-2 mt-2">
        <div className="flex gap-2 mt-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 whitespace-nowrap rounded-lg border transition flex-shrink-0 ${
              selectedCategory === "all"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            جميع التصنيفات
          </button>

          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 whitespace-nowrap rounded-lg border transition flex-shrink-0 ${
                cat === selectedCategory
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
              }`}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {filteredCourses.length === courses.length ? (
            <>عرض جميع الدورات ({courses.length})</>
          ) : (
            <>
              عرض {filteredCourses.length} من {courses.length} دورة
            </>
          )}
        </span>
      </div>
    </div>
  );
}
