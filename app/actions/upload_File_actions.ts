// app/actions/upload-actions.ts
"use server";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  validateFile,
  createFileMetadata,
  FileMetadata,
} from "@/lib/R2/file-security";

import { Ratelimit } from "@upstash/ratelimit";
import { R2_BUCKET_NAME, r2Client } from "@/lib/R2/r2_client";
import { adminAuth, db } from "@/firebase/service";
import { Redis } from "@upstash/redis";
import { CourseFile } from "@/components/fileUplaodtoR2";
  
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 uploads per minute
});

export interface UploadResult {
  success: boolean;
  error?: string;
  data?: {
    filename: string;
    size: number;
    metadata: FileMetadata;
  };
}

/**
 * Secure file upload server action
 */
export async function uploadCourseFileToR2(
  formData: FormData
): Promise<UploadResult> {
  try {
    // 1. Extract and validate inputs first
    const file = formData.get("file") as File;
    const courseId = formData.get("courseId") as string;
    const token = formData.get("token") as string;

    // 2. Basic validation
    if (!token) {
      return { success: false, error: "Authentication required" };
    }

    if (!file || !courseId) {
      return { success: false, error: "No file provided" };
    }

    // 3. Verify authentication
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    // 4. Apply rate limiting AFTER authentication
    const identifier = `upload_${verifiedToken.uid}`;
    const { success: rateLimitOk } = await ratelimit.limit(identifier);

    if (!rateLimitOk) {
      return {
        success: false,
        error: "تم تجاوز الحد المسموح به. يرجى الانتظار قبل المحاولة مرة أخرى.",
      };
    }

    // 5. File validation
    const validation = validateFile(file);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // 6. Continue with upload logic...
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const metadata = await createFileMetadata(file, buffer, courseId);

    // 7. Upload to R2
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: metadata.sanitizedName,
      Body: buffer,
      ContentType: file.type,
      ContentLength: file.size,
      Metadata: {
        uploadedAt: new Date().toISOString(),
        fileHash: metadata.hash,
        uploader: verifiedToken.uid,
        courseId: courseId,
      },
      ServerSideEncryption: "AES256",
    });

    await r2Client.send(uploadCommand);

    return {
      success: true,
      data: {
        filename: metadata.sanitizedName,
        size: file.size,
        metadata,
      },
    };
  } catch (error) {
    console.error("Upload failed:", error);

    return {
      success: false,
      error: "Upload failed. Please try again.",
    };
  }
}

/**
 * Delete course file server action
 */
export async function deleteCourseFileFromR2({
  filename,
  courseId,
  token,
}: {
  filename: string;
  courseId: string;
  token: string;
}): Promise<UploadResult> {
  try {
    // 1. Validate inputs
    if (!filename || !courseId || !token) {
      return {
        success: false,
        error: "Missing required parameters",
      };
    }

    // 2. Validate filename to prevent path traversal
    if (filename.includes("..") || !filename.startsWith("courses/")) {
      return {
        success: false,
        error: "Invalid filename",
      };
    }

    // 3. Authenticate user
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return {
        success: false,
        error: "Invalid authentication",
      };
    }

    // 4. Check course ownership/permission
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return {
        success: false,
        error: "Course not found",
      };
    }

    const courseData = courseDoc.data();
    const isOwner = courseData?.createdBy === verifiedToken.uid;
    const isAdmin = verifiedToken.admin === true;

    if (!isOwner && !isAdmin) {
      return {
        success: false,
        error: "Permission denied",
      };
    }

    // 5. Verify file belongs to this course
    const fileExists = courseData?.files?.some(
      (file: CourseFile) => file.filename === filename
    );

    if (!fileExists) {
      return {
        success: false,
        error: "File not found in course",
      };
    }

    // 6. Delete from R2
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const deleteCommand = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filename,
    });

    await r2Client.send(deleteCommand);

    // 7. Remove from database
    await db
      .collection("courses")
      .doc(courseId)
      .update({
        files: courseData?.files.filter(
          (file: CourseFile) => file.filename !== filename
        ),
      });

    console.log(`File deleted successfully: ${filename}`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Delete failed:", error);
    return {
      success: false,
      error: "Delete failed. Please try again.",
    };
  }
}
export async function getFileSignedUrl({
  filename,
  courseId,
  token,
  expiresIn = 3600,
  isDownload = false,
}: {
  filename: string;
  courseId: string;
  token: string;
  expiresIn?: number;
  isDownload?: boolean;
}): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // ✅ 1. Validate inputs
    if (!courseId || !filename || !token) {
      return { success: false, error: "معلومات مفقودة" };
    }

    // ✅ 2. Verify authentication
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    // ✅ 3. Get course data
    const courseDoc = await db.collection("courses").doc(courseId).get();

    if (!courseDoc.exists) {
      return { success: false, error: "الدورة غير موجودة" };
    }

    const courseData = courseDoc.data();

    // ✅ 4. Check if user is owner or admin
    const isOwner = courseData?.createdBy === verifiedToken.uid;
    const isAdmin = verifiedToken.admin === true;

    // ✅ 5. Check enrollment - CORRECT FORMAT
    const enrollmentId = `${verifiedToken.uid}_${courseId}`; // ✅ userId_courseId
    const enrollmentDoc = await db
      .collection("enrollments")
      .doc(enrollmentId) // ✅ Use the correct document ID
      .get();

    const isEnrolled = enrollmentDoc.exists; // ✅ Simple existence check

    // ✅ 6. Check if it's a free course
    const isFree = courseData?.price === 0;

    // ✅ 7. Grant access
    const hasAccess = isOwner || isAdmin || isEnrolled || isFree;

    if (!hasAccess) {
      return {
        success: false,
        error: "يجب التسجيل في الدورة للوصول إلى الملفات",
      };
    }

    // ✅ 8. Verify file exists in course
    const fileExists = courseData?.files?.some(
      (file: CourseFile) => file.filename === filename
    );

    if (!fileExists) {
      return { success: false, error: "الملف غير موجود في هذه الدورة" };
    }

    // ✅ 9. Security check
    if (filename.includes("..")) {
      return { success: false, error: "Invalid filename" };
    }

    // ✅ 10. Generate signed URL
    const getObjectCommand = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filename,
      ResponseContentDisposition: isDownload
        ? `attachment; filename="${filename.split("/").pop()}"`
        : undefined,
    });

    const signedUrl = await getSignedUrl(r2Client, getObjectCommand, {
      expiresIn,
    });

    console.log("✅ File access granted");

    return { success: true, url: signedUrl };
  } catch (error) {
    console.error("❌ Failed to generate signed URL:", error);
    return {
      success: false,
      error: "فشل في إنشاء رابط الوصول",
    };
  }
}

/**
 * Convenience function for viewing files
 */
export async function viewCourseFile({
  filename,
  courseId,
  token,
}: {
  filename: string;
  courseId: string;
  token: string;
}) {
  return getFileSignedUrl({
    filename,
    courseId,
    token,
    expiresIn: 3600, // 1 hour for viewing
    isDownload: false,
  });
}

/**
 * Convenience function for downloading files
 */
export async function downloadCourseFile({
  filename,
  courseId,
  token,
}: {
  filename: string;
  courseId: string;
  token: string;
}) {
  return getFileSignedUrl({
    filename,
    courseId,
    token,
    expiresIn: 300, // 5 minutes for download
    isDownload: true,
  });
}
