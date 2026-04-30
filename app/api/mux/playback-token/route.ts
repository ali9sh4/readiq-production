import { NextRequest } from "next/server";
import { db } from "@/firebase/service";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { isCoursePubliclyVisible } from "@/lib/courses/visibility";
import { signPlaybackToken } from "@/lib/mux/playbackToken";
import { playbackTokenBody } from "@/lib/validation/api/mux";

const TTL_SECONDS = 7200; // 2 hours — mobile play session.

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);
    const body = playbackTokenBody.parse(await req.json());

    const courseSnap = await db.collection("courses").doc(body.courseId).get();
    if (!courseSnap.exists) {
      return fail("COURSE_NOT_FOUND", "Course not found", 404);
    }

    const course = courseSnap.data()!;
    if (!isCoursePubliclyVisible(course)) {
      return fail("COURSE_NOT_FOUND", "Course not found", 404);
    }

    const videos = Array.isArray(course.videos)
      ? (course.videos as Array<Record<string, unknown>>)
      : [];
    const video = videos.find((v) => v?.videoId === body.videoId);
    if (!video) {
      return fail("VIDEO_NOT_FOUND", "Video not found in course", 404);
    }

    const playbackId =
      typeof video.playbackId === "string" && video.playbackId.length > 0
        ? video.playbackId
        : null;
    if (!playbackId) {
      return fail(
        "VIDEO_NOT_READY",
        "Video upload has not finished processing",
        409
      );
    }

    const isFreePreview = video.isFreePreview === true;

    if (!isFreePreview) {
      const enrollmentSnap = await db
        .collection("enrollments")
        .doc(`${auth.userId}_${body.courseId}`)
        .get();

      const isEnrolled =
        enrollmentSnap.exists &&
        enrollmentSnap.data()?.status === "completed";

      if (!isEnrolled) {
        return fail(
          "NOT_ENROLLED",
          "You must be enrolled in this course to play this video",
          403
        );
      }
    }

    const token = await signPlaybackToken({
      playbackId,
      ttlSeconds: TTL_SECONDS,
    });
    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

    // Server-side audit log. Never log the token itself.
    console.log(
      `mux-playback issued userId=${auth.userId} courseId=${body.courseId} videoId=${body.videoId} playbackId=${playbackId} ttl=${TTL_SECONDS}`
    );

    return ok({ playbackId, token, expiresAt });
  } catch (err) {
    return handleApiError(err);
  }
}
