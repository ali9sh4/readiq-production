import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/firebase/service";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { patchMeBody } from "@/lib/validation/api/me";

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

export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);
    const updates = patchMeBody.parse(await req.json());

    const userRef = db.collection("users").doc(auth.userId);
    const before = await userRef.get();
    if (!before.exists) {
      return fail("PROFILE_NOT_FOUND", "User profile does not exist", 404);
    }

    await userRef.update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const after = await userRef.get();
    const data = after.data()!;

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
