"use server";

import { adminAuth } from "@/firebase/service";
import { cookies } from "next/headers";
export const removeToken = async () => {
  const cookieStore = await cookies();
  cookieStore.delete("firebaseAuthToken");
  cookieStore.delete("firebaseAuthRefreshToken");
};

export const setToken = async ({
  token,
  refreshToken,
}: {
  token: string;
  refreshToken: string;
}) => {
  // we need to verify the to ken and check if the user is an admin
  const verifyAuthToken = await adminAuth.verifyIdToken(token);
  if (!verifyAuthToken) {
    return { error: true, message: "Invalid token" };
  }
  const userRecord = await adminAuth.getUser(verifyAuthToken.uid);
  if (
    process.env.FIREBASE_ADMIN_EMAIL === userRecord.email &&
    !userRecord.customClaims?.admin
  ) {
    await adminAuth.setCustomUserClaims(verifyAuthToken.uid, { admin: true });
  }
  const cookieStore = await cookies();
  cookieStore.set("firebaseAuthToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // ADD THIS
    maxAge: 60 * 60, // ADD THIS - 1 hour to match Firebase token expiry
  });
  cookieStore.set("firebaseAuthRefreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // ADD THIS (use 'lax' not 'strict' for OAuth)
    maxAge: 60 * 60 * 24 * 30, // ADD THIS - 30 days
  });
  return {
    success: true,
    isAdmin:
      userRecord.customClaims?.admin ||
      process.env.FIREBASE_ADMIN_EMAIL === userRecord.email,
  };
};
