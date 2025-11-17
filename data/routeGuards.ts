// lib/auth/serverAuth.ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth-server";

export async function getServerAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("firebaseAuthToken")?.value;

  if (!token) {
    return { user: null, isAuthenticated: false };
  }

  // ✅ Use YOUR existing getCurrentUser function
  const result = await getCurrentUser({ token });

  if (result.error || !result.user) {
    console.error("Auth error:", result.message);
    return { user: null, isAuthenticated: false };
  }

  return {
    user: {
      uid: result.user.uid,
      email: result.user.email,
      admin: result.isAdmin,
    },
    isAuthenticated: true,
  };
}

export async function requireAuth() {
  const auth = await getServerAuth();

  if (!auth.isAuthenticated) {
    redirect("/login");
  }

  return auth;
}

export async function requireAdmin() {
  const auth = await requireAuth();

  return auth;
}
