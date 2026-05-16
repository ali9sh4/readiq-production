import { NextRequest } from "next/server";
import { db } from "@/firebase/service";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { handleApiError, ok } from "@/lib/api/response";
import { paginationQuery } from "@/lib/validation/api/pagination";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);
    const params = paginationQuery.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    );

    // NOTE: requires composite index on
    // enrollments (userId ASC, status ASC, enrolledAt DESC). Firebase
    // surfaces a one-click create URL in server logs on first failure.
    let q = db
      .collection("enrollments")
      .where("userId", "==", auth.userId)
      .where("status", "==", "completed")
      .orderBy("enrolledAt", "desc")
      .limit(params.limit + 1);

    if (params.cursor) {
      const cursorDoc = await db
        .collection("enrollments")
        .doc(params.cursor)
        .get();
      if (cursorDoc.exists) {
        q = q.startAfter(cursorDoc);
      }
    }

    const snap = await q.get();
    const enrollmentDocs = snap.docs.slice(0, params.limit);
    const hasMore = snap.docs.length > params.limit;

    if (enrollmentDocs.length === 0) {
      return ok({ items: [], nextCursor: null, hasMore: false });
    }

    const courseRefs = enrollmentDocs.map((d) =>
      db.collection("courses").doc(d.data().courseId)
    );
    const courseSnaps = await db.getAll(...courseRefs);

    const items = enrollmentDocs
      .map((eDoc, i) => {
        const courseSnap = courseSnaps[i];
        if (!courseSnap.exists) return null;

        const c = courseSnap.data()!;
        if (c.isDeleted === true) return null;

        const e = eDoc.data();
        return {
          enrollmentId: eDoc.id,
          courseId: courseSnap.id,
          enrolledAt: e.enrolledAt ?? e.createdAt ?? null,
          // Phase 7a sectional fields. `accessScope` defaults to `"full"`
          // when unset — matches the Phase 2.5 grandfathered rule and the
          // Mux gate's "sectional_legacy_full" fallback. Mobile can treat
          // `"full"` and unset identically (saves a null check); only
          // `"sectional"` requires consulting `ownedSectionIds`.
          status: e.status ?? null,
          accessScope: e.accessScope === "sectional" ? "sectional" : "full",
          ownedSectionIds: Array.isArray(e.ownedSectionIds)
            ? (e.ownedSectionIds as string[])
            : [],
          totalSpent: typeof e.totalSpent === "number" ? e.totalSpent : 0,
          course: {
            id: courseSnap.id,
            title: c.title ?? "",
            thumbnailUrl: c.thumbnailUrl ?? null,
            instructorName: c.instructorName ?? null,
            language: c.language ?? null,
            // Embedded course summary needs `purchaseMode` so mobile can
            // render the right price on the "my courses" tile without
            // round-tripping for the course detail.
            purchaseMode:
              c.purchaseMode === "sectional" ? "sectional" : "full",
            fullCoursePrice:
              typeof c.fullCoursePrice === "number" ? c.fullCoursePrice : null,
          },
        };
      })
      .filter(<T>(x: T | null): x is T => x !== null);

    const nextCursor =
      hasMore && enrollmentDocs.length > 0
        ? enrollmentDocs[enrollmentDocs.length - 1].id
        : null;

    return ok({ items, nextCursor, hasMore });
  } catch (err) {
    return handleApiError(err);
  }
}
