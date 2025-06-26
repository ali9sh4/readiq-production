"use server";

import { adminAuth, db } from "@/firebase/service";

export const approveCourse = async (
  courseId: string,
  approve: boolean,
  token: string
) => {
  try {
    const verifyAuthToken = await adminAuth.verifyIdToken(token);

    if (!verifyAuthToken.admin) {
      return {
        error: true,
        message: "غير مخول لك اعتماد الدورات",
      };
    }

    // Update course with approval status
    await db
      .collection("courses")
      .doc(courseId)
      .update({
        isApproved: approve,
        isRejected: !approve, // Track rejection explicitly
        approvedAt: approve ? new Date() : null,
        rejectedAt: approve ? null : new Date(),
        approvedBy: verifyAuthToken.uid,
        updatedAt: new Date(),
      });

    return {
      success: true,
      message: approve ? "تم اعتماد الدورة بنجاح" : "تم رفض الدورة بنجاح",
    };
  } catch (error) {
    console.error("Error in approveCourse:", error);
    return {
      error: true,
      message: "حدث خطأ أثناء معالجة الطلب",
    };
  }
};

// Separate reject function for clarity (optional - you can use approveCourse with false)
export const rejectCourse = async (
  courseId: string,
  token: string,
  rejectionReason?: string
) => {
  try {
    const verifyAuthToken = await adminAuth.verifyIdToken(token);

    if (!verifyAuthToken.admin) {
      return {
        error: true,
        message: "غير مخول لك رفض الدورات",
      };
    }

    // Update course with rejection
    await db
      .collection("courses")
      .doc(courseId)
      .update({
        isApproved: false,
        isRejected: true,
        rejectedAt: new Date(),
        rejectedBy: verifyAuthToken.uid,
        rejectionReason: rejectionReason || "لم يتم تحديد سبب الرفض",
        updatedAt: new Date(),
      });

    return {
      success: true,
      message: "تم رفض الدورة بنجاح",
    };
  } catch (error) {
    console.error("Error in rejectCourse:", error);
    return {
      error: true,
      message: "حدث خطأ أثناء رفض الدورة",
    };
  }
};

// Reset course status (useful if you want to "undo" an approval/rejection)
export const resetCourseStatus = async (courseId: string, token: string) => {
  try {
    const verifyAuthToken = await adminAuth.verifyIdToken(token);

    if (!verifyAuthToken.admin) {
      return {
        error: true,
        message: "غير مخول لك إعادة تعيين حالة الدورة",
      };
    }

    // Reset course to pending status
    await db.collection("courses").doc(courseId).update({
      isApproved: false,
      isRejected: false,
      approvedAt: null,
      rejectedAt: null,
      approvedBy: null,
      rejectedBy: null,
      rejectionReason: null,
      updatedAt: new Date(),
    });

    return {
      success: true,
      message: "تم إعادة تعيين حالة الدورة إلى قيد المراجعة",
    };
  } catch (error) {
    console.error("Error in resetCourseStatus:", error);
    return {
      error: true,
      message: "حدث خطأ أثناء إعادة تعيين حالة الدورة",
    };
  }
};

// Get course statistics for admin dashboard
export const getCourseStats = async (token: string) => {
  try {
    const verifyAuthToken = await adminAuth.verifyIdToken(token);

    if (!verifyAuthToken.admin) {
      return {
        error: true,
        message: "غير مخول لك الوصول لإحصائيات الدورات",
      };
    }

    // Get all courses
    const coursesSnapshot = await db.collection("courses").get();
    const courses = coursesSnapshot.docs.map((doc) => doc.data());

    const stats = {
      total: courses.length,
      pending: courses.filter((c) => !c.isApproved && !c.isRejected).length,
      approved: courses.filter((c) => c.isApproved === true).length,
      rejected: courses.filter((c) => c.isRejected === true).length,
    };

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error("Error in getCourseStats:", error);
    return {
      error: true,
      message: "حدث خطأ أثناء جلب الإحصائيات",
    };
  }
};
