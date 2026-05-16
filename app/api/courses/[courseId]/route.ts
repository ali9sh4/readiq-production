import { NextRequest } from "next/server";
import { db } from "@/firebase/service";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { isCoursePubliclyVisible } from "@/lib/courses/visibility";

// PUBLIC: no Authorization required.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await ctx.params;

    const snap = await db.collection("courses").doc(courseId).get();
    if (!snap.exists) {
      return fail("COURSE_NOT_FOUND", "Course not found", 404);
    }

    const c = snap.data()!;

    if (!isCoursePubliclyVisible(c)) {
      return fail("COURSE_NOT_FOUND", "Course not found", 404);
    }

    const rawVideos: unknown = c.videos;
    const videos = Array.isArray(rawVideos)
      ? (rawVideos as Array<Record<string, unknown>>)
          .filter((v) => v?.isVisible !== false)
          .sort(
            (a, b) =>
              ((a.order as number | undefined) ?? 0) -
              ((b.order as number | undefined) ?? 0)
          )
          .map((v) => ({
            videoId: v.videoId as string,
            title: (v.title as string) ?? "",
            description: (v.description as string | undefined) ?? null,
            section: (v.section as string | undefined) ?? null,
            // Phase 7a: stable section FK for sectional courses. The legacy
            // `section` string above stays for back-compat; new code should
            // group by `sectionId` (matches the Phase 6a grouping helper).
            sectionId: (v.sectionId as string | undefined) ?? null,
            order: (v.order as number | undefined) ?? null,
            duration: (v.duration as number | undefined) ?? null,
            isFreePreview: v.isFreePreview === true,
            // Only expose playbackId for free-preview videos. For everything
            // else, mobile must call POST /api/mux/playback-token (Step 3).
            playbackId:
              v.isFreePreview === true
                ? ((v.playbackId as string | undefined) ?? null)
                : null,
          }))
      : [];

    return ok({
      id: snap.id,
      title: c.title ?? "",
      subtitle: c.subtitle ?? null,
      description: c.description ?? null,
      thumbnailUrl: c.thumbnailUrl ?? null,
      category: c.category ?? "",
      level: c.level ?? null,
      language: c.language ?? null,
      instructorName: c.instructorName ?? null,
      price: c.price ?? 0,
      salePrice: c.salePrice ?? null,
      // Phase 7a sectional fields. `purchaseMode` is the discriminator —
      // when `"sectional"`, mobile should display `fullCoursePrice` (not
      // the legacy `price`/`salePrice` above) and read `sections[]` for
      // per-section structure/pricing. When `"full"` or unset, the legacy
      // fields are authoritative and these stay null/empty.
      purchaseMode: c.purchaseMode === "sectional" ? "sectional" : "full",
      fullCoursePrice:
        typeof c.fullCoursePrice === "number" ? c.fullCoursePrice : null,
      sections: Array.isArray(c.sections) ? c.sections : [],
      rating: c.rating ?? null,
      ratingCount: c.ratingCount ?? null,
      enrollmentCount: c.enrollmentCount ?? 0,
      duration: c.duration ?? null,
      learningPoints: Array.isArray(c.learningPoints) ? c.learningPoints : [],
      requirements: Array.isArray(c.requirements) ? c.requirements : [],
      videos,
      createdAt: toIso(c.createdAt),
      updatedAt: toIso(c.updatedAt),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof (v as { toDate?: () => Date }).toDate === "function") {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}
