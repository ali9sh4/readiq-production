"use client";

import React from "react";
import { useAuth } from "@/context/authContext";
import { Button } from "./ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./ui/card";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const router = useRouter();
  const { handleGoogleSignIn, isLoading, error } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-blue-50 via-white to-pink-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-extrabold">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-gray-600">
            Sign in with your Google account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <Button
            onClick={async () => {
              await handleGoogleSignIn();
              router.push("/"); // ✅ Default redirect
            }}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              "Signing in..."
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  aria-hidden="true"
                  focusable="false"
                  data-prefix="fab"
                  data-icon="google"
                  role="img"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 488 512"
                >
                  <path
                    fill="currentColor"
                    d="M488 261.8c0-17.8-1.6-35-4.7-51.8H249v98.2h134.7c-5.8 31-23.5 57.3-50.3 75v62.5h81.3c47.5-43.7 74.3-108.4 74.3-183.9zM249 492c67.7 0 124.6-22.5 166-61l-81.3-62.5c-22.6 15.2-51.5 24.2-84.7 24.2-65 0-120-43.9-139.8-102.8H23.2v64.6C64.3 441.4 150.3 492 249 492zM109.2 300.9c-4.8-14.2-7.6-29.4-7.6-45s2.8-30.8 7.6-45V146.2H23.2C8.3 185.8 0 228.5 0 271.9s8.3 86.1 23.2 125.7l86-64.7zM249 100.1c35.3 0 67 12.1 91.9 35.8l68.9-68.9C373.5 23.2 323.1 0 249 0 150.3 0 64.3 50.6 23.2 128.2l86 64.6C129 144 184 100.1 249 100.1z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </Button>
          {error && <p className="text-red-500 text-sm mt-2">Error: {error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
