import { getCourses } from "@/data/courses";
import { cookies } from "next/headers"; // ✅ ADD THIS IMPORT
import { getCurrentUser } from "@/data/auth-server";
import NextBackButton from "./loadMoreButoon";
import { CourseResponse } from "@/types/types";
import CoursesCardList from "./CoursesCardList.tsx  ";

type CourseLevel = "beginner" | "intermediate" | "advanced" | "all_levels";

export default async function InstructorCourse({
  searchParams,
}: {
  searchParams?: Promise<{
    cursor?: string;
    category?: string;
    level?: string;
    isAdminView?: boolean;
  }>;
}) {
  const params = await searchParams;

  const cookieStore = await cookies();
  const token = cookieStore.get("firebaseAuthToken")?.value;

  let currentUserId: string | undefined = undefined;
  let isAdmin = false;

  if (token) {
    const userResult = await getCurrentUser({ token });
    if (userResult.success) {
      currentUserId = userResult.user?.uid;
      isAdmin = userResult.isAdmin || false;
    } else {
      console.log("❌ Failed to get user:", userResult.message);
    }
  }

  const data: CourseResponse = await getCourses({
    pagination: {
      lastDocId: params?.cursor || undefined,
      pageSize: 8,
    },
    filters: {
      category: params?.category || undefined,
      level: (params?.level as CourseLevel) || undefined,
      userId: isAdmin ? undefined : currentUserId,
      isDeleted: false,
    },
  });

  if (!data.success || data.error) {
    return (
      <div className="flex items-center justify-center p-8 text-xl font-medium text-red-600 bg-red-50 rounded-lg shadow-sm border border-red-200">
        خطأ في تحميل الدورات: {data.error || "حدث خطأ غير متوقع"}
      </div>
    );
  }

  return (
    <>
      <CoursesCardList data={data} isAdminView={true} />
      {data.hasMore && (
        <div className="mt-8">
          <NextBackButton
            nextCursor={data.nextCursor || ""}
            hasMore={data.hasMore}
            currentParams={params || {}}
          />
        </div>
      )}
    </>
  );
} // ✅ REMOVE THE EXTRA 's' - Just close with }
