"use client";

import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface NavigationButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  prefetch?: boolean;
}

// Real navigation-pending indicator. `useLinkStatus` (Next 15.3+) reports the
// pending state of the App Router transition triggered by the enclosing <Link>,
// so the spinner is tied to whether navigation actually finished. This replaces
// the old fixed `setTimeout(..., 1000)` spinner that was decoupled from real
// navigation and was the source of the "laggy/unclickable" feel.
function NavPendingIcon({ icon }: { icon?: React.ReactNode }) {
  const { pending } = useLinkStatus();

  if (pending) {
    return <Loader2 className="h-5 w-5 animate-spin mr-2" />;
  }

  return <>{icon}</>;
}

export default function NavigationButton({
  href,
  children,
  variant = "default",
  size = "default",
  className = "",
  icon,
  disabled = false,
  // Prefetch defaults on so the destination route is warmed before the click.
  prefetch = true,
}: NavigationButtonProps) {
  // Render a non-navigating, styled placeholder when disabled (a Link can't be
  // meaningfully disabled, so we drop the href entirely).
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={cn(
          buttonVariants({ variant, size }),
          "pointer-events-none opacity-50",
          className
        )}
      >
        {children}
        {icon}
      </span>
    );
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {children}
      <NavPendingIcon icon={icon} />
    </Link>
  );
}

/*
 * Previous implementation (kept for reference / reversibility):
 *
 * It used `router.push(href)` (no prefetch) plus a fixed 1000ms setTimeout to
 * hold a manual `isLoading` spinner, regardless of whether navigation had
 * finished. That decoupled timer caused the laggy click feel documented in
 * docs/NAV_AND_COURSE_EDITOR_AUDIT.md (Symptom 1, root cause #3).
 *
 *   const [isLoading, setIsLoading] = useState(false);
 *   const router = useRouter();
 *   const handleClick = async () => {
 *     if (disabled || isLoading) return;
 *     setIsLoading(true);
 *     router.push(href);
 *     setTimeout(() => { setIsLoading(false); }, 1000);
 *   };
 */
