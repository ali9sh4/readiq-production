"use server";

import { adminAuth, db } from "@/firebase/service";
import { getUserFavoritesByUid } from "@/lib/dashboard/queries";

// ===== ADD TO FAVORITES =====
export async function addToFavorites(token: string, courseId: string) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;

    const favoriteId = `${userId}_${courseId}`;

    // ✅ Only store essential data - course details fetched separately
    await db.collection("favorites").doc(favoriteId).set({
      userId,
      courseId,
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

// ===== CHECK IF FAVORITED (Single) =====
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

// ===== CHECK MULTIPLE FAVORITES (Batch) - MOST IMPORTANT FOR PERFORMANCE =====
export async function checkUserFavorites(token: string, courseIds: string[]) {
  if (courseIds.length === 0) {
    return { success: true, favorites: {} };
  }

  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;

    const favoriteIds = courseIds.map((courseId) => `${userId}_${courseId}`);

    // ✅ Batch get (up to 500 at once) - 1 DB call instead of N calls
    const favoriteRefs = favoriteIds.map((id) =>
      db.collection("favorites").doc(id)
    );

    const favoriteDocs = await db.getAll(...favoriteRefs);

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

// ===== GET USER'S FAVORITES (Optimized for pagination) =====
export async function getUserFavorites(
  token: string,
  limit: number = 20,
  lastDocId?: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    return await getUserFavoritesByUid(verifiedToken.uid, limit, lastDocId);
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

// ===== GET FAVORITE COUNT FOR COURSE (Analytics) =====
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

// ===== GET ALL FAVORITE IDs (Fast lightweight check) =====
// Useful when you only need IDs, not full course data
export async function getUserFavoriteIds(token: string) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;

    const snapshot = await db
      .collection("favorites")
      .where("userId", "==", userId)
      .select("courseId") // ✅ Only fetch courseId field - faster!
      .get();

    const courseIds = snapshot.docs.map((doc) => doc.data().courseId);

    return {
      success: true,
      courseIds,
    };
  } catch (error: any) {
    console.error("Get favorite IDs error:", error);
    return {
      success: false,
      courseIds: [],
    };
  }
}
