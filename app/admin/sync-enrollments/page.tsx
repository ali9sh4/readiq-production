"use client";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function SyncEnrollmentsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

  const handleSync = async () => {
    setLoading(true);
    setResult("");

    try {
      const response = await fetch("/api/admin/sync-enrollments", {
        method: "POST",
      });
      const data = await response.json();
      setResult(data.message || "تم التحديث بنجاح");
    } catch (error) {
      setResult("حدث خطأ أثناء المزامنة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">مزامنة أعداد التسجيلات</h1>
      <p className="mb-4 text-gray-600">
        هذه الأداة تحدث عدد الطلاب المسجلين لجميع الدورات
      </p>
      <Button onClick={handleSync} disabled={loading}>
        {loading ? "جاري المزامنة..." : "مزامنة الآن"}
      </Button>
      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
          {result}
        </div>
      )}
    </div>
  );
}