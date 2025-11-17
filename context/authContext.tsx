"use client";
import { auth } from "@/firebase/client";
import {
  GoogleAuthProvider,
  signInWithPopup,
  User,
  ParsedToken,
} from "firebase/auth";
import React, { useContext, useEffect, createContext, useState } from "react";

import { removeToken, setToken } from "./actions";
import { createOrUpdateUser } from "@/lib/services/userService";
import { useRouter } from "next/navigation";

const AuthContext = createContext<AuthContextType | null>(null);

type AuthContextType = {
  user: User | null;
  handleGoogleSignIn: () => Promise<boolean>;
  logOut: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  CustomClaims: ParsedToken | null;
  isClient: boolean;
  isAdmin: boolean;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [CustomClaims, setCustomClaims] = useState<ParsedToken | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    console.log("[AuthContext] Client-side initialized");
    setIsClient(true);
  }, []);

  // Check token expiration and refresh if needed
  useEffect(() => {
    if (!user) {
      console.log("[AuthContext] No user, skipping token refresh");
      return;
    }

    console.log("[AuthContext] Setting up token refresh interval");

    const checkAndRefreshToken = async () => {
      try {
        console.log("[AuthContext] Checking token expiration...");
        const tokenResult = await user.getIdTokenResult();
        const expirationTime = new Date(tokenResult.expirationTime).getTime();
        const now = Date.now();
        const timeUntilExpiry = expirationTime - now;

        console.log("[AuthContext] Token expiry check:", {
          expiresIn: `${Math.floor(timeUntilExpiry / 1000 / 60)} minutes`,
          needsRefresh: timeUntilExpiry < 5 * 60 * 1000,
        });

        if (timeUntilExpiry < 5 * 60 * 1000) {
          console.log("[AuthContext] Refreshing token...");
          const newToken = await user.getIdToken(true);
          const newTokenResult = await user.getIdTokenResult();

          console.log("[AuthContext] Token refreshed, new claims:", {
            hasAdmin: !!newTokenResult.claims.admin,
            admin: newTokenResult.claims.admin,
          });

          setCustomClaims(newTokenResult.claims);
          setIsAdmin(newTokenResult.claims.admin === true);
          await setToken({
            token: newToken,
            refreshToken: user.refreshToken,
          });
          console.log("[AuthContext] Token refresh complete");
        }
      } catch (error) {
        console.error("[AuthContext] Token refresh failed:", error);
        console.error("[AuthContext] Refresh error details:", {
          name: error instanceof Error ? error.name : "Unknown",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    };

    const interval = setInterval(checkAndRefreshToken, 60 * 1000);
    return () => {
      console.log("[AuthContext] Clearing token refresh interval");
      clearInterval(interval);
    };
  }, [user]);

  // Consolidated auth state change handler with redirect logic
  useEffect(() => {
    if (!isClient) {
      console.log("[AuthContext] Not client-side yet, skipping auth listener");
      return;
    }

    console.log("[AuthContext] Setting up auth state listener");

    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      console.log("[AuthContext] Auth state changed:", {
        hasUser: !!currentUser,
        email: currentUser?.email,
        uid: currentUser?.uid,
        pathname:
          typeof window !== "undefined" ? window.location.pathname : "SSR",
      });

      setUser(currentUser);

      if (currentUser) {
        try {
          console.log("[AuthContext] Syncing user with Firestore...");
          await createOrUpdateUser(currentUser);
          console.log("[AuthContext] User synced successfully");
        } catch (error) {
          console.error(
            "[AuthContext] Failed to sync user with Firestore:",
            error
          );
          console.error("[AuthContext] Firestore sync error details:", {
            name: error instanceof Error ? error.name : "Unknown",
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            code: (error as any)?.code,
          });
        }

        try {
          console.log("[AuthContext] Getting token result...");
          const tokenResult = await currentUser.getIdTokenResult();
          const token = tokenResult.token;
          const refreshToken = currentUser.refreshToken;
          const claims = tokenResult.claims;

          console.log("[AuthContext] Token obtained successfully");
          console.log("[AuthContext] Token claims:", {
            hasAdmin: !!claims.admin,
            admin: claims.admin,
            claimKeys: Object.keys(claims),
            tokenLength: token.length,
          });

          setCustomClaims(claims);
          setIsAdmin(claims.admin === true);

          if (token && refreshToken) {
            console.log("[AuthContext] Setting tokens in cookies...");
            await setToken({ token, refreshToken });
            console.log("[AuthContext] Tokens set successfully");
          } else {
            console.warn("[AuthContext] Missing token or refreshToken:", {
              hasToken: !!token,
              hasRefreshToken: !!refreshToken,
            });
          }

          // Redirect to home if on login page
          if (
            typeof window !== "undefined" &&
            window.location.pathname === "/login"
          ) {
            console.log(
              "[AuthContext] User authenticated on login page, redirecting to home..."
            );
            router.push("/");
          }
        } catch (error) {
          console.error("[AuthContext] Error processing token:", error);
          console.error("[AuthContext] Token error details:", {
            name: error instanceof Error ? error.name : "Unknown",
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            code: (error as any)?.code,
          });
        }
      } else {
        console.log("[AuthContext] No user, removing tokens...");
        try {
          await removeToken();
          console.log("[AuthContext] Tokens removed successfully");
        } catch (error) {
          console.error("[AuthContext] Error removing tokens:", error);
        }
      }

      console.log("[AuthContext] Setting isLoading to false");
      setIsLoading(false);
    });

    return () => {
      console.log("[AuthContext] Cleaning up auth listener");
      unsubscribe();
    };
  }, [isClient, router]);

  const handleGoogleSignIn = async (): Promise<boolean> => {
    console.log("[AuthContext] Google sign-in initiated");
    try {
      setIsLoading(true);
      setError(null);

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });

      console.log("[AuthContext] Opening Google sign-in popup...");
      const result = await signInWithPopup(auth, provider);

      console.log("[AuthContext] Sign-in successful:", {
        email: result.user.email,
        uid: result.user.uid,
        displayName: result.user.displayName,
      });

      return true;
    } catch (error) {
      console.error("[AuthContext] Sign-in failed");
      console.error("[AuthContext] Full error object:", error);
      console.error("[AuthContext] Error details:", {
        name: error instanceof Error ? error.name : "Unknown",
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred");
      }
      return false;
    } finally {
      console.log(
        "[AuthContext] Sign-in process complete, setting isLoading to false"
      );
      setIsLoading(false);
    }
  };

  const logOut = async () => {
    console.log("[AuthContext] Logout initiated");
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (!confirmLogout) {
      console.log("[AuthContext] Logout cancelled by user");
      return;
    }
    try {
      console.log("[AuthContext] Signing out...");
      await auth.signOut();
      setUser(null);
      setCustomClaims(null);
      setIsAdmin(false);
      console.log("[AuthContext] Logout successful");
    } catch (error) {
      console.error("[AuthContext] Error logging out:", error);
      console.error("[AuthContext] Logout error details:", {
        name: error instanceof Error ? error.name : "Unknown",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred while logging out");
      }
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
