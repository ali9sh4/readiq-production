"use client";

import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

interface LoadMoreButtonProps {
  nextCursor: string;
  hasMore: boolean;
  currentParams?: Record<string, string | undefined>;
}

export default function LoadMoreButton({ 
  nextCursor, 
  hasMore,
  currentParams = {}
}: LoadMoreButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadMore = async () => {
    if (!hasMore || !nextCursor || isLoading) return;

    setIsLoading(true);
    
    try {
      // ✅ Build new URL with cursor parameter
      const params = new URLSearchParams(searchParams.toString());
      params.set('cursor', nextCursor);
      
      // ✅ Preserve existing filters
      Object.entries(currentParams).forEach(([key, value]) => {
        if (value && key !== 'cursor') {
          params.set(key, value);
        }
      });

      // ✅ Navigate to new URL with cursor
      router.push(`?${params.toString()}`);
    } catch (error) {
      console.error('Error loading more courses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasMore) return null;

  return (
    <div className="text-center">
      <Button
        onClick={handleLoadMore}
        disabled={isLoading || !nextCursor}
        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
            جاري التحميل...
          </>
        ) : (
          "تحميل المزيد من الدورات"
        )}
      </Button>
    </div>
  );
}