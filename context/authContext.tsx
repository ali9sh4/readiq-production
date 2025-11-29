"use client";
import { auth } from "@/firebase/client";
import {
  GoogleAuthProvider,
  signInWithPopup,
  User,
  ParsedToken,
  signInWithEmailAndPassword,
} from "firebase/auth";
import React, { useContext, useEffect, createContext, useState } from "react";

import { removeToken, setToken } from "./actions";
import { createOrUpdateUser } from "@/lib/services/userService";
import { useRouter } from "next/navigation"; // ✅ Changed from "next/router"

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
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [CustomClaims, setCustomClaims] = useState<ParsedToken | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter(); // ✅ Hook inside component

  useEffect(() => {
    setIsClient(true);
  }, []);

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

        // ✅ Redirect to home if on login page
        if (window.location.pathname === "/login") {
          router.push("/");
        }
      } else {
        await removeToken();
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isClient, router]);

  const handleGoogleSignIn = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });

      const result = await signInWithPopup(auth, provider);

      console.log("Sign-in successful:", result.user.email);
      return true; // ✅ Return success
    } catch (error: any) {
      console.error("Full error object:", error);
      const errorCode = error?.code;
      if (
        errorCode === "auth/popup-closed-by-user" ||
        errorCode === "auth/cancelled-popup-request"
      ) {
        // User cancelled - don't show error
        console.log("User closed the popup");
        return false;
      }

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred");
      }

      return false; // ✅ Return failure
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
