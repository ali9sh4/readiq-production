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

    // NOTE: requires composite index on topup_requests (userId ASC, createdAt DESC).
    // First call from a clean Firebase project will fail with an index-creation
    // URL in server logs — click it once.
    let q = db
      .collection("topup_requests")
      .where("userId", "==", auth.userId)
      .orderBy("createdAt", "desc")
      .limit(params.limit + 1);

    if (params.cursor) {
      const cursorDoc = await db
        .collection("topup_requests")
        .doc(params.cursor)
        .get();
      if (cursorDoc.exists) {
        q = q.startAfter(cursorDoc);
      }
    }

    const snap = await q.get();
    const docs = snap.docs.slice(0, params.limit);
    const hasMore = snap.docs.length > params.limit;

    const items = docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        amount: data.amount,
        status: data.status,
        // paymentMethod and receiptUrl are added by the new mobile flow in step 5.
        // Old web-created docs predate them — return null so clients have a
        // stable shape.
        paymentMethod: data.paymentMethod ?? null,
        receiptUrl: data.receiptUrl ?? null,
        senderName: data.senderName ?? null,
        rejectionReason: data.rejectionReason ?? null,
        adminNotes: data.adminNotes ?? null,
        createdAt: data.createdAt,
        processedAt: data.processedAt ?? null,
        expiresAt: data.expiresAt ?? null,
      };
    });

    const nextCursor =
      hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

    return ok({ items, nextCursor, hasMore });
  } catch (err) {
    return handleApiError(err);
  }
}
