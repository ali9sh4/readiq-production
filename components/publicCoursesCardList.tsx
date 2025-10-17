import { getCourses } from "@/data/courses";
import { CourseResponse } from "@/types/types";
import NextBackButton from "./loadMoreButoon";
import CoursesCardList from "./CoursesCardList.tsx  ";

type CourseLevel = "beginner" | "intermediate" | "advanced" | "all_levels";

export default async function PublicCoursesCardList({
  searchParams,
}: {
  searchParams?: Promise<{
    cursor?: string;
    category?: string;
    level?: string;
  }>;
}) {
  // ✅ Await searchParams before accessing properties
  const params = await searchParams;

  const data: CourseResponse = await getCourses({
    pagination: {
      lastDocId: params?.cursor || undefined,
      pageSize: 8, // ✅ Proper pagination size for public
    },
    filters: {
      category: params?.category || undefined,
      level: (params?.level as CourseLevel) || undefined,
      isApproved: true,
      isRejected: false,
      status: "published",
      // ✅ Optional: Add userId filter if needed
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

      <div className="mt-8">
        <NextBackButton
          nextCursor={data.nextCursor || ""}
          hasMore={data.hasMore}
          currentParams={params || {}} // ✅ Pass current params
        />
      </div>
    </>
  );
}
