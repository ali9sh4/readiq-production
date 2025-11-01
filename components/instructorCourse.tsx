import { getCourses } from "@/data/courses";
import { cookies } from "next/headers";
import CoursesCardList from "./CoursesCardList.tsx  ";
import { getCurrentUser } from "@/data/auth-server";
import NextBackButton from "./loadMoreButoon";
import { CourseResponse } from "@/types/types";
type CourseLevel = "beginner" | "intermediate" | "advanced" | "all_levels";

export default async function InstructorCourse({
  searchParams,
}: {
  searchParams?: Promise<{
    // ✅ Changed to Promise
    cursor?: string;
    category?: string;
    level?: string;
    isAdminView?: boolean;
  }>;
}) {
  // ✅ Await searchParams
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
      lastDocId: params?.cursor || undefined, // ✅ Use params
      pageSize: 8,
    },
    filters: {
      category: params?.category || undefined, // ✅ Use params
      level: (params?.level as CourseLevel) || undefined, // ✅ Use params
      userId: isAdmin ? undefined : currentUserId,
    },
  });

  // ✅ Add error handling
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
            currentParams={params || {}} // ✅ Use params
          />
        </div>
      )}
    </>
  );
}
