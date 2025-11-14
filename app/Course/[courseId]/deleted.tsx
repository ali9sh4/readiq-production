import { Button } from "@/components/ui/button";
import { AlertCircle, Link } from "lucide-react";

export default function CourseDeleted() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50"
      dir="rtl"
    >
      <div className="text-center p-8 max-w-md">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          الدورة غير متاحة
        </h1>
        <p className="text-gray-600 mb-8">
          هذه الدورة لم تعد متاحة. ربما تم حذفها من قبل المدرب.
        </p>
        <Button asChild>
          <Link href="/">العودة إلى الصفحة الرئيسية</Link>
        </Button>
      </div>
    </div>
  );
}
