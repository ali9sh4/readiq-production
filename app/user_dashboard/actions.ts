"use server";

import { adminAuth, db } from "@/firebase/service";
import { Course } from "@/types/types";

// Get user enrolled courses
export async function getUserEnrolledCourses(token: string): Promise<{
  success: boolean;
  courses?: Course[];
  error?: boolean;
  message?: string;
}> {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return {
        success: false,
        error: true,
        message: "يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    // Get user enrollments
    const enrollmentsSnapshot = await db
      .collection("enrollments")
      .where("userId", "==", verifiedToken.uid)
      .orderBy("enrolledAt", "desc")
      .get();

    const courseIds = enrollmentsSnapshot.docs.map(
      (doc) => doc.data().courseId
    );

    if (courseIds.length === 0) {
      return {
        success: true,
        courses: [],
      };
    }
    if (courseIds.length > 10) {
      // Handle batches of 10
      const courseBatches = [];
      for (let i = 0; i < courseIds.length; i += 10) {
        const batch = courseIds.slice(i, i + 10);
        const batchSnapshot = await db
          .collection("courses")
          .where("__name__", "in", batch)
          .get();
        courseBatches.push(...batchSnapshot.docs);
      }

      const courses = courseBatches.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          title: data.title || "",
          category: data.category || "",
          // Convert ALL timestamps to ISO strings
          createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || null,
          publishedAt: data?.publishedAt?.toDate?.()?.toISOString() || null,
          approvedAt: data?.approvedAt?.toDate?.()?.toISOString() || null,
          rejectedAt: data?.rejectedAt?.toDate?.()?.toISOString() || null,
        } as Course;
      });
      return {
        success: true,
        courses,
      };
    } else {
      // Your existing single query logic
      const coursesSnapshot = await db
        .collection("courses")
        .where("__name__", "in", courseIds)
        .get();

      const courses = coursesSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          title: data.title || "",
          category: data.category || "",
          // Convert ALL timestamps to ISO strings
          createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || null,
          publishedAt: data?.publishedAt?.toDate?.()?.toISOString() || null,
          approvedAt: data?.approvedAt?.toDate?.()?.toISOString() || null,
          rejectedAt: data?.rejectedAt?.toDate?.()?.toISOString() || null,
        } as Course;
      });

      return {
        success: true,
        courses,
      };
    }
  } catch (error) {
    console.error("Error fetching enrolled courses:", error);
    return {
      success: false,
      error: true,
      message: "حدث خطأ أثناء جلب الدورات المسجلة",
    };
  }
}

// Get dashboard statistics
export async function getDashboardStats(token: string): Promise<{
  success: boolean;
  stats?: {
    enrolledCoursesCount: number;
    createdCoursesCount: number;
    completedCoursesCount: number;
    totalLearningTime: number;
  };
  error?: boolean;
  message?: string;
}> {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return {
        success: false,
        error: true,
        message: "يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    // Get enrolled courses count
    const enrollmentsSnapshot = await db
      .collection("enrollments")
      .where("userId", "==", verifiedToken.uid)
      .get();

    // Get created courses count
    const createdCoursesSnapshot = await db
      .collection("courses")
      .where("createdBy", "==", verifiedToken.uid)
      .get();

    // For now, we'll set completed courses to 0 since there's no progress tracking yet
    const completedCoursesCount = 0;

    // Calculate total learning time from enrolled courses
    const courseIds = enrollmentsSnapshot.docs.map(
      (doc) => doc.data().courseId
    );
    let totalLearningTime = 0;

    // Replace this section in getDashboardStats:
    if (courseIds.length > 0) {
      if (courseIds.length > 10) {
        // Handle batches of 10
        for (let i = 0; i < courseIds.length; i += 10) {
          const batch = courseIds.slice(i, i + 10);
          const batchSnapshot = await db
            .collection("courses")
            .where("__name__", "in", batch)
            .get();

          totalLearningTime += batchSnapshot.docs.reduce((total, doc) => {
            return total + (doc.data()?.duration ?? 0);
          }, 0);
        }
      } else {
        const coursesSnapshot = await db
          .collection("courses")
          .where("__name__", "in", courseIds)
          .get();

        totalLearningTime = coursesSnapshot.docs.reduce((total, doc) => {
          return total + (doc.data()?.duration ?? 0);
        }, 0);
      }
    }

    return {
      success: true,
      stats: {
        enrolledCoursesCount: enrollmentsSnapshot.size,
        createdCoursesCount: createdCoursesSnapshot.size,
        completedCoursesCount,
        totalLearningTime,
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      success: false,
      error: true,
      message: "حدث خطأ أثناء جلب إحصائيات لوحة التحكم",
    };
  }
}
