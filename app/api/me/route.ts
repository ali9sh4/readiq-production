import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, db } from "@/firebase/service";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { patchMeBody } from "@/lib/validation/api/me";
import { buildNewUserDocFields } from "@/lib/services/userDoc";

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

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);

    const userRef = db.collection("users").doc(auth.userId);
    const existing = await userRef.get();

    if (!existing.exists) {
      // verifyBearerToken doesn't surface name/picture claims; pull them
      // from the Auth record (same precedent as app/api/wallet/route.ts:17).
      const userRecord = await adminAuth.getUser(auth.userId);
      await userRef.set({
        ...buildNewUserDocFields({
          uid: auth.userId,
          email: userRecord.email ?? auth.email,
          displayName: userRecord.displayName,
          photoURL: userRecord.photoURL,
        }),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Re-get either way: on create, to materialize server timestamps as
    // Firestore Timestamps so the .toDate() chain below resolves; on
    // exists, to keep the projection identical to GET (no doc mutation).
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
