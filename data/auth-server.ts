import { cache } from "react";
import { adminAuth } from "@/firebase/service";

// ✅ Simplified - only takes token since that's what you use
//
// Wrapped in React cache() so that when both a layout and its page (or two
// components in one render) call getCurrentUser with the same token, the two
// Firebase-Auth round-trips below run once per request instead of repeating.
// Auth semantics are unchanged: the token is still verified with
// verifyIdToken, and the live user record is still read with getUser. The two
// calls are a genuine dependency (getUser needs the uid the verify step
// returns), so they stay sequential — only cross-call de-duplication is added.
export const getCurrentUser = cache(async ({ token }: { token: string }) => {
  try {
    const verifyAuthToken = await adminAuth.verifyIdToken(token);
    if (!verifyAuthToken) {
      return {
        error: true,
        message: "please login first",
      };
    }

    const userRecord = await adminAuth.getUser(verifyAuthToken.uid);
    if (!userRecord) {
      return {
        error: true,
        message: "user not found",
      };
    }

    return {
      success: true,
      user: userRecord,
      isAdmin:
        userRecord.customClaims?.admin ||
        process.env.FIREBASE_ADMIN_EMAIL === userRecord.email,
    };
  } catch (error) {
    console.error("getCurrentUser error:", error);
    return {
      error: true,
      message: "Authentication failed",
    };
  }
});
