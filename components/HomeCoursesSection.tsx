"use client";

import { useEffect, useState } from "react";
import { Course } from "@/types/types";

import { Search } from "lucide-react";
import CourseSearch from "./courseSearch";
import CoursesCardList from "./CoursesCardList.tsx  ";

interface HomeCoursesSection {
  initialCourses: Course[];
}

export default function HomeCoursesSection({
  initialCourses,
}: HomeCoursesSection) {
  const [filteredCourses, setFilteredCourses] = useState(initialCourses);

  return (
    <div className="w-full">
      {/* Search Component */}
      <div className="mb-6 md:mb-8">
        <CourseSearch
          courses={initialCourses}
          onFilteredResults={setFilteredCourses}
        />
      </div>

      {/* Results */}
      {filteredCourses.length === 0 ? (
        <div className="text-center py-12 md:py-16 lg:py-20 px-4">
          <div className="max-w-md mx-auto">
            {/* Icon Circle */}
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-full w-20 h-20 md:w-28 md:h-28 lg:w-24 lg:h-24 flex items-center justify-center mx-auto mb-4 md:mb-6 lg:mb-4 shadow-sm">
              <Search className="w-10 h-10 md:w-14 md:h-14 lg:w-12 lg:h-12 text-gray-400" />
            </div>

            {/* Heading */}
            <h3 className="text-xl md:text-2xl lg:text-xl font-bold text-gray-800 mb-2 md:mb-3 lg:mb-2">
              لا توجد نتائج
            </h3>

            {/* Description */}
            <p className="text-sm md:text-lg lg:text-base text-gray-600 leading-relaxed">
              جرب البحث بكلمات مختلفة أو قم بإزالة بعض الفلاتر
            </p>

            {/* Additional help text - visible on larger screens */}
            <div className="mt-6 md:mt-8 lg:mt-6 pt-6 md:pt-8 lg:pt-6 border-t border-gray-200">
              <p className="text-xs md:text-sm text-gray-500">
                💡 يمكنك أيضاً تصفح جميع الدورات المتاحة
              </p>
            </div>
          </div>
        </div>
      ) : (
        <CoursesCardList
          data={{
            success: true,
            courses: filteredCourses,
            hasMore: false,
            nextCursor: null,
          }}
        />
      )}
    </div>
  );
}
