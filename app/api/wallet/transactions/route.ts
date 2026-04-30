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

    let q = db
      .collection("wallet_transactions")
      .where("userId", "==", auth.userId)
      .orderBy("createdAt", "desc")
      .limit(params.limit + 1);

    if (params.cursor) {
      const cursorDoc = await db
        .collection("wallet_transactions")
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
        type: data.type,
        amount: data.amount,
        balanceBefore: data.balanceBefore,
        balanceAfter: data.balanceAfter,
        description: data.description,
        metadata: data.metadata ?? null,
        createdAt: data.createdAt,
      };
    });

    const nextCursor =
      hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

    return ok({ items, nextCursor, hasMore });
  } catch (err) {
    return handleApiError(err);
  }
}
