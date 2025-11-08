import { adminAuth } from "@/firebase/service";

export async function verifyAdmin(token: string) {
  const verifiedToken = await adminAuth.verifyIdToken(token);
  const user = await adminAuth.getUser(verifiedToken.uid);
  return (
    user.customClaims?.admin || process.env.FIREBASE_ADMIN_EMAIL === user.email
  );
}
