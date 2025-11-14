"use server";

import { adminAuth, db } from "@/firebase/service";

export async function migrateCourses(token: string) {
  try {
    // Verify admin
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const adminUser = await adminAuth.getUser(verifiedToken.uid);

    const isAdmin =
      adminUser.customClaims?.admin ||
      process.env.FIREBASE_ADMIN_EMAIL === adminUser.email;

    if (!isAdmin) {
      return { success: false, error: "غير مصرح - المدراء فقط" };
    }

    // Get all courses
    const coursesSnapshot = await db.collection("courses").get();

    // Use batch for atomic updates (max 500 per batch)
    let batch = db.batch();
    let count = 0;
    let batchCount = 0;

    for (const doc of coursesSnapshot.docs) {
      const data = doc.data();

      // Only update if isDeleted doesn't exist
      if (data.isDeleted === undefined) {
        batch.update(doc.ref, {
          isDeleted: false,
          deletionStatus: "none",
        });
        count++;
        batchCount++;

        // Commit every 500 operations (Firestore limit)
        if (batchCount === 500) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }

    // Commit remaining operations
    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`✅ Migration complete: Updated ${count} courses`);

    return {
      success: true,
      count,
      message: `تم تحديث ${count} دورة بنجاح`,
    };
  } catch (error: any) {
    console.error("Migration failed:", error);
    return {
      success: false,
      error: error.message || "حدث خطأ أثناء التحديث",
      count: 0,
    };
  }
}
