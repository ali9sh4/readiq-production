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

    // Package-sourced enrollments carry `sourcePackageId` (set by
    // package_wallet_actions). Batch-resolve the distinct package docs so
    // mobile can label a course tile with the package it came from.
    const packageIds = [
      ...new Set(
        enrollmentDocs
          .map((d) => d.data().sourcePackageId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      ),
    ];
    const packageSnaps = packageIds.length
      ? await db.getAll(
          ...packageIds.map((id) => db.collection("packages").doc(id))
        )
      : [];
    const packageTitleById = new Map(
      packageSnaps
        .filter((s) => s.exists)
        .map((s) => [s.id, (s.data()?.title as string) ?? ""])
    );

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
          // Time-limited access: ISO timestamp after which the playback /
          // study gate denies with ACCESS_EXPIRED. `null` (not omitted) =
          // lifetime access — the key is always present, matching the
          // sourcePackage convention. The mobile client lock must mirror
          // the server gate: expired stamp -> treat the course as locked
          // with a renew affordance, exactly like the web lock screen.
          accessExpiresAt:
            typeof e.accessExpiresAt === "string" ? e.accessExpiresAt : null,
          // `null` (not omitted) for non-package enrollments so mobile can
          // rely on the key always being present.
          sourcePackage: e.sourcePackageId
            ? {
                id: e.sourcePackageId as string,
                title: packageTitleById.get(e.sourcePackageId as string) ?? "",
              }
            : null,
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
