"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface NavigationButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export default function NavigationButton({
  href,
  children,
  variant = "default",
  size = "default",
  className = "",
  icon,
  disabled = false,
}: NavigationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);

    // Add a small delay to show the loading state (optional, remove if too slow)
    // await new Promise(resolve => setTimeout(resolve, 100));

    router.push(href);

    // Keep loading state for a bit to prevent flickering
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <>
          {children}
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
        </>
      ) : (
        <>
          {children}
          {icon && icon}
        </>
      )}
    </Button>
  );
}
