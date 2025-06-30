import { getCourses } from "@/data/courses";
import { cookies } from "next/headers";
import CoursesCardList from "./CoursesCardList.tsx  ";
import { getCurrentUser } from "@/data/auth-server";
import NextBackButton from "./loadMoreButoon";
import { CourseResponse } from "@/types/types";
type CourseLevel = "beginner" | "intermediate" | "advanced" | "all_levels";

export default async function InstructorCourse({
  searchParams = {},
}: {
  searchParams?: {
    cursor?: string;
    category?: string;
    level?: string;
  };
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("firebaseAuthToken")?.value;
  console.log("🔍 Token found:", !!token); // Check if token exists // ✅ Correct cookie name

  let currentUserId: string | undefined = undefined;
  if (token) {
    console.log("🔍 Attempting to get current user...");
    const userResult = await getCurrentUser({ token });
    console.log("🔍 User result:", userResult); // See what's returned
    if (userResult.success) {
      currentUserId = userResult.user?.uid;
      console.log("🔍 Current user ID:", currentUserId);
    } else {
      console.log("❌ Failed to get user:", userResult.message);
    }
  }

  const data: CourseResponse = await getCourses({
    pagination: {
      lastDocId: searchParams.cursor || undefined,
      pageSize: 8,
    },
    filters: {
      category: searchParams.category || undefined,
      level: (searchParams.level as CourseLevel) || undefined,
      userId: currentUserId || undefined,
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
      <CoursesCardList data={data} isAdminView={true} />{" "}
      {/* ✅ Add isAdminView */}
      {data.hasMore && (
        <div className="mt-8">
          <NextBackButton
            nextCursor={data.nextCursor || ""}
            hasMore={data.hasMore}
            currentParams={searchParams}
          />
        </div>
      )}
    </>
  );
}
