import { NextRequest } from "next/server";
import { getCourses } from "@/data/courses";
import { Course } from "@/types/types";
import { handleApiError, ok } from "@/lib/api/response";
import { listCoursesQuery } from "@/lib/validation/api/courses";

// PUBLIC: no Authorization required. Anyone can browse the catalog.
export async function GET(req: NextRequest) {
  try {
    const params = listCoursesQuery.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    );

    // Filter copied verbatim from app/page.tsx:53 + components/publicCoursesCardList.tsx:25.
    // `getCourses` defaults `isDeleted` to false (data/courses.ts:117).
    const result = await getCourses({
      pagination: {
        pageSize: params.limit,
        lastDocId: params.cursor,
      },
      filters: {
        isApproved: true,
        isRejected: false,
        status: "published",
        category: params.category,
        level: params.level,
        language: params.language,
      },
    });

    if (!result.success) {
      // Surface the full upstream failure in dev logs — `getCourses` catches
      // its own errors and only re-exposes a flattened string, so missing-
      // index URLs and other root causes would otherwise vanish. Client
      // response stays generic 500 INTERNAL_ERROR via handleApiError.
      console.error("[api/courses] getCourses failed:", result);
      throw new Error(result.error ?? "Failed to fetch courses");
    }

    const items = result.courses.map(stripCourseForList);

    return ok({
      items,
      nextCursor: result.hasMore ? result.nextCursor : null,
      hasMore: result.hasMore,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

function stripCourseForList(c: Course) {
  return {
    id: c.id,
    title: c.title,
    subtitle: c.subtitle ?? null,
    description: c.description ?? null,
    thumbnailUrl: c.thumbnailUrl ?? null,
    category: c.category,
    level: c.level ?? null,
    language: c.language ?? null,
    instructorName: c.instructorName ?? null,
    price: c.price ?? 0,
    salePrice: c.salePrice ?? null,
    rating: c.rating ?? null,
    ratingCount: c.ratingCount ?? null,
    enrollmentCount: c.enrollmentCount ?? 0,
    duration: c.duration ?? null,
    createdAt: c.createdAt ?? null,
    updatedAt: c.updatedAt ?? null,
  };
}
