"use server";

import mux from "@/lib/mux/mux";
import { adminAuth, db } from "@/firebase/service";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { revalidatePath } from "next/cache";
import { CourseVideo } from "@/types/types";

// ✅ Fixed: Match what you're actually storing

interface VideoUploadData {
  uploadId: string;
  assetId: string;
  playbackId: string;
  duration?: number;
  title: string;
  order?: number;
}

interface SaveCourseVideoParam {
  courseId: string;
  videoData: VideoUploadData[];
  token: string;
}

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "10 m"),
});

export async function createMuxUpload(formData: FormData) {
  try {
    const courseId = formData.get("courseId") as string;
    const title = formData.get("title") as string;
    const token = formData.get("token") as string;

    if (!token) {
      return { success: false, error: "Authentication required" };
    }

    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    const identifier = `video_upload_${verifiedToken.uid}`;
    const { success: rateLimitOk } = await ratelimit.limit(identifier);

    if (!rateLimitOk) {
      return {
        success: false,
        error: "تم تجاوز الحد المسموح به للفيديو. يرجى الانتظار.",
      };
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "Course not found" };
    }

    const courseData = courseDoc.data();
    const canUpload = courseData?.createdBy === verifiedToken.uid;

    if (!canUpload) {
      return { success: false, error: "Permission denied" };
    }

    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        playback_policy: ["public"],
        encoding_tier: "baseline",
      },
      cors_origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    });

    return {
      success: true,
      data: {
        uploadUrl: upload.url,
        uploadId: upload.id,
      },
    };
  } catch (error) {
    console.error("Error creating Mux upload:", error);

    // Detailed logging

    return {
      success: false,
      error: "Failed to create upload URL",
    };
  }
}

export async function getMuxAssetStatus(uploadId: string) {
  try {
    const upload = await mux.video.uploads.retrieve(uploadId);
    if (!upload.asset_id) {
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
      assetId: asset.id,
    };
  } catch (error) {
    console.error("Failed to get asset status:", error);
    return {
      success: false,
      error: "Asset not found",
    };
  }
}

export async function getCourseVideos(courseId: string): Promise<{
  success: boolean;
  videos?: CourseVideo[];
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

    const courseData = courseDoc.data();

    return {
      success: true,
      videos: courseData?.videos || [],
    };
  } catch (error) {
    console.error("Error fetching course videos:", error);
    return {
      success: false,
      error: true,
      message: "حدث خطأ أثناء جلب فيديوهات الدورة",
    };
  }
}

