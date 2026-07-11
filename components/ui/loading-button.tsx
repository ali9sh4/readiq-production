"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared in-button spinner. Use inside raw `<button>`s that keep custom
 * styling; for shadcn Buttons prefer <LoadingButton>.
 */
export function ButtonSpinner({ className }: { className?: string }) {
  return (
    <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden />
  );
}

type LoadingButtonProps = React.ComponentProps<typeof Button> & {
  /** While true the button is disabled and shows a spinner. */
  loading?: boolean;
  /** Optional label swap while loading (e.g. "جاري الحفظ..."). */
  loadingText?: React.ReactNode;
};

/**
 * shadcn <Button> with a built-in pending state, so a click on a slow
 * connection never looks frozen. The Button base class already has gap-2,
 * so the spinner needs no extra margin (RTL-safe).
 */
export function LoadingButton({
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading ? (
        <>
          <ButtonSpinner />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
