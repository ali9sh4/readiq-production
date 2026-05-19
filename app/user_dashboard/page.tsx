// /app/user_dashboard/page.tsx
import { cookies } from "next/headers";
import DashboardHome from "./main/DashboardHome";
import { Course } from "@/types/types";
import { redirect } from "next/navigation";
import { adminAuth } from "@/firebase/service";
import {
  getEnrolledCoursesAndStatsByUid,
  getUserFavoritesByUid,
} from "@/lib/dashboard/queries";

interface DashboardStats {
  enrolledCoursesCount: number;
  createdCoursesCount: number;
  completedCoursesCount: number;
  totalLearningTime: number;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("firebaseAuthToken")?.value;
  if (!token) {
    redirect("/login");
  }

  let enrolledCourses: Course[] = [];
  let favorites: Course[] = [];
  let stats: DashboardStats | null = null;

  try {
    // Verify once, then fan out — the prior code re-verified the token inside
    // getCurrentUser + each data loader (3 round-trips to Firebase Auth).
    const verified = await adminAuth.verifyIdToken(token);

    const [enrolledData, favoritesResult] = await Promise.all([
      getEnrolledCoursesAndStatsByUid(verified.uid, 20),
      getUserFavoritesByUid(verified.uid, 6),
    ]);

    if (enrolledData.success && enrolledData.courses) {
      enrolledCourses = enrolledData.courses;
      stats = enrolledData.stats ?? null;
    }

    if (favoritesResult.success && favoritesResult.favorites) {
      favorites = favoritesResult.favorites;
    }
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
  }

  return (
    <DashboardHome
      initialEnrolledCourses={enrolledCourses}
      initialFavorites={favorites}
      initialStats={stats}
    />
  );
}
