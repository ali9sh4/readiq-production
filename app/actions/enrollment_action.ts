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
      if (!doc.exists) {
        enrollments[courseIds[index]] = false;
        return;
      }

      const data = doc.data();

      // ✅ Check enrollment is valid
      const isValidEnrollment =
        data?.enrollmentType === "free" || // Free course enrollment
        data?.status === "completed"; // Paid course completed

      enrollments[courseIds[index]] = isValidEnrollment;
    });

    return {
      success: true,
      enrollments,
    };
  } catch (error) {
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
  const verifyToken = await adminAuth.verifyIdToken(token);
  const userId = verifyToken.uid;
  const courseDoc = await db.collection("courses").doc(courseId).get();
  if (!courseDoc.exists) {
    return {
      success: false,
      message: "Course not found",
    };
  }
  const courseData = courseDoc.data();
  if (courseData?.price !== 0) {
    return {
      success: false,
      message: "This course is not free",
    };
  }

  try {
    const enrollmentRef = db
      .collection("enrollments")
      .doc(`${userId}_${courseId}`);
    const existingEnrollment = await enrollmentRef.get();

    if (existingEnrollment.exists) {
      return {
        success: true,
        message: "User already enrolled in this course",
      };
    }

    await enrollmentRef.set({
      userId,
      courseId,
      enrolledAt: new Date().toISOString(),
      enrollmentType: "free",
      status: "completed", // ✅ Add this for consistency
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

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

export async function getUserCourses(token: string, userId: string) {}
export async function initiatePurchase(courseId: string, token: string) {}
