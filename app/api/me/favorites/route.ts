import { NextRequest } from "next/server";
import { db } from "@/firebase/service";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { paginationQuery } from "@/lib/validation/api/pagination";
import { addFavoriteBody } from "@/lib/validation/api/favorites";
import { isCoursePubliclyVisible } from "@/lib/courses/visibility";
import { addToFavorites } from "@/app/actions/favorites_actions";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);
    const params = paginationQuery.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    );

    // Same query pattern as `getUserFavorites` server action.
    let q = db
      .collection("favorites")
      .where("userId", "==", auth.userId)
      .orderBy("createdAt", "desc")
      .limit(params.limit + 1);

    if (params.cursor) {
      const cursorDoc = await db
        .collection("favorites")
        .doc(params.cursor)
        .get();
      if (cursorDoc.exists) {
        q = q.startAfter(cursorDoc);
      }
    }

    const snap = await q.get();
    const favDocs = snap.docs.slice(0, params.limit);
    const hasMore = snap.docs.length > params.limit;

    if (favDocs.length === 0) {
      return ok({ items: [], nextCursor: null, hasMore: false });
    }

    const courseRefs = favDocs.map((d) =>
      db.collection("courses").doc(d.data().courseId)
    );
    const courseSnaps = await db.getAll(...courseRefs);

    const items = courseSnaps
      .map((s) => {
        if (!s.exists) return null;
        const c = s.data()!;
        if (c.isDeleted === true) return null;

        return {
          id: s.id,
          title: c.title ?? "",
          subtitle: c.subtitle ?? null,
          thumbnailUrl: c.thumbnailUrl ?? null,
          instructorName: c.instructorName ?? null,
          category: c.category ?? "",
          level: c.level ?? null,
          language: c.language ?? null,
          price: c.price ?? 0,
          salePrice: c.salePrice ?? null,
          rating: c.rating ?? null,
          ratingCount: c.ratingCount ?? null,
          enrollmentCount: c.enrollmentCount ?? 0,
        };
      })
      .filter(<T>(x: T | null): x is T => x !== null);

    const nextCursor =
      hasMore && favDocs.length > 0 ? favDocs[favDocs.length - 1].id : null;

    return ok({ items, nextCursor, hasMore });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);
    const body = addFavoriteBody.parse(await req.json());

    // Visibility gate before write so a hidden / soft-deleted / unapproved
    // course can't be silently favorited.
    const courseSnap = await db
      .collection("courses")
      .doc(body.courseId)
      .get();
    if (!courseSnap.exists || !isCoursePubliclyVisible(courseSnap.data()!)) {
      return fail("COURSE_NOT_FOUND", "Course not found", 404);
    }

    const result = await addToFavorites(auth.token, body.courseId);
    if (!result.success) {
      console.error(
        "[api/me/favorites POST] addToFavorites failed:",
        result
      );
      throw new Error(result.error ?? "Failed to add favorite");
    }

    return ok({
      courseId: body.courseId,
      addedAt: new Date().toISOString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
