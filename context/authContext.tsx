"use client";
import { auth } from "@/firebase/client";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  User,
  ParsedToken,
  signInWithEmailAndPassword,
} from "firebase/auth";
import React, { useContext, useEffect, createContext, useState } from "react";

import { removeToken, setToken } from "./actions";
import { createOrUpdateUser } from "@/lib/services/userService";
import { useRouter } from "next/navigation"; // ✅ Changed from "next/router"

// Sign-in resilience for flaky networks: if the popup makes no progress within
// this window we assume it's dead (blocked popup, blackholed Google endpoints)
// and fall back to the full-page redirect flow. Users actively typing in a
// healthy popup normally finish the account-chooser step well under this.
const POPUP_TIMEOUT_MS = 15000;
// Set before signInWithRedirect so that, on return, we know a redirect flow is
// pending and can show a "completing sign-in" state while getRedirectResult runs.
const REDIRECT_PENDING_KEY = "rubik:pendingAuthRedirect";
// Where to send the user after a successful sign-in (survives the full-page
// redirect flow, which loses the /login?redirect= query on some paths).
const POST_LOGIN_REDIRECT_KEY = "rubik:postLoginRedirect";

// Only same-site absolute paths are allowed as post-login destinations —
// anything else (external URLs, protocol-relative //host, /api/*) falls back
// to the caller's default.
export const sanitizeRedirectPath = (
  raw: string | null | undefined
): string | null => {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/api"))
    return null;
  return raw;
};

export type SignInPhase = "idle" | "popup" | "redirect-fallback";

const AuthContext = createContext<AuthContextType | null>(null);

