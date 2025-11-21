"use server";
import { adminAuth, db } from "@/firebase/service";

export async function checkUserEnrollments(
  userId: string,
  courseIds: string[]
): Promise<{
  success: boolean;
  enrollments: Record<string, boolean>;
  message?: string;
}> {
  try {
    const enrollmentPromises = courseIds.map((courseId) =>
      db.collection("enrollments").doc(`${userId}_${courseId}`).get()
    );

    const enrollmentDocs = await Promise.all(enrollmentPromises);

    const enrollments: Record<string, boolean> = {};
    enrollmentDocs.forEach((doc, index) => {
      // ✅ Simpler check - if document exists, user is enrolled
      enrollments[courseIds[index]] = doc.exists;
    });

    return {
      success: true,
      enrollments,
    };
  } catch (error) {
    console.error("Error checking enrollments:", error);
    return {
      success: false,
      enrollments: {},
      message: `Failed to check enrollments: ${error}`,
    };
  }
}
export async function enrollInFreeCourse(courseId: string, token: string) {
  if (!token || !courseId) {
    return { success: false, message: "معلومات ناقصة" };
  }

  try {
    const verifyToken = await adminAuth.verifyIdToken(token);
    const userId = verifyToken.uid;

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, message: "Course not found" };
    }

    const courseData = courseDoc.data();
    if (courseData?.createdBy === userId) {
      return {
        success: false,
        message: "لا يمكنك التسجيل في دورتك الخاصة",
      };
    }
    if (courseData?.price !== 0) {
      return { success: false, message: "This course is not free" };
    }

    const enrollmentRef = db
      .collection("enrollments")
      .doc(`${userId}_${courseId}`);
    const existingEnrollment = await enrollmentRef.get();

    if (existingEnrollment.exists) {
      return {
        success: true,
        message: "User already enrolled in this course",
        alreadyEnrolled: true, // ✅ Add this flag
      };
    }

    // ✅ Use a batch write for atomicity
    const batch = db.batch();

    // Create enrollment
    batch.set(enrollmentRef, {
      userId,
      courseId,
      enrolledAt: new Date().toISOString(),
      enrollmentType: "free",
      status: "completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // ✅ Increment enrollment count directly
    const courseRef = db.collection("courses").doc(courseId);
    batch.update(courseRef, {
      enrollmentCount: (courseData.enrollmentCount || 0) + 1,
      updatedAt: new Date().toISOString(),
    });

    await batch.commit();

    return {
      success: true,
      message: "Enrolled successfully",
    };
  } catch (error: any) {
    console.error("Enrollment error:", error);
    return {
      success: false,
      message: `Failed to enroll in free course: ${error.message || error}`,
    };
  }
}
// ✅ Count enrollments for a course
export async function updateCourseEnrollmentCount(courseId: string) {
  try {
    // Count all valid enrollments for this course
    const enrollmentsSnapshot = await db
      .collection("enrollments")
      .where("courseId", "==", courseId)
      .where("status", "==", "completed")
      .get();

    const enrollmentCount = enrollmentsSnapshot.size;

    // Update course document
    await db.collection("courses").doc(courseId).update({
      enrollmentCount,
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      enrollmentCount,
    };
  } catch (error: any) {
    console.error("Error updating enrollment count:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// ✅ Sync enrollment counts for all courses (run once to backfill)
export async function syncAllCourseEnrollmentCounts() {
  try {
    const coursesSnapshot = await db.collection("courses").get();
    const updatePromises = coursesSnapshot.docs.map((doc) =>
      updateCourseEnrollmentCount(doc.id)
    );

    await Promise.all(updatePromises);

    return {
      success: true,
      message: `Updated enrollment counts for ${coursesSnapshot.size} courses`,
    };
  } catch (error: any) {
    console.error("Error syncing enrollment counts:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}
