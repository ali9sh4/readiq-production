import { NextRequest } from "next/server";
import { adminAuth, db } from "@/firebase/service";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { handleApiError, ok } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);

    const walletRef = db.collection("wallets").doc(auth.userId);
    const snap = await walletRef.get();

    if (!snap.exists) {
      // First read auto-provisions an empty wallet so a freshly registered
      // mobile user sees `balance: 0` instead of a 404. Mirrors the
      // first-time creation in `createTopupRequest`.
      const userRecord = await adminAuth.getUser(auth.userId);
      const initial = {
        userId: auth.userId,
        userName: userRecord.displayName ?? "مستخدم",
        balance: 0,
        totalTopups: 0,
        totalSpent: 0,
        dailyLimit: 5000000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await walletRef.set(initial);
      return ok(initial);
    }

    const data = snap.data()!;
    return ok({
      userId: auth.userId,
      userName: data.userName ?? null,
      balance: data.balance ?? 0,
      totalTopups: data.totalTopups ?? 0,
      totalSpent: data.totalSpent ?? 0,
      totalEarnings: data.totalEarnings ?? 0,
      dailyLimit: data.dailyLimit ?? 5000000,
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
