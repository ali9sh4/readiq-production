"use client";

import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { RefreshCw, ArrowRight, ArrowLeft } from "lucide-react";

interface LoadMoreButtonProps {
  nextCursor: string;
  hasMore: boolean;
  currentParams?: Record<string, string | undefined>;
}

export default function NextBackButton({
  nextCursor,
  hasMore,
  currentParams = {},
}: LoadMoreButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadMore = async () => {
    if (!hasMore || !nextCursor || isLoading) return;

    setIsLoading(true);

    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("cursor", nextCursor);
      Object.entries(currentParams).forEach(([key, value]) => {
        if (value && key !== "cursor") params.set(key, value);
      });
      router.push(`?${params.toString()}`);
    } catch (error) {
      console.error("Error loading more courses:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => router.back();

  const handleGoToFirstPage = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cursor");
    Object.entries(currentParams).forEach(([key, value]) => {
      if (value && key !== "cursor") params.set(key, value);
    });
    router.push(`?${params.toString()}`);
  };

  const isNotFirstPage = searchParams.get("cursor") !== null;

  return (
    <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
      {isNotFirstPage && (
        <div className="flex gap-2">
          <Button
            onClick={handleGoToFirstPage}
            variant="outline"
            className="px-4 py-3 border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-900 hover:border-blue-400 transition-colors font-medium rounded-lg"
          >
            الصفحة الأولى
          </Button>
          <Button
            onClick={handleGoBack}
            variant="outline"
            className="px-4 py-3 border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-900 hover:border-blue-400 transition-colors font-medium rounded-lg"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            السابق
          </Button>
        </div>
      )}
      {hasMore && (
        <Button
          onClick={handleLoadMore}
          disabled={isLoading || !nextCursor}
          className="px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors font-medium rounded-lg"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
              جاري التحميل...
            </>
          ) : (
            <>
              تحميل المزيد من الدورات
              <ArrowLeft className="w-4 h-4 mr-2" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}
