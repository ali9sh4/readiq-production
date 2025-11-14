"use server";

import { adminAuth, db } from "@/firebase/service";
import { revalidatePath } from "next/cache";

// ===== REQUEST COURSE DELETION (Instructor/Owner) =====
export async function requestCourseDeletion(courseId: string, token: string) {
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

    // Check if user is owner or admin
    const isOwner = courseData?.createdBy === verifiedToken.uid;
    const isAdmin = verifiedToken.admin === true;

    if (!isOwner && !isAdmin) {
      return { success: false, error: "Permission denied" };
    }

    // Check if already deleted or deletion requested
    if (courseData?.isDeleted) {
      return { success: false, error: "الدورة محذوفة بالفعل" };
    }

    if (courseData?.deletionStatus === "requested") {
      return { success: false, error: "طلب الحذف قيد المراجعة" };
    }

    // Update course with deletion request
    await db.collection("courses").doc(courseId).update({
      deletionStatus: "requested",
      deletionRequestedAt: new Date().toISOString(),
      deletionRequestedBy: verifiedToken.uid,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath("/admin");
    revalidatePath(`/course/${courseId}`);

    return {
      success: true,
      message: "تم إرسال طلب الحذف للمراجعة",
    };
  } catch (error: any) {
    console.error("Failed to request deletion:", error);
    return {
      success: false,
      error: error.message || "Failed to request deletion",
    };
  }
}

// ===== APPROVE DELETION (Admin Only) =====
export async function approveDeletion(
  courseId: string,
  token: string,
  adminNotes?: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const adminUser = await adminAuth.getUser(verifiedToken.uid);

    // Check admin permission
    const isAdmin =
      adminUser.customClaims?.admin ||
      process.env.FIREBASE_ADMIN_EMAIL === adminUser.email;

    if (!isAdmin) {
      return { success: false, error: "غير مصرح - المدراء فقط" };
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();

    // Check if deletion was requested
    if (courseData?.deletionStatus !== "requested") {
      return { success: false, error: "لا يوجد طلب حذف لهذه الدورة" };
    }

    // ✅ SOFT DELETE - Mark as deleted, hide from public
    await db
      .collection("courses")
      .doc(courseId)
      .update({
        deletionStatus: "approved",
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: verifiedToken.uid,
        status: "archived", // Change status so it doesn't show in lists
        adminNotes: adminNotes || "",
        updatedAt: new Date().toISOString(),
      });

    // TODO: In future, add grace period logic here
    // TODO: Send notification to students

    revalidatePath("/admin");
    revalidatePath(`/course/${courseId}`);

    return {
      success: true,
      message: "تم حذف الدورة بنجاح",
    };
  } catch (error: any) {
    console.error("Failed to approve deletion:", error);
    return {
      success: false,
      error: error.message || "Failed to approve deletion",
    };
  }
}

// ===== REJECT DELETION REQUEST (Admin Only) =====
export async function rejectDeletionRequest(
  courseId: string,
  token: string,
  rejectionReason: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const adminUser = await adminAuth.getUser(verifiedToken.uid);

    const isAdmin =
      adminUser.customClaims?.admin ||
      process.env.FIREBASE_ADMIN_EMAIL === adminUser.email;

    if (!isAdmin) {
      return { success: false, error: "غير مصرح - المدراء فقط" };
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();

    if (courseData?.deletionStatus !== "requested") {
      return { success: false, error: "لا يوجد طلب حذف لهذه الدورة" };
    }

    // Reset deletion request
    await db.collection("courses").doc(courseId).update({
      deletionStatus: "rejected",
      deletionRejectedAt: new Date().toISOString(),
      deletionRejectionReason: rejectionReason,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath("/admin");
    revalidatePath(`/course/${courseId}`);

    return {
      success: true,
      message: "تم رفض طلب الحذف",
    };
  } catch (error: any) {
    console.error("Failed to reject deletion:", error);
    return {
      success: false,
      error: error.message || "Failed to reject deletion",
    };
  }
}
export async function restoreDeletedCourse(courseId: string, token: string) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const adminUser = await adminAuth.getUser(verifiedToken.uid);

    // Check admin permission
    const isAdmin =
      adminUser.customClaims?.admin ||
      process.env.FIREBASE_ADMIN_EMAIL === adminUser.email;

    if (!isAdmin) {
      return { success: false, error: "غير مصرح - المدراء فقط" };
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();

    // Check if course is deleted
    if (!courseData?.isDeleted) {
      return { success: false, error: "الدورة ليست محذوفة" };
    }

    // ✅ RESTORE - Remove deletion flags
    await db.collection("courses").doc(courseId).update({
      isDeleted: false,
      deletionStatus: "none",
      status: "draft", // Reset to draft, instructor can republish
      restoredAt: new Date().toISOString(),
      restoredBy: verifiedToken.uid,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath("/admin");
    revalidatePath(`/course/${courseId}`);

    return {
      success: true,
      message: "تم استعادة الدورة بنجاح",
    };
  } catch (error: any) {
    console.error("Failed to restore course:", error);
    return {
      success: false,
      error: error.message || "Failed to restore course",
    };
  }
}
