"use server";

import mux from "@/lib/mux/mux";
import { adminAuth, db } from "@/firebase/service";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { revalidatePath } from "next/cache";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "10 m"), // 5 video uploads per 10 minutes
});

export async function createMuxUpload(formData: FormData) {
  try {
    // 1. Extract inputs (same as your files)
    const courseId = formData.get("courseId") as string;
    const title = formData.get("title") as string;
    const token = formData.get("token") as string;

    // 2. Basic validation (same pattern)
    if (!token) {
      return { success: false, error: "Authentication required" };
    }

    // 3. Verify authentication (exact same)
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    // 4. Rate limiting (same pattern)
    const identifier = `video_upload_${verifiedToken.uid}`;
    const { success: rateLimitOk } = await ratelimit.limit(identifier);

    if (!rateLimitOk) {
      return {
        success: false,
        error: "تم تجاوز الحد المسموح به للفيديو. يرجى الانتظار.",
      };
    }

    // 5. Course ownership check (same as your delete function)
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();
    const canUpload = courseData?.createdBy === verifiedToken.uid;

    if (!canUpload) {
      return { success: false, error: "Permission denied" };
    }

    // 6. Create Mux upload (instead of R2)
    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        playback_policy: ["public"],
        encoding_tier: "baseline",
      },
      cors_origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    });

    // 7. Return same format as your files
    return {
      success: true,
      data: {
        uploadUrl: upload.url,
        uploadId: upload.id,
      },
    };
  } catch (error) {
    console.error("Mux upload creation failed:", error);
    return {
      success: false,
      error: "Failed to create upload URL",
    };
  }
}

// ADD THESE MISSING FUNCTIONS:

export async function getMuxAssetStatus(uploadId: string) {
  try {
    const upload = await mux.video.uploads.retrieve(uploadId);
    if (!upload.asset_id) {
      // Asset not yet created, still processing
      return {
        success: true,
        status: "processing",
      };
    }
    const asset = await mux.video.assets.retrieve(upload.asset_id);

    return {
      success: true,
      status: asset.status,
      playbackId: asset.playback_ids?.[0]?.id,
      duration: asset.duration,
      assetId: asset.id, // Add this so you have the real asset ID
    };
  } catch (error) {
    console.error("Failed to get asset status:", error);
    return {
      success: false,
      error: "Asset not found",
    };
  }
}

export async function saveCourseVideo(
  courseId: string,
  videoData: {
    uploadId: string;
    assetId: string;
    playbackId: string;
    duration?: number;
    title: string;
  },
  token: string
) {
  try {
    // 1. Verify authentication (same pattern as your files)
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    // 2. Course ownership check
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();
    const canUpdate = courseData?.createdBy === verifiedToken.uid;

    if (!canUpdate) {
      return { success: false, error: "Permission denied" };
    }

    // 3. Save video data to course document (same as your files)
    await db
      .collection("courses")
      .doc(courseId)
      .update({
        video: {
          uploadId: videoData.uploadId,
          assetId: videoData.assetId,
          playbackId: videoData.playbackId,
          duration: videoData.duration,
          title: videoData.title,
          uploadedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      });

    // 4. Revalidate path (same as your files)
    revalidatePath(`/course/${courseId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to save video data:", error);
    return {
      success: false,
      error: "Failed to save video data",
    };
  }
}

export async function deleteCourseVideo(
  courseId: string,
  assetId: string,
  token: string
) {
  try {
    // 1. Verify authentication (same pattern)
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    // 2. Course ownership check
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();
    const canDelete = courseData?.createdBy === verifiedToken.uid;

    if (!canDelete) {
      return { success: false, error: "Permission denied" };
    }

    // 3. Delete from Mux
    await mux.video.assets.delete(assetId);

    // 4. Remove from database
    await db.collection("courses").doc(courseId).update({
      video: null,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/course/${courseId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete video:", error);
    return {
      success: false,
      error: "Failed to delete video",
    };
  }
}
