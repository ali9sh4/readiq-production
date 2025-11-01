//first you need to create context then AuthProvider
//value will contain all the functions and the user
//al the work is inside the AuthProvider
//first you create variable to store the user in which is [user,setUser]
//because using typescript you need to specify the type for the authContext
//for the current user you need to specify the type which is either null of firebase User
//when setting the current user you need to call the onAuthStateChanged function and then grab the user and set it correctly
//For every resource you create, plan how you'll clean it up in useEffect.

"use client";
import { auth } from "@/firebase/client";
import { GoogleAuthProvider, signInWithPopup, User } from "firebase/auth";

import React, { useContext, useEffect } from "react";
import { createContext, useState } from "react";
import { ParsedToken } from "firebase/auth";
import { removeToken, setToken } from "./actions";

const AuthContext = createContext<AuthContextType | null>(null);

type AuthContextType = {
  user: User | null;
  handleGoogleSignIn: () => Promise<void>;
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

        // If token expires in less than 5 minutes, refresh it
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

    // Check every minute
    const interval = setInterval(checkAndRefreshToken, 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!isClient) return;
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const tokenResult = await currentUser.getIdTokenResult();
        const token = tokenResult.token;
        const refreshToken = currentUser.refreshToken;
        const claims = tokenResult.claims;
        setCustomClaims(claims);
        if (token && refreshToken) {
          await setToken({ token, refreshToken });
        }
      } else {
        await removeToken();
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [isClient]);
  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("Current URL:", window.location.href);
      console.log("Auth domain from config:", auth.app.options.authDomain);

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });

      const result = await signInWithPopup(auth, provider);
      console.log("Sign-in successful:", result.user.email);
    } catch (error) {
      console.error("Full error object:", error);

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred");
      }
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
