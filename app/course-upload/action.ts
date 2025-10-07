// app/course-upload/action.ts
"use server";

import { adminAuth, db } from "@/firebase/service";
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
    const validation = QuickCourseSchema.safeParse(CourseData);
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

// Save course images (v8 Admin SDK)
export const SaveImages = async (
  {
    courseId,
    images,
  }: {
    courseId: string;
    images: string[];
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
      images: z.array(z.string()).min(1, "صورة واحدة على الأقل مطلوبة"),
    });

    const validation = schema.safeParse({ courseId, images });
    if (!validation.success) {
      return {
        error: true,
        message:
          validation.error.issues[0]?.message ?? "البيانات المرسلة غير صحيحة.",
      };
    }

    // Update course with images using v8 Admin SDK syntax
    await db.collection("courses").doc(courseId).update({
      images,
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: "تم حفظ الصور بنجاح",
    };
  } catch (error) {
    console.error("Error saving images:", error);
    return {
      error: true,
      message: "حدث خطأ أثناء حفظ الصور",
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
      hasFiles: true,
      filesCount: allFiles.length, // ✅ Total count of all files
      updatedAt: new Date().toISOString(),
      status: "complete",
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
