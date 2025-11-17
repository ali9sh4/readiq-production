 import { adminAuth } from "@/firebase/service";

// ✅ Consistent return structure - always includes success field
export const getCurrentUser = async ({ token }: { token: string }) => {
  try {
    const verifyAuthToken = await adminAuth.verifyIdToken(token);
    if (!verifyAuthToken) {
      return {
        success: false,
        user: null,
        isAdmin: false,
        message: "please login first",
      };
    }

    const userRecord = await adminAuth.getUser(verifyAuthToken.uid);
    if (!userRecord) {
      return {
        success: false,
        user: null,
        isAdmin: false,
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
      success: false,
      user: null,
      isAdmin: false,
      message: "Authentication failed",
    };
  }
};