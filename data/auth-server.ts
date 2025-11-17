import { adminAuth } from "@/firebase/service";

// ✅ Simplified - only takes token since that's what you use
export const getCurrentUser = async ({ token }: { token: string }) => {
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
};
