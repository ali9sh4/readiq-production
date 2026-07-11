// components/ProtectedLink.tsx
"use client";

import Link from "next/link";
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ProtectedLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export default function ProtectedLink({
  href,
  children,
  className,
  onClick,
}: ProtectedLinkProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    // While Firebase Auth is still resolving, don't flash a false "please
    // log in" — let the navigation proceed and middleware arbitrate.
    if (!user && !isLoading) {
      e.preventDefault();
      toast.error("يرجى تسجيل الدخول أولاً", {
        description: "سيتم توجيهك لصفحة تسجيل الدخول",
      });
      // Preserve the intended destination so sign-in returns the user here.
      router.push(`/login?redirect=${encodeURIComponent(href)}`);
      return;
    }
    
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}