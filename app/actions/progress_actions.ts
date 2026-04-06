"use server";

import { db, adminAuth } from "@/firebase/service";
import { FieldValue } from "firebase-admin/firestore";

interface VideoProgress {
  videoId: string;
  completed: boolean;
  watchedSeconds: number;
  lastWatchedAt: string;
}

interface CourseProgress {
  courseId: string;
  userId: string;
  videos: VideoProgress[];
  lastAccessedAt: string;
  completionPercentage: number;
}

// ===== SAVE VIDEO PROGRESS =====
export async function saveVideoProgress(
  courseId: string,
  videoId: string,
  watchedSeconds: number,
  completed: boolean,
  token: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication" };
    }

    const userId = verifiedToken.uid;
    const progressRef = db
      .collection("progress")
      .doc(`${userId}_${courseId}`);

    const progressDoc = await progressRef.get();

    if (!progressDoc.exists) {
      // Create new progress document
      const newProgress: CourseProgress = {
        courseId,
        userId,
        videos: [
          {
            videoId,
            completed,
            watchedSeconds,
            lastWatchedAt: new Date().toISOString(),
          },
        ],
        lastAccessedAt: new Date().toISOString(),
        completionPercentage: completed ? 100 : 0,
      };

      await progressRef.set(newProgress);
      return { success: true, progress: newProgress };
    }

    // Update existing progress
    const existingProgress = progressDoc.data() as CourseProgress;
    const videoIndex = existingProgress.videos.findIndex(
      (v) => v.videoId === videoId
    );

    if (videoIndex >= 0) {
      // Update existing video progress
      existingProgress.videos[videoIndex] = {
        videoId,
        completed,
        watchedSeconds: Math.max(
          watchedSeconds,
          existingProgress.videos[videoIndex].watchedSeconds
        ),
        lastWatchedAt: new Date().toISOString(),
      };
    } else {
      // Add new video progress
      existingProgress.videos.push({
        videoId,
        completed,
        watchedSeconds,
        lastWatchedAt: new Date().toISOString(),
      });
    }

    // Calculate completion percentage
    const completedVideos = existingProgress.videos.filter(
      (v) => v.completed
    ).length;
    const totalVideos = existingProgress.videos.length;
    existingProgress.completionPercentage = Math.round(
      (completedVideos / totalVideos) * 100
    );
    existingProgress.lastAccessedAt = new Date().toISOString();

    await progressRef.update({
      videos: existingProgress.videos,
      lastAccessedAt: existingProgress.lastAccessedAt,
      completionPercentage: existingProgress.completionPercentage,
    });

    return { success: true, progress: existingProgress };
  } catch (error) {
    console.error("Error saving progress:", error);
    return { success: false, error: "Failed to save progress" };
  }
}

// ===== GET COURSE PROGRESS =====
export async function getCourseProgress(courseId: string, token: string) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication", progress: null };
    }

    const userId = verifiedToken.uid;
    const progressRef = db
      .collection("progress")
      .doc(`${userId}_${courseId}`);

    const progressDoc = await progressRef.get();

    if (!progressDoc.exists) {
      return { success: true, progress: null };
    }

    const progress = progressDoc.data() as CourseProgress;
    return { success: true, progress };
  } catch (error) {
    console.error("Error getting progress:", error);
    return { success: false, error: "Failed to get progress", progress: null };
  }
}

// ===== GET ALL USER PROGRESS (for dashboard) =====
export async function getAllUserProgress(token: string) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return { success: false, error: "Invalid authentication", progress: [] };
    }

    const userId = verifiedToken.uid;
    const progressSnapshot = await db
      .collection("progress")
      .where("userId", "==", userId)
      .orderBy("lastAccessedAt", "desc")
      .get();

    const progress = progressSnapshot.docs.map((doc) => doc.data() as CourseProgress);

    return { success: true, progress };
  } catch (error) {
    console.error("Error getting all progress:", error);
    return { success: false, error: "Failed to get progress", progress: [] };
  }
}   