export async function saveCourseVideoToFireStore({
  courseId,
  videoData,
  token,
}: SaveCourseVideoParam) {
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
    const coursePrice = courseData?.price || 0;

    if (courseData?.createdBy !== verifiedToken.uid) {
      return { success: false, error: "Permission denied" };
    }

    // ✅ Ensure it's an array
    let existingVideos: CourseVideo[] = [];
    if (courseData?.videos) {
      existingVideos = Array.isArray(courseData.videos)
        ? courseData.videos
        : [];
    }

    // ✅ Fixed: Use videoId not id
    const currentHighestId =
      existingVideos.length > 0
        ? Math.max(
            ...existingVideos.map(
              (v) => parseInt(v.videoId.replace("video_", "")) || 0
            )
          )
        : 0;
    const currentHighestOrder =
      existingVideos.length > 0
        ? Math.max(...existingVideos.map((v) => v.order || 0))
        : 0;

    // ✅ Create new videos
    const newVideos: CourseVideo[] = videoData.map((video, index) => {
      const videoDoc: any = {
        videoId: `video_${currentHighestId + index + 1}`,
        assetId: video.assetId,
        playbackId: video.playbackId,
        title: video.title,
        originalFilename: video.title, // NEW: Keep original
        description: "", // NEW: Empty by default
        section: "",
        coursePrice: coursePrice, // NEW: Empty by default
        isVisible: true, // NEW: Visible by default
        isFreePreview: false,
        uploadedAt: new Date().toISOString(),
        courseId: courseId,
        order:
          video.order !== undefined
            ? video.order
            : currentHighestOrder + index + 1,
      };

      // Only add duration if it exists
      if (video.duration !== undefined) {
        videoDoc.duration = video.duration;
      }

      return videoDoc;
    });
    const insertOrder = newVideos[0].order;

    const updatedExisting = existingVideos.map((video) => {
      if ((video.order ?? 0) >= (insertOrder ?? 0)) {
        return { ...video, order: (video.order ?? 0) + 1 }; // Shift down
      }
      return video;
    });

    const allVideos = [...updatedExisting, ...newVideos];
    allVideos.sort((a, b) => (a.order || 0) - (b.order || 0));

    await db.collection("courses").doc(courseId).update({
      videos: allVideos,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/course/${courseId}`);

    return { success: true, videos: newVideos };
  } catch (error) {
    console.error("Failed to save video data:", error);
    return {
      success: false,
      error: "Failed to save video data",
    };
  }
}
export async function updateVideoDetails(
  courseId: string,
  videoId: string,
  updates: {
    title?: string;
    description?: string;
    section?: string;
    isVisible?: boolean;
    isFreePreview?: boolean;
  },
  token: string
) {
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

    if (courseData?.createdBy !== verifiedToken.uid) {
      return { success: false, error: "Permission denied" };
    }

    // ✅ Ensure it's an array
    let existingVideos: CourseVideo[] = [];
    if (courseData?.videos) {
      existingVideos = Array.isArray(courseData.videos)
        ? courseData.videos
        : [];
    }

    // ✅ Find and update the specific video
    const videoExists = existingVideos.some((v) => v.videoId === videoId);
    if (!videoExists) {
      return { success: false, error: "Video not found" };
    }

    const updatedVideos = existingVideos.map((video) => {
      if (video.videoId === videoId) {
        return { ...video, ...updates };
      }
      return video;
    });

    await db.collection("courses").doc(courseId).update({
      videos: updatedVideos,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/course/${courseId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update video details:", error);
    return {
      success: false,
      error: "Failed to update video details",
    };
  }
}

export async function deleteCourseVideo(
  courseId: string,
  videoId: string,
  token: string
) {
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

    if (courseData?.createdBy !== verifiedToken.uid) {
      return { success: false, error: "Permission denied" };
    }

    const existingVideos: CourseVideo[] = courseData?.videos || [];

    // ✅ Fixed: Use videoId not id
    const videoToDelete = existingVideos.find((v) => v.videoId === videoId);

    if (!videoToDelete) {
      return { success: false, error: "Video not found" };
    }

    await mux.video.assets.delete(videoToDelete.assetId);

    // ✅ Fixed: Use videoId not id
    const updatedVideos = existingVideos.filter((v) => v.videoId !== videoId);

    await db.collection("courses").doc(courseId).update({
      videos: updatedVideos,
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
export async function reorderCourseVideos(
  courseId: string,
  videoId: string,
  newOrder: number,
  token: string
) {
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
    if (courseData?.createdBy !== verifiedToken.uid) {
      return { success: false, error: "Permission denied" };
    }

    const videos: CourseVideo[] = courseData?.videos || [];
    const videoIndex = videos.findIndex((v) => v.videoId === videoId);
    if (videoIndex === -1) {
      return { success: false, error: "Video not found" };
    }

    // Remove and reinsert
    const [movedVideo] = videos.splice(videoIndex, 1);
    videos.splice(newOrder - 1, 0, movedVideo);

    // Update all orders
    const reorderedVideos = videos.map((video, index) => ({
      ...video,
      order: index + 1,
    }));

    await db.collection("courses").doc(courseId).update({
      videos: reorderedVideos,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/course/${courseId}`);
    return { success: true, videos: reorderedVideos };
  } catch (error) {
    console.error("Failed to reorder videos:", error);
    return { success: false, error: "Failed to reorder videos" };
  }
}
