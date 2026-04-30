import { NextRequest } from "next/server";
import { db } from "@/firebase/service";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { fail, handleApiError, ok } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);

    const snap = await db.collection("users").doc(auth.userId).get();
    if (!snap.exists) {
      return fail("PROFILE_NOT_FOUND", "User profile does not exist", 404);
    }

    const data = snap.data()!;

    return ok({
      userId: auth.userId,
      email: data.email ?? auth.email,
      displayName: data.displayName ?? null,
      photoURL: data.photoURL ?? null,
      language: data.language ?? "ar",
      notifications: data.notifications ?? true,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
