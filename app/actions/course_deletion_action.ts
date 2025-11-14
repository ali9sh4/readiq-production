"use server";

import { adminAuth, db } from "@/firebase/service";
import { revalidatePath } from "next/cache";

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
// ===== PERMANENT DELETION (Admin Only - IRREVERSIBLE) =====
export async function permanentlyDeleteCourse(courseId: string, token: string) {
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

    // Security check: Only delete if already soft-deleted
    if (!courseData?.isDeleted) {
      return {
        success: false,
        error: "يجب حذف الدورة مسبقاً قبل الحذف النهائي",
      };
    }

    console.log(`🗑️ Starting permanent deletion for course: ${courseId}`);

    // ===== 1. DELETE ALL VIDEOS FROM MUX =====
    const videos = courseData?.videos || [];
    if (videos.length > 0) {
      console.log(`📹 Deleting ${videos.length} videos from Mux...`);
      for (const video of videos) {
        try {
          const mux = (await import("@/lib/mux/mux")).default;
          await mux.video.assets.delete(video.assetId);
          console.log(`✅ Deleted Mux asset: ${video.assetId}`);
        } catch (error) {
          console.error(
            `⚠️ Failed to delete Mux asset ${video.assetId}:`,
            error
          );
          // Continue anyway - asset might already be deleted
        }
      }
    }

    // ===== 2. DELETE THUMBNAIL FROM FIREBASE STORAGE =====
    if (courseData?.thumbnailUrl) {
      console.log(`🖼️ Deleting thumbnail...`);
      try {
        const { storage } = await import("@/firebase/service");
        const bucket = storage.bucket();
        const url = new URL(courseData.thumbnailUrl);
        const pathMatch = url.pathname.match(/\/o\/(.+)/);

        if (pathMatch && pathMatch[1]) {
          const storagePath = decodeURIComponent(pathMatch[1].split("?")[0]);
          await bucket.file(storagePath).delete();
          console.log(`✅ Deleted thumbnail: ${storagePath}`);
        }
      } catch (error) {
        console.error("⚠️ Failed to delete thumbnail:", error);
        // Continue anyway
      }
    }

    // ===== 3. DELETE ALL FILES FROM R2 =====
    const files = courseData?.files || [];
    if (files.length > 0) {
      console.log(`📁 Deleting ${files.length} files from R2...`);
      for (const file of files) {
        try {
          const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
          const { r2Client, R2_BUCKET_NAME } = await import(
            "@/lib/R2/r2_client"
          );

          const deleteCommand = new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: file.filename,
          });

          await r2Client.send(deleteCommand);
          console.log(`✅ Deleted R2 file: ${file.filename}`);
        } catch (error) {
          console.error(`⚠️ Failed to delete R2 file ${file.filename}:`, error);
          // Continue anyway
        }
      }
    }

    // ===== 4. DELETE ALL ENROLLMENTS =====
    console.log(`👥 Deleting enrollments...`);
    const enrollmentsSnapshot = await db
      .collection("enrollments")
      .where("courseId", "==", courseId)
      .get();

    if (!enrollmentsSnapshot.empty) {
      const batch = db.batch();
      enrollmentsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`✅ Deleted ${enrollmentsSnapshot.size} enrollments`);
    }

    // ===== 5. DELETE ALL FAVORITES ===== ✅ NEW!
    console.log(`⭐ Deleting favorites...`);
    const favoritesSnapshot = await db
      .collection("favorites")
      .where("courseId", "==", courseId)
      .get();

    if (!favoritesSnapshot.empty) {
      const batch = db.batch();
      favoritesSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`✅ Deleted ${favoritesSnapshot.size} favorites`);
    }

    // ===== 6. DELETE COURSE DOCUMENT =====
    console.log(`📄 Deleting course document...`);
    await db.collection("courses").doc(courseId).delete();

    console.log(`✅ Course ${courseId} permanently deleted!`);

    revalidatePath("/admin");

    return {
      success: true,
      message: "تم حذف الدورة نهائياً بنجاح",
      deleted: {
        videos: videos.length,
        files: files.length,
        enrollments: enrollmentsSnapshot?.size || 0,
        favorites: favoritesSnapshot?.size || 0, // ✅ NEW!
      },
    };
  } catch (error: any) {
    console.error("❌ Permanent deletion failed:", error);
    return {
      success: false,
      error: error.message || "Failed to permanently delete course",
    };
  }
}
// ===== SOFT DELETE COURSE (Instructor or Admin) =====
export async function softDeleteCourse(courseId: string, token: string) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();
    const isOwner = courseData?.createdBy === verifiedToken.uid;
    const isAdmin = verifiedToken.admin === true;

    if (!isOwner && !isAdmin) {
      return { success: false, error: "Permission denied" };
    }

    // Check if already deleted
    if (courseData?.isDeleted) {
      return { success: false, error: "الدورة محذوفة بالفعل" };
    }

    // Soft delete
    await db.collection("courses").doc(courseId).update({
      isDeleted: true,
      deletionStatus: "approved",
      deletedAt: new Date().toISOString(),
      deletedBy: verifiedToken.uid,
      status: "archived",
      updatedAt: new Date().toISOString(),
    });

    revalidatePath("/course-upload");
    revalidatePath(`/course/${courseId}`);

    return { success: true, message: "تم حذف الدورة" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
