"use client";

import { useState } from "react";
import { Course } from "@/types/types";

import CoursesCardList from "./CoursesCardList.tsx  ";
import { Search } from "lucide-react";
import CourseSearch from "./courseSearch";

interface HomeCoursesSection {
  initialCourses: Course[];
}

export default function HomeCoursesSection({
  initialCourses,
}: HomeCoursesSection) {
  const [filteredCourses, setFilteredCourses] = useState(initialCourses);

  return (
    <div>
      {/* Search Component */}
      <CourseSearch
        courses={initialCourses}
        onFilteredResults={setFilteredCourses}
      />

      {/* Results */}
      {filteredCourses.length === 0 ? (
        <div className="text-center py-16">
          <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4">
            <Search className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            لا توجد نتائج
          </h3>
          <p className="text-gray-500">
            جرب البحث بكلمات مختلفة أو قم بإزالة بعض الفلاتر
          </p>
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
