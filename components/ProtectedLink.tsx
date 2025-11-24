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
  const { user } = useAuth();
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      toast.error("يرجى تسجيل الدخول أولاً", {
        description: "سيتم توجيهك لصفحة تسجيل الدخول",
      });
      router.push("/login");
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