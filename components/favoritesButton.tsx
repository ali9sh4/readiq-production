"use client";

import { useState, useEffect } from "react"; // ✅ Add useEffect
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
  courseTitle: string;
  courseThumbnail?: string;
  initialIsFavorited?: boolean;
  showLabel?: boolean;
  variant?: "default" | "ghost" | "outline";
}

export default function FavoriteButton({
  courseId,
  courseTitle,
  courseThumbnail,
  initialIsFavorited = false,
  showLabel = false,
  variant = "ghost",
}: FavoriteButtonProps) {
  const auth = useAuth();
  const router = useRouter();
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ ADD THIS - Sync state with prop changes
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

    setIsLoading(true);

    try {
      const token = await auth.user.getIdToken();

      if (isFavorited) {
        const result = await removeFromFavorites(token, courseId);

        if (result.success) {
          setIsFavorited(false);
          toast.success("تمت الإزالة من المفضلة");
        } else {
          toast.error(result.error || "حدث خطأ");
        }
      } else {
        const result = await addToFavorites(
          token,
          courseId,
          courseTitle,
          courseThumbnail
        );

        if (result.success) {
          setIsFavorited(true);
          toast.success("تمت الإضافة إلى المفضلة");
        } else {
          toast.error(result.error || "حدث خطأ");
        }
      }
    } catch (error) {
      console.error("Favorite toggle error:", error);
      toast.error("حدث خطأ، يرجى المحاولة مرة أخرى");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleToggleFavorite}
      disabled={isLoading}
      variant={variant}
      size={showLabel ? "default" : "icon"}
      className={`transition-all backdrop-blur-sm bg-white/80 hover:bg-white border-0 ${
        isFavorited
          ? "text-red-500 hover:text-red-600"
          : "text-gray-600 hover:text-red-500"
      }`}
    >
      <Heart
        className={`w-5 h-5 ${
          isFavorited ? "fill-current" : ""
        } transition-all`}
      />
      {showLabel && (
        <span className="mr-2">
          {isFavorited ? "إزالة من المفضلة" : "إضافة للمفضلة"}
        </span>
      )}
    </Button>
  );
}
