// app/course-upload/action.ts
"use server";

import { adminAuth, db, storage } from "@/firebase/service";
import { Course, CourseFile } from "@/types/types";
import {
  CourseDataSchema,
  QuickCourseSchema,
} from "@/validation/propertySchema";
import z from "zod";

// Types
interface UploadedFile {
  filename: string;
  size: number;
  originalName: string;
  relatedVideoId?: string;
}
interface SaveCourseFilesParams {
  courseId: string;
  files: UploadedFile[];
  token?: string;
}

// Helper function to determine file type
function getFileType(filename: string): string {
  const extension = filename.toLowerCase().split(".").pop() || "";

  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
  const videoExtensions = ["mp4", "webm", "mov", "avi"];
  const audioExtensions = ["mp3", "wav", "aac", "m4a"];
  const documentExtensions = ["pdf", "doc", "docx", "ppt", "pptx", "txt"];
  const archiveExtensions = ["zip", "rar", "7z"];

  if (imageExtensions.includes(extension)) return "image";
  if (videoExtensions.includes(extension)) return "video";
  if (audioExtensions.includes(extension)) return "audio";
  if (documentExtensions.includes(extension)) return "document";
  if (archiveExtensions.includes(extension)) return "archive";

  return "file";
}

// Save new course (v8 Admin SDK)
export const SaveNewProperty = async (
  data: z.infer<typeof CourseDataSchema> & { token: string }
) => {
  try {
    const { token, ...CourseData } = data;

    // Verify token
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return {
        error: true,
        message: "يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    // Validate data
    const validation = CourseDataSchema.safeParse(CourseData);
    if (!validation.success) {
      return {
        error: true,
        message:
          validation.error.issues[0].message ?? "البيانات المرسلة غير صحيحة.",
      };
    }

    // Prepare course data
    const courseToSave = {
      ...CourseData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: verifiedToken.uid,
      isApproved: false,
      isRejected: false,
      status: "draft", // Initial status
      hasFiles: false,
      filesCount: 0,
      isDeleted: false, // ✅ ADD THIS
      deletionStatus: "none", // ✅ ADD THIS
    };

    // Save to Firestore using v8 Admin SDK syntax
    const courseRef = await db.collection("courses").add(courseToSave);

    return {
      success: true,
      courseId: courseRef.id,
      message: "تم إنشاء الدورة بنجاح",
    };
  } catch (error) {
    console.error("Error saving course:", error);
    return {
      error: true,
      message: "حدث خطأ أثناء حفظ الدورة",
    };
  }
};
export const SaveQuickCourseCreation = async (
  data: z.infer<typeof QuickCourseSchema> & { token: string }
) => {
  console.log("🔵 SERVER: SaveQuickCourseCreation function called");
  console.log("🔵 SERVER: Received data:", {
    title: data.title,
    category: data.category,
    level: data.level,
    price: data.price,
    description: data.description ? `${data.description.substring(0, 50)}...` : "empty",
    hasToken: !!data.token,
    tokenLength: data.token?.length || 0,
  });

  try {
    const { token, ...CourseData } = data;
    
    console.log("🔵 SERVER: Step 1 - Token extracted successfully");
    console.log("🔵 SERVER: Course data after token extraction:", {
      title: CourseData.title,
      category: CourseData.category,
      level: CourseData.level,
      price: CourseData.price,
    });

    // Verify token
    console.log("🔵 SERVER: Step 2 - Starting token verification...");
    
    let verifiedToken;
    try {
      verifiedToken = await adminAuth.verifyIdToken(token);
      console.log("✅ SERVER: Token verified successfully");
      console.log("🔵 SERVER: Verified user UID:", verifiedToken.uid);
      console.log("🔵 SERVER: Verified user email:", verifiedToken.email);
    } catch (tokenError) {
      console.error("🔴 SERVER: Token verification FAILED");
      console.error("🔴 SERVER: Token error:", tokenError);
      return {
        error: true,
        message: "فشل التحقق من الجلسة. يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    if (!verifiedToken) {
      console.log("🔴 SERVER: verifiedToken is null/undefined");
      return {
        error: true,
        message: "يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    // Validate data
    console.log("🔵 SERVER: Step 3 - Validating course data...");
    const validation = QuickCourseSchema.safeParse(CourseData);
    
    if (!validation.success) {
      console.log("🔴 SERVER: Validation FAILED");
      console.log("🔴 SERVER: Validation errors:", JSON.stringify(validation.error.issues, null, 2));
      return {
        error: true,
        message:
          validation.error.issues[0].message ?? "البيانات المرسلة غير صحيحة.",
      };
    }
    
    console.log("✅ SERVER: Data validation passed");

    // Prepare course data
    console.log("🔵 SERVER: Step 4 - Preparing course data for Firestore...");
    const courseToSave = {
      ...CourseData,
      level: CourseData.level || "all_levels", // ✅ Set default if not provided
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: verifiedToken.uid,
      isApproved: false,
      isRejected: false,
      status: "draft",
      hasFiles: false,
      filesCount: 0,
      isDeleted: false,
      deletionStatus: "none",
    };

    console.log("🔵 SERVER: Course data prepared:", {
      title: courseToSave.title,
      category: courseToSave.category,
      level: courseToSave.level,
      price: courseToSave.price,
      createdBy: courseToSave.createdBy,
      status: courseToSave.status,
    });

    // Save to Firestore
    console.log("🔵 SERVER: Step 5 - Saving to Firestore...");
    
    let courseRef;
    try {
      courseRef = await db.collection("courses").add(courseToSave);
      console.log("✅ SERVER: Course saved to Firestore successfully!");
      console.log("✅ SERVER: New course ID:", courseRef.id);
    } catch (firestoreError) {
      console.error("🔴 SERVER: Firestore save FAILED");
      console.error("🔴 SERVER: Firestore error:", firestoreError);
      
      if (firestoreError instanceof Error) {
        console.error("🔴 SERVER: Error name:", firestoreError.name);
        console.error("🔴 SERVER: Error message:", firestoreError.message);
        console.error("🔴 SERVER: Error stack:", firestoreError.stack);
      }
      
      return {
        error: true,
        message: "فشل حفظ الدورة في قاعدة البيانات",
      };
    }

    console.log("✅ SERVER: Step 6 - Returning success response");
    
    const successResponse = {
      success: true,
      courseId: courseRef.id,
      message: "تم إنشاء الدورة بنجاح",
    };
    
    console.log("✅ SERVER: Success response:", successResponse);
    
    return successResponse;
    
  } catch (error) {
    console.error("🔴 SERVER: UNEXPECTED ERROR in SaveQuickCourseCreation");
    console.error("🔴 SERVER: Error object:", error);
    
    if (error instanceof Error) {
      console.error("🔴 SERVER: Error name:", error.name);
      console.error("🔴 SERVER: Error message:", error.message);
      console.error("🔴 SERVER: Error stack:", error.stack);
    }
    
    return {
      error: true,
      message: "حدث خطأ أثناء حفظ الدورة",
    };
  }
};

// Save course images (v8 Admin SDK)
export const SaveThumbnail = async (
  {
    courseId,
    thumbnailUrl,
  }: {
    courseId: string;
    thumbnailUrl: string;
  },
  token: string
) => {
  try {
    // Verify token
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return {
        error: true,
        message: "يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    // Validate input
    const schema = z.object({
      courseId: z.string().min(1, "معرف الدورة مطلوب"),
      thumbnailUrl: z.string().min(1, "رابط الصورة المصغرة مطلوب"),
    });

    const validation = schema.safeParse({ courseId, thumbnailUrl });
    if (!validation.success) {
      return {
        error: true,
        message:
          validation.error.issues[0]?.message ?? "البيانات المرسلة غير صحيحة.",
      };
    }

    // Update course with thumbnail using v8 Admin SDK syntax
    await db.collection("courses").doc(courseId).update({
      thumbnailUrl,
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: "تم حفظ الصورة المصغرة بنجاح",
    };
  } catch (error) {
    console.error("Error saving thumbnail:", error);
    return {
      error: true,
      message: "حدث خطأ أثناء حفظ الصورة المصغرة",
    };
  }
};
// Fixed saveCourseFiles function
export async function saveCourseFilesToFirebase({
  courseId,
  files,
  token,
}: SaveCourseFilesParams) {
  try {
    // Verify token
    if (!token) {
      return {
        success: false,
        error: true,
        message: "يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return {
        success: false,
        error: true,
        message: "يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    // Validate input
    if (!courseId || !files || files.length === 0) {
      return {
        success: false,
        error: true,
        message: "معرف الدورة والملفات مطلوبان",
      };
    }

    // ✅ Get existing course data first
    const courseDoc = await db.collection("courses").doc(courseId).get();

    if (!courseDoc.exists) {
      return {
        success: false,
        error: true,
        message: "الدورة غير موجودة",
      };
    }

    const courseData = courseDoc.data();
    const existingFiles = courseData?.files || [];

    // ✅ Find the next available order number
    const maxOrder =
      existingFiles.length > 0
        ? Math.max(...existingFiles.map((f: any) => f.order || 0))
        : 0;

    // Prepare new files data for database
    const filesData: CourseFile[] = files.map((file, index) => ({
      id: `file_${maxOrder + index + 1}`, // ✅ Ensure unique IDs
      filename: file.filename,
      size: file.size,
      originalName: file.originalName,
      uploadedAt: new Date().toISOString(),
      order: maxOrder + index + 1, // ✅ Continue order sequence
      type: getFileType(file.originalName),
      ...(file.relatedVideoId && { relatedVideoId: file.relatedVideoId }),
    }));

    // ✅ Combine existing files with new files
    const allFiles = [...existingFiles, ...filesData];

    // Update the course document
    await db.collection("courses").doc(courseId).update({
      files: allFiles, // ✅ Keep all files (existing + new)
      filesCount: allFiles.length, // ✅ Total count of all files
    });

    return {
      success: true,
      message: "تم حفظ ملفات الدورة بنجاح",
    };
  } catch (error) {
    console.error("Error saving course files:", error);
    return {
      success: false,
      error: true,
      message: "حدث خطأ أثناء حفظ ملفات الدورة",
    };
  }
}

// Get course files (v8 Admin SDK)
export async function getCourseFiles(courseId: string): Promise<{
  success: boolean;
  files?: CourseFile[];
  error?: boolean;
  message?: string;
}> {
  try {
    if (!courseId) {
      return {
        success: false,
        error: true,
        message: "معرف الدورة مطلوب",
      };
    }

    // Get course document using v8 Admin SDK syntax
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return {
        success: false,
        error: true,
        message: "الدورة غير موجودة",
      };
    }

    const courseData = courseDoc.data();

    return {
      success: true,
      files: courseData?.files || [],
    };
  } catch (error) {
    console.error("Error fetching course files:", error);
    return {
      success: false,
      error: true,
      message: "حدث خطأ أثناء جلب ملفات الدورة",
    };
  }
}
// action.ts
export const DeleteThumbnail = async (courseId: string, token: string) => {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return {
        success: false,
        error: true,
        message: "يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    // ✅ Get course to verify ownership AND get thumbnail path
    const courseDoc = await db.collection("courses").doc(courseId).get();

    if (!courseDoc.exists) {
      return { success: false, error: true, message: "الدورة غير موجودة" };
    }

    const courseData = courseDoc.data();

    // ✅ Verify ownership
    if (courseData?.createdBy !== verifiedToken.uid) {
      return {
        success: false,
        error: true,
        message: "ليس لديك صلاحية لحذف هذه الصورة",
      };
    }

    // ✅ Delete from Storage (only handle new URL format)
    if (courseData?.thumbnailUrl) {
      const bucket = storage.bucket();

      // Extract path from Firebase Storage URL
      // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
      const url = new URL(courseData.thumbnailUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+)/);

      if (!pathMatch || !pathMatch[1]) {
        return {
          success: false,
          error: true,
          message: "رابط الصورة غير صالح",
        };
      }

      // Decode the URL-encoded path and remove query params
      const storagePath = decodeURIComponent(pathMatch[1].split("?")[0]);

      // Delete from Storage
      await bucket.file(storagePath).delete();
    }

    // ✅ Update Firestore
    await db.collection("courses").doc(courseId).update({
      thumbnailUrl: null,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, message: "تم حذف الصورة المصغرة بنجاح" };
  } catch (error) {
    console.error("Error deleting thumbnail:", error);
    return {
      success: false,
      error: true,
      message: "حدث خطأ أثناء حذف الصورة المصغرة",
    };
  }
};

// Get course by ID (v8 Admin SDK)
export async function getCourseById(courseId: string): Promise<{
  success: boolean;
  course?: Course;
  error?: boolean;
  message?: string;
}> {
  try {
    if (!courseId) {
      return {
        success: false,
        error: true,
        message: "معرف الدورة مطلوب",
      };
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();

    if (!courseDoc.exists) {
      return {
        success: false,
        error: true,
        message: "الدورة غير موجودة",
      };
    }

    return {
      success: true,
      course: {
        title: "",
        category: "",
        ...courseDoc.data(),
        id: courseDoc.id,
        createdAt:
          courseDoc.data()?.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt:
          courseDoc.data()?.updatedAt?.toDate?.()?.toISOString() || null,
      },
    };
  } catch (error) {
    console.error("Error fetching course:", error);
    return {
      success: false,
      error: true,
      message: "حدث خطأ أثناء جلب بيانات الدورة",
    };
  }
}

// Update course status (v8 Admin SDK)
export async function updateCourseStatus(
  courseId: string,
  status: "draft" | "complete" | "published" | "archived",
  token: string
): Promise<{
  success: boolean;
  message?: string;
  error?: boolean;
}> {
  try {
    // Verify token
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return {
        success: false,
        error: true,
        message: "يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    if (!courseId || !status) {
      return {
        success: false,
        error: true,
        message: "معرف الدورة والحالة مطلوبان",
      };
    }

    await db.collection("courses").doc(courseId).update({
      status,
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: "تم تحديث حالة الدورة بنجاح",
    };
  } catch (error) {
    console.error("Error updating course status:", error);
    return {
      success: false,
      error: true,
      message: "حدث خطأ أثناء تحديث حالة الدورة",
    };
  }
}

// Delete course file (v8 Admin SDK)
export async function deleteCourseMetaDataFile(
  courseId: string,
  fileId: string,
  token: string
): Promise<{
  success: boolean;
  message?: string;
  error?: boolean;
}> {
  try {
    // Verify token
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return {
        success: false,
        error: true,
        message: "يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    // Get current course data
    const courseResponse = await getCourseFiles(courseId);
    if (!courseResponse.success || !courseResponse.files) {
      return {
        success: false,
        error: true,
        message: "فشل في جلب ملفات الدورة",
      };
    }

    // Remove the specific file
    const updatedFiles = courseResponse.files.filter(
      (file) => file.id !== fileId
    );

    // Update course with new files array
    await db
      .collection("courses")
      .doc(courseId)
      .update({
        files: updatedFiles,
        filesCount: updatedFiles.length,
        hasFiles: updatedFiles.length > 0,
        updatedAt: new Date().toISOString(),
      });

    return {
      success: true,
      message: "تم حذف الملف بنجاح",
    };
  } catch (error) {
    console.error("Error deleting course file:", error);
    return {
      success: false,
      error: true,
      message: "حدث خطأ أثناء حذف الملف",
    };
  }
}

// Get user's courses (v8 Admin SDK)
export async function getUserCourses(token: string): Promise<{
  success: boolean;
  courses?: any[];
  error?: boolean;
  message?: string;
}> {
  try {
    // Verify token
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return {
        success: false,
        error: true,
        message: "يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    // Get courses created by this user
    const coursesSnapshot = await db
      .collection("courses")
      .where("createdBy", "==", verifiedToken.uid)
      .orderBy("createdAt", "desc")
      .get();

    const courses = coursesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      success: true,
      courses,
    };
  } catch (error) {
    console.error("Error fetching user courses:", error);
    return {
      success: false,
      error: true,
      message: "حدث خطأ أثناء جلب الدورات",
    };
  }
}