type AuthContextType = {
  user: User | null;
  handleGoogleSignIn: () => Promise<boolean>; // ✅ Now returns boolean
  logOut: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  CustomClaims: ParsedToken | null;
  isClient: boolean;
  isAdmin: boolean;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  /** Where the Google sign-in flow currently is (for button UI). */
  signInPhase: SignInPhase;
  /** True while getRedirectResult is resolving after returning from the redirect flow. */
  redirectResolving: boolean;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [CustomClaims, setCustomClaims] = useState<ParsedToken | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signInPhase, setSignInPhase] = useState<SignInPhase>("idle");
  const [redirectResolving, setRedirectResolving] = useState(false);
  const router = useRouter(); // ✅ Hook inside component

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Returning from the signInWithRedirect fallback: resolve the redirect
  // result so errors surface instead of leaving the user on a silent login
  // page. Only runs when we initiated a redirect (flag set below), so normal
  // page loads pay nothing.
  useEffect(() => {
    if (!isClient) return;
    if (sessionStorage.getItem(REDIRECT_PENDING_KEY) !== "1") return;

    setRedirectResolving(true);
    getRedirectResult(auth)
      .then((result) => {
        if (!result?.user && !auth.currentUser) {
          // Redirect round-trip finished without a session (e.g. third-party
          // storage partitioning on cross-origin authDomain, or user backed out).
          setError("لم يكتمل تسجيل الدخول. حاول مرة أخرى.");
        }
      })
      .catch((err) => {
        console.error("Redirect sign-in failed:", err);
        setError("تعذّر إكمال تسجيل الدخول. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.");
      })
      .finally(() => {
        sessionStorage.removeItem(REDIRECT_PENDING_KEY);
        setRedirectResolving(false);
      });
  }, [isClient]);

  // Check token expiration and refresh if needed
  useEffect(() => {
    if (!user) return;

    const checkAndRefreshToken = async () => {
      try {
        const tokenResult = await user.getIdTokenResult();
        const expirationTime = new Date(tokenResult.expirationTime).getTime();
        const now = Date.now();

        if (expirationTime - now < 5 * 60 * 1000) {
          const newToken = await user.getIdToken(true);
          const newTokenResult = await user.getIdTokenResult();
          setCustomClaims(newTokenResult.claims);
          setIsAdmin(newTokenResult.claims.admin === true);
          await setToken({
            token: newToken,
            refreshToken: user.refreshToken,
          });
        }
      } catch (error) {
        console.error("Token refresh failed:", error);
      }
    };

    const interval = setInterval(checkAndRefreshToken, 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // ✅ Consolidated auth state change handler with redirect logic
  useEffect(() => {
    if (!isClient) return;

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          await createOrUpdateUser(currentUser);
        } catch (error) {
          console.error("Failed to sync user with Firestore:", error);
        }

        const tokenResult = await currentUser.getIdTokenResult();
        const token = tokenResult.token;
        const refreshToken = currentUser.refreshToken;
        const claims = tokenResult.claims;
        setCustomClaims(claims);
        setIsAdmin(claims.admin === true); // ✅ Set isAdmin here too

        if (token && refreshToken) {
          await setToken({ token, refreshToken });
        }

        // ✅ Leave the auth pages after sign-in. Honor the intended
        // destination (?redirect= from ProtectedLink/middleware, or the
        // sessionStorage copy that survives the signInWithRedirect fallback).
        // This runs after setToken above, so the cookie middleware checks is
        // already in place when we land on a protected route.
        const pathname = window.location.pathname;
        if (pathname === "/login" || pathname === "/register") {
          const params = new URLSearchParams(window.location.search);
          const destination =
            sanitizeRedirectPath(params.get("redirect")) ??
            sanitizeRedirectPath(
              sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)
            ) ??
            "/";
          sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
          router.push(destination);
        }
      } else {
        await removeToken();
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isClient, router]);

  // Fallback for when the popup flow is unusable (blocked popup, blackholed
  // Google endpoints, timeout): full-page signInWithRedirect. Stashes the
  // intended destination first because the round-trip replaces the page.
  const fallbackToRedirect = async (
    provider: GoogleAuthProvider
  ): Promise<boolean> => {
    // The timed-out popup may still have completed in the background —
    // don't yank the page away from an already-signed-in user.
    if (auth.currentUser) return true;

    setSignInPhase("redirect-fallback");
    try {
      const params = new URLSearchParams(window.location.search);
      const destination = sanitizeRedirectPath(params.get("redirect"));
      if (destination) {
        sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, destination);
      }
      sessionStorage.setItem(REDIRECT_PENDING_KEY, "1");
      await signInWithRedirect(auth, provider);
      return false; // unreachable — the browser navigates away
    } catch (err) {
      console.error("Redirect fallback failed:", err);
      sessionStorage.removeItem(REDIRECT_PENDING_KEY);
      setSignInPhase("idle");
      setError(
        "تعذّر تسجيل الدخول. تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى."
      );
      return false;
    }
  };

  const handleGoogleSignIn = async (): Promise<boolean> => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: "select_account",
    });

    try {
      setIsLoading(true);
      setError(null);
      setSignInPhase("popup");

      const result = await Promise.race([
        signInWithPopup(auth, provider),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject({ code: "app/popup-timeout" }),
            POPUP_TIMEOUT_MS
          )
        ),
      ]);

      console.log("Sign-in successful:", result.user.email);
      setSignInPhase("idle");
      return true; // ✅ Return success
    } catch (error: any) {
      console.error("Full error object:", error);
      const errorCode = error?.code;
      if (
        errorCode === "auth/popup-closed-by-user" ||
        errorCode === "auth/cancelled-popup-request"
      ) {
        // User cancelled — back to idle, no error and no redirect fallback.
        console.log("User closed the popup");
        setSignInPhase("idle");
        return false;
      }

      // Anything else means the popup path is broken for this session
      // (auth/popup-blocked, auth/network-request-failed, our own timeout,
      // internal errors) → automatically fall back to the redirect flow.
      return await fallbackToRedirect(provider);
    } finally {
      setIsLoading(false);
    }
  };

  const logOut = async () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (!confirmLogout) {
      return;
    }
    try {
      await auth.signOut();
      setUser(null);
      setCustomClaims(null);
    } catch (error) {
      console.error("Error logging out:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred while logging out");
      }
    }
  };
  const loginWithEmail = async (
    email: string,
    password: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error: any) {
      console.error("Email login error:", error);
      const errorCode = error?.code;
      if (
        errorCode === "auth/invalid-credential" ||
        errorCode === "auth/user-not-found"
      ) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      } else if (errorCode === "auth/too-many-requests") {
        setError("محاولات كثيرة جداً. حاول لاحقاً");
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred");
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isClient,
        user,
        handleGoogleSignIn,
        isLoading,
        error,
        logOut,
        CustomClaims,
        isAdmin,
        loginWithEmail,
        signInPhase,
        redirectResolving,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
