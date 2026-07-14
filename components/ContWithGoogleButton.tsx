"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/context/authContext";
import { Button } from "@/components/ui/button";

// Google Icon Component
const GoogleIcon = () => (
  <svg
    className="w-5 h-5"
    aria-hidden="true"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default function ContWithGoogleButton() {
  const { handleGoogleSignIn, error, signInPhase, redirectResolving } =
    useAuth();
  const [isButtonLoading, setIsButtonLoading] = useState(false); // ✅ Local state

  // bfcache: hitting Back from the Google page restores this page with
  // isButtonLoading frozen true (stuck spinner) and no effects re-run —
  // pageshow(persisted) is the only signal. The context's own listener
  // resets its phase/stamp; this one covers the local button state.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setIsButtonLoading(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const handleLogin = async () => {
    setIsButtonLoading(true); // ✅ Set local loading
    try {
      const success = await handleGoogleSignIn();

      if (success) {
        toast.success("مرحباً بك! 👋", {
          description: "تم تسجيل الدخول بنجاح",
        });
        // Navigation happens in authContext (honors ?redirect= destination).
      }
    } catch (error) {
    } finally {
      setIsButtonLoading(false); // ✅ Always reset, even if popup closed
    }
  };

  // Phase-specific label so a slow network never looks frozen.
  const pendingLabel = redirectResolving
    ? "جاري إكمال تسجيل الدخول..."
    : signInPhase === "redirect"
    ? "جاري التحويل إلى صفحة جوجل..."
    : "جاري تسجيل الدخول...";
  const isPending = isButtonLoading || redirectResolving;

  return (
    <div>
      <Button
        onClick={handleLogin}
        disabled={isPending}
        variant="outline"
        className="w-full h-12 text-base font-medium gap-3 hover:bg-muted/50 transition-colors"
      >
        {isPending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{pendingLabel}</span>
          </>
        ) : (
          <>
            <GoogleIcon />
            <span>المتابعة باستخدام جوجل</span>
          </>
        )}
      </Button>

      {/* Failed sign-in must never be a silent dead end: show the error and
          offer a retry (redirect flow in prod, popup in dev). */}
      {error && !isPending && (
        <div
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center"
          role="alert"
        >
          <p className="text-sm text-red-700 mb-2">{error}</p>
          <Button
            onClick={handleLogin}
            variant="outline"
            size="sm"
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            حاول مرة أخرى
          </Button>
        </div>
      )}
    </div>
  );
}
