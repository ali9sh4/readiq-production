"use server";

import { adminAuth, db } from "@/firebase/service";
import { Course } from "@/types/types";

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

    const courseIds = snapshot.docs.map((doc) => doc.data().courseId);

    if (courseIds.length === 0) {
      return {
        success: true,
        favorites: [],
        hasMore: false,
        lastDocId: null,
      };
    }

    // ✅ Batch fetch all courses at once (much faster than loop!)
    const courseRefs = courseIds.map((id) => db.collection("courses").doc(id));
    const courseDocs = await db.getAll(...courseRefs);

    // ✅ Map courses with proper type conversion
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
