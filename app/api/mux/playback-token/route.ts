import { NextRequest } from "next/server";
import { db } from "@/firebase/service";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { isCoursePubliclyVisible } from "@/lib/courses/visibility";
import { signPlaybackToken } from "@/lib/mux/playbackToken";
import { signThumbnailToken } from "@/lib/mux/thumbnailToken";
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
    const isOwner = course.createdBy === auth.userId;
    const isAdmin = auth.isAdmin === true;
    const isPrivileged = isOwner || isAdmin;

    // Visibility gate applies to the student / free-preview path only.
    // Owners must be able to preview their own drafts; admins must be able
    // to review pending / unapproved courses. Both still require the course
    // doc to exist (the !courseSnap.exists check above), so this does not
    // leak unrelated course state to non-privileged callers.
    if (!isPrivileged && !isCoursePubliclyVisible(course)) {
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

    // Sectional-purchasing gate. Owner / admin / free-preview keep the
    // existing bypass. Everything else must hold a completed enrollment;
    // for courses with `purchaseMode === 'sectional'` we additionally
    // verify the *specific* section the video belongs to is owned, unless
    // the enrollment has `accessScope` unset (legacy) or set to `'full'`
    // (bundle buyer) — both grant the whole course.
    //
    // Discriminator rule (Phase 2, locked): sectional logic activates *only*
    // when `course.purchaseMode === 'sectional'`. The presence of
    // `course.sections[]` does NOT mean sectional — the Phase 1 backfill
    // populated `sections[]` on every multi-section course in the catalog,
    // none of which are sectional yet. Reading the array's length as the
    // discriminator would silently lock the entire catalog.
    //
    // Sub-reason emitted on the grant log (sectional path only), one of:
    //   sectional_legacy_full     — accessScope unset; legacy student on a
    //                               course that was later flipped sectional
    //   sectional_bundle          — accessScope === 'full'; bundle buyer
    //   sectional_owned_section   — accessScope === 'sectional' and the
    //                               video's sectionId is in ownedSectionIds
    //   sectional_untagged_video  — sectional course, sectional enrollment,
    //                               but the video has no sectionId. Grants
    //                               per Phase 1 spec; logged so we can find
    //                               and tag the video.
    let sectionalGrantSubReason: string | null = null;
    if (!isPrivileged && !isFreePreview) {
      const enrollmentSnap = await db
        .collection("enrollments")
        .doc(`${auth.userId}_${body.courseId}`)
        .get();

      const enrollment = enrollmentSnap.exists ? enrollmentSnap.data() : null;
      const isEnrolled = enrollment?.status === "completed";

      if (!isEnrolled) {
        // Two distinct denial reasons share the NOT_ENROLLED response code
        // (the API contract stays stable) but emit different structured
        // logs so production can tell "user never enrolled" from "purchase
        // in flight, enrollment doc exists but not yet completed".
        if (!enrollmentSnap.exists) {
          console.log(
            `mux-playback DENIED userId=${auth.userId} courseId=${body.courseId} videoId=${body.videoId} reason=not_enrolled_no_doc`
          );
        } else {
          const actualStatus =
            typeof enrollment?.status === "string"
              ? enrollment.status
              : "unknown";
          console.log(
            `mux-playback DENIED userId=${auth.userId} courseId=${body.courseId} videoId=${body.videoId} reason=not_enrolled_status_${actualStatus}`
          );
        }
        return fail(
          "NOT_ENROLLED",
          "You must be enrolled in this course to play this video",
          403
        );
      }

      // Default `purchaseMode` to 'full' explicitly so an undefined value
      // never accidentally satisfies a `=== 'sectional'` check.
      const purchaseMode: "full" | "sectional" =
        course.purchaseMode === "sectional" ? "sectional" : "full";

      if (purchaseMode === "sectional") {
        const rawAccessScope = enrollment?.accessScope;

        if (rawAccessScope !== "sectional") {
          // Either accessScope is unset (legacy enrollment on a course
          // later flipped to sectional) or explicitly 'full' (bundle
          // buyer). Both grant the whole course; the distinction is for
          // log diagnostics only.
          sectionalGrantSubReason =
            rawAccessScope === "full"
              ? "sectional_bundle"
              : "sectional_legacy_full";
        } else {
          // Genuine sectional enrollment — must own the section.
          const videoSectionId =
            typeof video.sectionId === "string" && video.sectionId.length > 0
              ? video.sectionId
              : null;

          if (videoSectionId === null) {
            // Untagged video on a sectional course — Phase 1 spec keeps
            // these accessible. Log for diagnostics; this should not happen
            // for content authored after sectional mode is enabled.
            sectionalGrantSubReason = "sectional_untagged_video";
            console.log(
              `mux-playback DIAG userId=${auth.userId} courseId=${body.courseId} videoId=${body.videoId} reason=sectional_video_missing_section_id`
            );
          } else {
            const owned = Array.isArray(enrollment?.ownedSectionIds)
              ? (enrollment!.ownedSectionIds as string[])
              : [];
            if (!owned.includes(videoSectionId)) {
              console.log(
                `mux-playback DENIED userId=${auth.userId} courseId=${body.courseId} videoId=${body.videoId} sectionId=${videoSectionId} reason=sectional_section_not_owned`
              );
              return fail(
                "SECTION_NOT_OWNED",
                "You have not purchased this section of the course",
                403
              );
            }
            sectionalGrantSubReason = "sectional_owned_section";
          }
        }
      }
    }

    const [token, thumbnailToken] = await Promise.all([
      signPlaybackToken({ playbackId, ttlSeconds: TTL_SECONDS }),
      signThumbnailToken({ playbackId, ttlSeconds: TTL_SECONDS }),
    ]);
    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

    // Server-side audit log. Never log the token itself. The reason field
    // makes "why was this token issued" greppable in production logs —
    // important for chasing down "owner accidentally got served the
    // unenrolled-student error" or vice-versa during the 3.5 rollout.
    // For sectional grants, the sub-reason explains *which* sectional path
    // allowed the grant (bundle / legacy-full / owned-section / untagged).
    const accessReason = isOwner
      ? "owner"
      : isAdmin
        ? "admin"
        : isFreePreview
          ? "free-preview"
          : sectionalGrantSubReason ?? "enrolled";
    console.log(
      `mux-playback issued userId=${auth.userId} courseId=${body.courseId} videoId=${body.videoId} playbackId=${playbackId} reason=${accessReason} ttl=${TTL_SECONDS}`
    );

    return ok({ playbackId, token, thumbnailToken, expiresAt });
  } catch (err) {
    return handleApiError(err);
  }
}
