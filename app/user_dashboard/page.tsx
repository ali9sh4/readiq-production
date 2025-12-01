// /app/user_dashboard/page.tsx
import { cookies } from "next/headers";
import { getCurrentUser } from "@/data/auth-server";
import { getUserEnrolledCoursesWithStats } from "./actions";
import { getUserFavorites } from "../actions/favorites_actions";
import DashboardHome from "./main/DashboardHome";
import { Course } from "@/types/types";
interface DashboardStats {
  enrolledCoursesCount: number;
  createdCoursesCount: number;
  completedCoursesCount: number;
  totalLearningTime: number;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("firebaseAuthToken")?.value;

  let enrolledCourses: Course[] = [];
  let favorites: any = [];
  let stats: DashboardStats | null = null;

  if (token) {
    try {
      const userResult = await getCurrentUser({ token });

      if (userResult.success && userResult.user) {
        // ✅ Fetch data on server - much faster
        const [enrolledData, favoritesResult] = await Promise.all([
          getUserEnrolledCoursesWithStats(token, 20),
          getUserFavorites(token, 6),
        ]);

        if (enrolledData.success && enrolledData.courses) {
          enrolledCourses = enrolledData.courses;
          stats = enrolledData.stats ?? null;
        }

        if (favoritesResult.success && favoritesResult.favorites) {
          favorites = favoritesResult.favorites;
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  }

  return (
    <DashboardHome
      initialEnrolledCourses={enrolledCourses}
      initialFavorites={favorites}
      initialStats={stats}
    />
  );
}
