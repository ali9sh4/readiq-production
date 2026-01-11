"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/authContext";
import {
  addToFavorites,
  removeFromFavorites,
} from "@/app/actions/favorites_actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface FavoriteButtonProps {
  courseId: string;
  initialIsFavorited?: boolean;
  showLabel?: boolean;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  onFavoriteChange?: (courseId: string, isFavorited: boolean) => void;
}

export default function FavoriteButton({
  courseId,
  initialIsFavorited = false,
  showLabel = false,
  variant = "ghost",
  size = "icon",
  onFavoriteChange,
}: FavoriteButtonProps) {
  const auth = useAuth();
  const router = useRouter();
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsFavorited(initialIsFavorited);
  }, [initialIsFavorited]);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!auth.user) {
      toast.error("يرجى تسجيل الدخول أولاً");
      router.push(`/login?redirect=/course/${courseId}`);
      return;
    }

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    setIsLoading(true);

    const previousState = isFavorited;
    const newState = !isFavorited;

    // Optimistic update
    setIsFavorited(newState);
    onFavoriteChange?.(courseId, newState);

    try {
      const token = await auth.user.getIdToken();

      const result = previousState
        ? await removeFromFavorites(token, courseId)
        : await addToFavorites(token, courseId);

      if (result.success) {
        toast.success(result.message);
      } else {
        // Rollback on failure
        setIsFavorited(previousState);
        onFavoriteChange?.(courseId, previousState);
        toast.error(result.error || "حدث خطأ");
      }
    } catch (error) {
      // Rollback on error
      setIsFavorited(previousState);
      onFavoriteChange?.(courseId, previousState);
      console.error("Favorite toggle error:", error);
      toast.error("حدث خطأ، يرجى المحاولة مرة أخرى");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      title={isFavorited ? "إزالة من المفضلة" : "إضافة للمفضلة"}
      onClick={handleToggleFavorite}
      disabled={isLoading}
      variant={variant}
      size={showLabel ? "default" : size}
      className={`
        transition-all backdrop-blur-sm bg-white/80 hover:bg-white border-0
        ${
          isFavorited
            ? "text-red-500 hover:text-red-600"
            : "text-gray-600 hover:text-red-500"
        }
        ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
      `}
      aria-label={isFavorited ? "إزالة من المفضلة" : "إضافة للمفضلة"}
    >
      <Heart
        className={`w-5 h-5 transition-all ${
          isFavorited ? "fill-current scale-110" : ""
        }`}
      />
      {showLabel && (
        <span className="mr-2">
          {isFavorited ? "إزالة من المفضلة" : "إضافة للمفضلة"}
        </span>
      )}
    </Button>
  );
}
