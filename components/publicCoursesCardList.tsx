import { getCourses } from "@/data/courses";
import { CourseResponse } from "@/types/types";
import CoursesCardList from "./CoursesCardList.tsx  ";
import LoadMoreButton from "./loadMoreButoon";

type CourseLevel = "beginner" | "intermediate" | "advanced" | "all_levels";

export default async function PublicCoursesCardList({
  searchParams = {},
}: {
  searchParams?: {
    cursor?: string;
    category?: string;
    level?: string;
  };
}) {
  const data: CourseResponse = await getCourses({
    pagination: {
      lastDocId: searchParams.cursor || undefined,
      pageSize: 8, // ✅ Proper pagination size for public
    },
    filters: {
      category: searchParams.category || undefined,
      level: (searchParams.level as CourseLevel) || undefined,
    },
  });

  // ✅ Handle errors
  if (!data.success || data.error) {
    return (
      <div className="flex items-center justify-center p-8 text-xl font-medium text-red-600 bg-red-50 rounded-lg shadow-sm border border-red-200">
        خطأ في تحميل الدورات: {data.error || "حدث خطأ غير متوقع"}
      </div>
    );
  }

  return (
    <>
      <CoursesCardList data={data} />

      {/* ✅ Only show LoadMoreButton if there are more courses */}
      {data.hasMore && (
        <div className="mt-8">
          <LoadMoreButton
            nextCursor={data.nextCursor || ""}
            hasMore={data.hasMore}
            currentParams={searchParams} // ✅ Pass current params
          />
        </div>
      )}
    </>
  );
}
