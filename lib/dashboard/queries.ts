import "server-only";

import { db } from "@/firebase/service";
import { Course } from "@/types/types";

export type EnrolledCoursesResult = {
  success: boolean;
  courses?: Course[];
  // Time-limited access: courseId -> the enrollment's accessExpiresAt
  // stamp. Only time-limited enrollments appear here; lifetime ones are
  // absent. Drives the remaining-days counter on the دوراتي cards.
  accessExpiresAtByCourseId?: Record<string, string>;
  stats?: {
    enrolledCoursesCount: number;
    createdCoursesCount: number;
    completedCoursesCount: number;
    totalLearningTime: number;
  };
  error?: boolean;
  message?: string;
};

export type FavoritesResult = {
  success: boolean;
  favorites: Course[];
  hasMore: boolean;
  lastDocId: string | null;
  error?: string;
};

// Internal: caller is responsible for verifying the token first.
export async function getEnrolledCoursesAndStatsByUid(
  uid: string,
  limit?: number
): Promise<EnrolledCoursesResult> {
  try {
    const [enrollmentsSnapshot, createdCoursesSnapshot] = await Promise.all([
      db
        .collection("enrollments")
        .where("userId", "==", uid)
        .orderBy("enrolledAt", "desc")
        .get(),
      db.collection("courses").where("createdBy", "==", uid).get(),
    ]);

    const courseIds = enrollmentsSnapshot.docs.map(
      (doc) => doc.data().courseId
    );

    // Time-limited access stamps, keyed by courseId (same snapshot — no
    // extra reads).
    const accessExpiresAtByCourseId: Record<string, string> = {};
    enrollmentsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (typeof data.accessExpiresAt === "string" && data.courseId) {
        accessExpiresAtByCourseId[data.courseId] = data.accessExpiresAt;
      }
    });

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

    const idsToFetch = limit ? courseIds.slice(0, limit) : courseIds;
    const courseDocs = await fetchCoursesInParallel(idsToFetch);

    let totalLearningTime = 0;
    const courses = courseDocs
      .map((doc) => {
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
      })
      .filter((course) => !course.isDeleted);

    return {
      success: true,
      courses,
      accessExpiresAtByCourseId,
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

// Internal: caller is responsible for verifying the token first.
export async function getUserFavoritesByUid(
  uid: string,
  limit: number = 20,
  lastDocId?: string
): Promise<FavoritesResult> {
  try {
    let favoritesQuery = db
      .collection("favorites")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (lastDocId) {
      const lastDoc = await db.collection("favorites").doc(lastDocId).get();
      if (lastDoc.exists) {
        favoritesQuery = favoritesQuery.startAfter(lastDoc);
      }
    }

    const snapshot = await favoritesQuery.get();
    const courseIds = snapshot.docs.map((doc) => doc.data().courseId);

    if (courseIds.length === 0) {
      return {
        success: true,
        favorites: [],
        hasMore: false,
        lastDocId: null,
      };
    }

    const courseRefs = courseIds.map((id) => db.collection("courses").doc(id));
    const courseDocs = await db.getAll(...courseRefs);

    const favorites: Course[] = courseDocs
      .map((courseDoc) => {
        if (!courseDoc.exists) return null;

        const data = courseDoc.data();
        if (data?.isDeleted === true) return null;

        return {
          id: courseDoc.id,
          ...data,
          title: data?.title || "",
          category: data?.category || "",
          createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || null,
          publishedAt: data?.publishedAt?.toDate?.()?.toISOString() || null,
          approvedAt: data?.approvedAt?.toDate?.()?.toISOString() || null,
          rejectedAt: data?.rejectedAt?.toDate?.()?.toISOString() || null,
        } as Course;
      })
      .filter((course): course is Course => course !== null);

    const lastVisible = snapshot.docs[snapshot.docs.length - 1];

    return {
      success: true,
      favorites,
      hasMore: snapshot.size === limit,
      lastDocId: lastVisible?.id || null,
    };
  } catch (error: any) {
    console.error("Get favorites error:", error);
    return {
      success: false,
      error: error?.message,
      favorites: [],
      hasMore: false,
      lastDocId: null,
    };
  }
}

async function fetchCoursesInParallel(
  courseIds: string[]
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  if (courseIds.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < courseIds.length; i += 10) {
    batches.push(courseIds.slice(i, i + 10));
  }

  const batchPromises = batches.map((batch) =>
    db.collection("courses").where("__name__", "in", batch).get()
  );

  const batchSnapshots = await Promise.all(batchPromises);
  return batchSnapshots.flatMap((snapshot) => snapshot.docs);
}
