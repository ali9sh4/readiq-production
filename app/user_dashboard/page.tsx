// /app/user_dashboard/page.tsx
import { cookies } from "next/headers";
import DashboardHome from "./main/DashboardHome";
import { Course } from "@/types/types";
import { redirect } from "next/navigation";
import { adminAuth, db } from "@/firebase/service";
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
  // Time-limited access: courseId -> accessExpiresAt for the remaining-days
  // counter on دوراتي cards.
  let accessExpiresAtByCourseId: Record<string, string> = {};
  // Instructor phone nudge: an instructor (course creator) with no phone on
  // file should be prompted to add one. Both signals come from this same
  // verified read so the client banner needs no extra round-trip.
  let needsPhone = false;
  // Post-login phone+consent capture card: shown to ANY user with no phone who
  // hasn't chosen "don't ask again". Computed from the same verified read.
  let showPhonePrompt = false;

  try {
    // Verify once, then fan out — the prior code re-verified the token inside
    // getCurrentUser + each data loader (3 round-trips to Firebase Auth).
    const verified = await adminAuth.verifyIdToken(token);

    const [enrolledData, favoritesResult, userSnap] = await Promise.all([
      getEnrolledCoursesAndStatsByUid(verified.uid, 20),
      getUserFavoritesByUid(verified.uid, 6),
      db.collection("users").doc(verified.uid).get(),
    ]);

    if (enrolledData.success && enrolledData.courses) {
      enrolledCourses = enrolledData.courses;
      stats = enrolledData.stats ?? null;
      accessExpiresAtByCourseId = enrolledData.accessExpiresAtByCourseId ?? {};
    }

    if (favoritesResult.success && favoritesResult.favorites) {
      favorites = favoritesResult.favorites;
    }

    const userData = userSnap?.exists ? userSnap.data() : undefined;
    const isInstructor = (stats?.createdCoursesCount ?? 0) > 0;
    const phone = userData?.phone;
    const hasPhone = typeof phone === "string" && phone.trim().length > 0;
    const dismissed = userData?.phonePromptDismissed === true;

    needsPhone = isInstructor && !hasPhone;
    showPhonePrompt = !hasPhone && !dismissed;
    // Avoid double-prompting on this page: when the richer capture card is
    // showing, suppress the lighter instructor nudge banner.
    if (showPhonePrompt) needsPhone = false;
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
  }

  return (
    <DashboardHome
      initialEnrolledCourses={enrolledCourses}
      initialFavorites={favorites}
      initialStats={stats}
      accessExpiresAtByCourseId={accessExpiresAtByCourseId}
      needsPhone={needsPhone}
      showPhonePrompt={showPhonePrompt}
    />
  );
}
