"use server";

import { adminAuth, db } from "@/firebase/service";
import { Course } from "@/types/types";

// ===== ADD TO FAVORITES =====
export async function addToFavorites(
  token: string,
  courseId: string,
  courseTitle: string,
  courseThumbnail?: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;

    // Create composite ID to prevent duplicates
    const favoriteId = `${userId}_${courseId}`;

    // Check if already exists
    const existingFav = await db.collection("favorites").doc(favoriteId).get();

    if (existingFav.exists) {
      return {
        success: false,
        error: "الدورة موجودة بالفعل في المفضلة",
      };
    }

    // Add to favorites
    await db
      .collection("favorites")
      .doc(favoriteId)
      .set({
        id: favoriteId,
        userId,
        courseId,
        courseTitle,
        courseThumbnail: courseThumbnail || null,
        createdAt: new Date().toISOString(),
      });

    return {
      success: true,
      message: "تمت إضافة الدورة إلى المفضلة",
    };
  } catch (error: any) {
    console.error("Add to favorites error:", error);
    return {
      success: false,
      error: error.message || "حدث خطأ",
    };
  }
}

// ===== REMOVE FROM FAVORITES =====
export async function removeFromFavorites(token: string, courseId: string) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;

    const favoriteId = `${userId}_${courseId}`;

    // Delete the favorite
    await db.collection("favorites").doc(favoriteId).delete();

    return {
      success: true,
      message: "تمت إزالة الدورة من المفضلة",
    };
  } catch (error: any) {
    console.error("Remove from favorites error:", error);
    return {
      success: false,
      error: error.message || "حدث خطأ",
    };
  }
}

// ===== CHECK IF FAVORITED =====
export async function checkIfFavorited(token: string, courseId: string) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;

    const favoriteId = `${userId}_${courseId}`;
    const favDoc = await db.collection("favorites").doc(favoriteId).get();

    return {
      success: true,
      isFavorited: favDoc.exists,
    };
  } catch (error: any) {
    return {
      success: false,
      isFavorited: false,
    };
  }
}

// ===== GET USER'S FAVORITES =====
// app/actions/favorites_actions.ts

export async function getUserFavorites(
  token: string,
  limit: number = 20,
  lastDocId?: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;

    let favoritesQuery = db
      .collection("favorites")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (lastDocId) {
      const lastDoc = await db.collection("favorites").doc(lastDocId).get();
      if (lastDoc.exists) {
        favoritesQuery = favoritesQuery.startAfter(lastDoc);
      }
    }

    const snapshot = await favoritesQuery.get();

    // ✅ Fetch full course data for each favorite
    const favoritesWithCourseData = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const favData = doc.data();
        const courseDoc = await db
          .collection("courses")
          .doc(favData.courseId)
          .get();

        if (!courseDoc.exists) {
          return null; // Course was deleted
        }

        const data = courseDoc.data();
        return {
          id: courseDoc.id,
          ...data,
          title: data?.title || "",
          category: data?.category || "",
          // ✅ Convert ALL timestamps to ISO strings (same as getUserEnrolledCourses)
          createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || null,
          publishedAt: data?.publishedAt?.toDate?.()?.toISOString() || null,
          approvedAt: data?.approvedAt?.toDate?.()?.toISOString() || null,
          rejectedAt: data?.rejectedAt?.toDate?.()?.toISOString() || null,
        } as Course;
      })
    );

    // Filter out deleted courses
    const favorites = favoritesWithCourseData.filter(Boolean);

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
      error: error.message,
      favorites: [],
      hasMore: false,
      lastDocId: null,
    };
  }
}
// ===== CHECK MULTIPLE FAVORITES (Like checkUserEnrollments) =====
export async function checkUserFavorites(token: string, courseIds: string[]) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;

    // Build favorite IDs
    const favoriteIds = courseIds.map((courseId) => `${userId}_${courseId}`);

    // Batch get all favorites
    const favoriteRefs = favoriteIds.map((id) =>
      db.collection("favorites").doc(id)
    );

    const favoriteDocs = await db.getAll(...favoriteRefs);

    // Build result map
    const favorites: Record<string, boolean> = {};
    courseIds.forEach((courseId, index) => {
      favorites[courseId] = favoriteDocs[index].exists;
    });

    return {
      success: true,
      favorites,
    };
  } catch (error: any) {
    console.error("Check user favorites error:", error);
    return {
      success: false,
      favorites: {},
    };
  }
}

// ===== GET COURSE FAVORITE COUNT (Optional - for analytics) =====
export async function getCourseFavoriteCount(courseId: string) {
  try {
    const snapshot = await db
      .collection("favorites")
      .where("courseId", "==", courseId)
      .count()
      .get();

    return {
      success: true,
      count: snapshot.data().count,
    };
  } catch (error: any) {
    return {
      success: false,
      count: 0,
    };
  }
}
