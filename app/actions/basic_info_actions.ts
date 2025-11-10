"use server";

import { adminAuth, db } from "@/firebase/service";
import { revalidatePath } from "next/cache";

// ===== UPDATE COURSE BASIC INFO =====
export async function updateCourseBasicInfo(
  courseId: string,
  updates: {
    title?: string;
    subtitle?: string;
    description?: string;
    category?: string;
    level?: "beginner" | "intermediate" | "advanced" | "all_levels";
    language?: "arabic" | "english" | "french" | "spanish";
  },
  token: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();
    const isOwner = courseData?.createdBy === verifiedToken.uid;
    const isAdmin = verifiedToken.admin === true;
    if (!isAdmin && !isOwner) {
      return { success: false, error: "Permission denied" };
    }

    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([v]) => v !== undefined)
    );

    await db
      .collection("courses")
      .doc(courseId)
      .update({
        ...cleanUpdates,
        updatedAt: new Date().toISOString(),
      });

    revalidatePath(`/course/${courseId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update course:", error);
    return { success: false, error: "Failed to update course" };
  }
}

// ===== UPDATE COURSE PRICING =====
export async function updateCoursePricing(
  courseId: string,
  pricing: { price?: number; salePrice?: number; currency?: string },
  token: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();
    const isOwner = courseData?.createdBy === verifiedToken.uid;
    const isAdmin = verifiedToken.admin === true;
    if (!isAdmin && !isOwner) {
      return { success: false, error: "Permission denied" };
    }

    const cleanPricing = Object.fromEntries(
      Object.entries(pricing).filter(([_, v]) => v !== undefined)
    );

    // ✅ Single atomic update
    const updates: any = {
      ...cleanPricing,
      updatedAt: new Date().toISOString(),
    };

    await db.collection("courses").doc(courseId).update(updates);

    revalidatePath(`/course/${courseId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update pricing:", error);
    return { success: false, error: "Failed to update pricing" };
  }
}

// ===== UPDATE COURSE LEARNING POINTS =====
export async function updateCourseLearningPoints(
  courseId: string,
  learningPoints: string[],
  token: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();
    const isOwner = courseData?.createdBy === verifiedToken.uid;
    const isAdmin = verifiedToken.admin === true;
    if (!isAdmin && !isOwner) {
      return { success: false, error: "Permission denied" };
    }

    await db.collection("courses").doc(courseId).update({
      learningPoints,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/course/${courseId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update learning points:", error);
    return { success: false, error: "Failed to update learning points" };
  }
}

// ===== UPDATE COURSE REQUIREMENTS =====
export async function updateCourseRequirements(
  courseId: string,
  requirements: string[],
  token: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();
    // ✅ Allow owner OR admin
    const isOwner = courseData?.createdBy === verifiedToken.uid;
    const isAdmin = verifiedToken.admin === true;

    if (!isOwner && !isAdmin) {
      return { success: false, error: "Permission denied" };
    }

    await db.collection("courses").doc(courseId).update({
      requirements,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/course/${courseId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update requirements:", error);
    return { success: false, error: "Failed to update requirements" };
  }
}

// ===== PUBLISH COURSE =====
export async function publishCourse(courseId: string, token: string) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();
    const isOwner = courseData?.createdBy === verifiedToken.uid;
    const isAdmin = verifiedToken.admin === true;
    if (!isAdmin && !isOwner) {
      return { success: false, error: "Permission denied" };
    }

    // Validation: Check if course is ready to publish
    const hasVideos = courseData?.videos?.length > 0;
    const hasTitle = courseData?.title?.trim().length > 0;
    const hasCategory = courseData?.category?.trim().length > 0;
    const hasPrice = courseData?.price !== undefined;

    if (!hasVideos || !hasTitle || !hasCategory || !hasPrice) {
      return {
        success: false,
        error: "الدورة غير مكتملة. تأكد من وجود فيديوهات وعنوان وتصنيف وسعر",
      };
    }

    await db.collection("courses").doc(courseId).update({
      status: "published",
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/course/${courseId}`);
    return { success: true, message: "تم نشر الدورة بنجاح" };
  } catch (error) {
    console.error("Failed to publish course:", error);
    return { success: false, error: "Failed to publish course" };
  }
}

// ===== UNPUBLISH COURSE =====
export async function unpublishCourse(courseId: string, token: string) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();
    const isOwner = courseData?.createdBy === verifiedToken.uid;
    const isAdmin = verifiedToken.admin === true;
    if (!isAdmin && !isOwner) {
      return { success: false, error: "Permission denied" };
    }

    await db.collection("courses").doc(courseId).update({
      status: "draft",
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/course/${courseId}`);
    return { success: true, message: "تم إلغاء نشر الدورة" };
  } catch (error) {
    console.error("Failed to unpublish course:", error);
    return { success: false, error: "Failed to unpublish course" };
  }
}
// ===== UPDATE COURSE THUMBNAIL =====

// ===== UPDATE COURSE THUMBNAIL =====
export async function updateCourseThumbnail(
  courseId: string,
  thumbnailPath: string | null, // Just the path, not full URL
  token: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();
    const isOwner = courseData?.createdBy === verifiedToken.uid;
    const isAdmin = verifiedToken.admin === true;
    if (!isAdmin && !isOwner) {
      return { success: false, error: "Permission denied" };
    }

    // ✅ Update or remove thumbnail
    await db.collection("courses").doc(courseId).update({
      thumbnail: thumbnailPath, // Store just the path
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/course/${courseId}`);
    revalidatePath(`/course-upload/edit/${courseId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update thumbnail:", error);
    return { success: false, error: "Failed to update thumbnail" };
  }
}
