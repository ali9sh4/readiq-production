"use server";

import { adminAuth, db } from "@/firebase/service";
import { Course } from "@/types/types";

// ✅ OPTIMIZED - Fetch courses AND stats in ONE function
export async function getUserEnrolledCoursesWithStats(
  token: string,
  limit?: number
): Promise<{
  success: boolean;
  courses?: Course[];
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

    // ✅ Fetch enrollments and created courses in parallel
    const [enrollmentsSnapshot, createdCoursesSnapshot] = await Promise.all([
      db
        .collection("enrollments")
        .where("userId", "==", verifiedToken.uid)
        .orderBy("enrolledAt", "desc")
        .get(),
      db
        .collection("courses")
        .where("createdBy", "==", verifiedToken.uid)
        .get(),
    ]);

    const courseIds = enrollmentsSnapshot.docs.map(
      (doc) => doc.data().courseId
    );

    if (courseIds.length === 0) {
      return {
        success: true,
        courses: [],
        stats: {
          enrolledCoursesCount: 0,
          createdCoursesCount: createdCoursesSnapshot.size,
          completedCoursesCount: 0,
          totalLearningTime: 0,
        },
      };
    }

    // ✅ Limit for dashboard (optional)
    const idsToFetch = limit ? courseIds.slice(0, limit) : courseIds;

    // ✅ Fetch courses in parallel batches
    const courseDocs = await fetchCoursesInParallel(idsToFetch);

    // ✅ Calculate stats while mapping courses (single pass)
    let totalLearningTime = 0;
    const courses = courseDocs.map((doc) => {
      const data = doc.data();
      totalLearningTime += data?.duration ?? 0;

      return {
        id: doc.id,
        ...data,
        title: data.title || "",
        category: data.category || "",
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
      stats: {
        enrolledCoursesCount: enrollmentsSnapshot.size,
        createdCoursesCount: createdCoursesSnapshot.size,
        completedCoursesCount: 0,
        totalLearningTime,
      },
    };
  } catch (error) {
    console.error("Error fetching enrolled courses:", error);
    return {
      success: false,
      error: true,
      message: "حدث خطأ أثناء جلب الدورات المسجلة",
    };
  }
}

// ✅ Helper: Fetch courses in parallel batches of 10
async function fetchCoursesInParallel(
  courseIds: string[]
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  if (courseIds.length === 0) return [];

  // Split into batches of 10 (Firestore 'in' limit)
  const batches: string[][] = [];
  for (let i = 0; i < courseIds.length; i += 10) {
    batches.push(courseIds.slice(i, i + 10));
  }

  // ✅ Fetch ALL batches in parallel (not sequential!)
  const batchPromises = batches.map((batch) =>
    db.collection("courses").where("__name__", "in", batch).get()
  );

  const batchSnapshots = await Promise.all(batchPromises);

  // Flatten results
  return batchSnapshots.flatMap((snapshot) => snapshot.docs);
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
