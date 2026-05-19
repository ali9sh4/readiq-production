"use server";

import { adminAuth, db } from "@/firebase/service";
import { revalidatePath } from "next/cache";
import {
  getEnrolledCoursesAndStatsByUid,
  EnrolledCoursesResult,
} from "@/lib/dashboard/queries";

// ✅ OPTIMIZED - Fetch courses AND stats in ONE function
export async function getUserEnrolledCoursesWithStats(
  token: string,
  limit?: number
): Promise<EnrolledCoursesResult> {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return {
        success: false,
        error: true,
        message: "يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    return await getEnrolledCoursesAndStatsByUid(verifiedToken.uid, limit);
  } catch (error) {
    console.error("Error fetching enrolled courses:", error);
    return {
      success: false,
      error: true,
      message: "حدث خطأ أثناء جلب الدورات المسجلة",
    };
  }
}

// ✅ Keep these for backward compatibility (they just call the new function)
export async function getUserEnrolledCourses(token: string, limit?: number) {
  const result = await getUserEnrolledCoursesWithStats(token, limit);
  return {
    success: result.success,
    courses: result.courses,
    error: result.error,
    message: result.message,
  };
}

export async function getDashboardStats(token: string) {
  const result = await getUserEnrolledCoursesWithStats(token);
  return {
    success: result.success,
    stats: result.stats,
    error: result.error,
    message: result.message,
  };
}
export async function updateUserProfilePicture(
  userId: string,
  photoPath: string | null, // Path in storage, not full URL
  token: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken || verifiedToken.uid !== userId) {
      return { success: false, error: "Invalid authentication" };
    }

    // Update in Firestore users collection
    await db.collection("users").doc(userId).update({
      photoURL: photoPath,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath("/dashboard/profile");
    return { success: true, message: "تم تحديث صورة الملف الشخصي بنجاح" };
  } catch (error) {
    console.error("Failed to update profile picture:", error);
    return { success: false, error: "Failed to update profile picture" };
  }
}
