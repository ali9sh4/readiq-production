import { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { evaluateVideoAccess } from "@/lib/courses/videoAccess";
import { signPlaybackToken } from "@/lib/mux/playbackToken";
import { signThumbnailToken } from "@/lib/mux/thumbnailToken";
import { playbackTokenBody } from "@/lib/validation/api/mux";

const TTL_SECONDS = 7200; // 2 hours — mobile play session.

// Per-user rate limit. A real viewer mints one token per video they open —
// a handful per session, occasionally re-minted after the 2h TTL expires.
// 30/min sits far above any legitimate pattern while hard-throttling a
// script that would otherwise mint unlimited tokens and force a Firebase
// verifyIdToken round-trip on every call. Same @upstash/ratelimit pattern
// as wallet_actions.ts — Redis.fromEnv() reads UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN.
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
  prefix: "mux_playback_token",
});

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);

    // Rate-limit per authenticated user, as early as possible after identity
    // is known — before the Firebase course lookups so a throttled request
    // is cheap to reject. Fail OPEN: if the Upstash call itself errors
    // (network blip, Upstash down) we log and allow the request through.
    // Rate limiting here is abuse mitigation, not a hard access gate, and a
    // transient Redis failure must not stop a paying viewer from watching.
    try {
      const { success: rateLimitOk } = await ratelimit.limit(auth.userId);
      if (!rateLimitOk) {
        console.warn(
          `mux-playback RATE_LIMITED userId=${auth.userId}`
        );
        return fail(
          "RATE_LIMITED",
          "Too many playback-token requests. Please slow down.",
          429
        );
      }
    } catch (rlErr) {
      console.error(
        `mux-playback rate-limit check failed (failing open) userId=${auth.userId}:`,
        rlErr
      );
    }

    const body = playbackTokenBody.parse(await req.json());

    // The access predicate lives in lib/courses/videoAccess.ts (§8.1 shared
    // gate — playback, study, and future chat surfaces evaluate the same
    // helper). This route is the free-preview-granting caller; the study
    // surface passes allowFreePreview: false.
    const access = await evaluateVideoAccess({
      userId: auth.userId,
      isAdmin: auth.isAdmin === true,
      courseId: body.courseId,
      videoId: body.videoId,
      allowFreePreview: true,
    });

    if (!access.allowed) {
      // Structured deny logs, preserved verbatim from the pre-refactor
      // route — production debugging greps for these exact patterns.
      if (access.code === "NOT_ENROLLED") {
        console.log(
          `mux-playback DENIED userId=${auth.userId} courseId=${body.courseId} videoId=${body.videoId} reason=${access.logReason}`
        );
      } else if (access.code === "SECTION_NOT_OWNED") {
        console.log(
          `mux-playback DENIED userId=${auth.userId} courseId=${body.courseId} videoId=${body.videoId} sectionId=${access.sectionId} reason=${access.logReason}`
        );
      }
      return fail(access.code, access.message, access.httpStatus);
    }

    if (access.reason === "sectional_untagged_video") {
      // Untagged video on a sectional course — granted per Phase 1 spec.
      // Logged so we can find and tag the video; should not happen for
      // content authored after sectional mode is enabled.
      console.log(
        `mux-playback DIAG userId=${auth.userId} courseId=${body.courseId} videoId=${body.videoId} reason=sectional_video_missing_section_id`
      );
    }

    const { playbackId } = access;
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
    console.log(
      `mux-playback issued userId=${auth.userId} courseId=${body.courseId} videoId=${body.videoId} playbackId=${playbackId} reason=${access.reason} ttl=${TTL_SECONDS}`
    );

    return ok({ playbackId, token, thumbnailToken, expiresAt });
  } catch (err) {
    return handleApiError(err);
  }
}
