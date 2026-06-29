import { Suspense } from "react";
import InstructorCourse from "@/components/instructorCourse";
import CoursesGridSkeleton from "@/components/CoursesGridSkeleton";
import NavigationButton from "@/components/NavigationButton";
import { Button } from "@/components/ui/button";
import { PlusCircle, BookOpen } from "lucide-react";
import Link from "next/link";

type SearchParams = {
  cursor?: string;
  category?: string;
  level?: string;
  userId?: string;
};

export default async function Courses({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                دوراتك المنشورة
              </h1>
              <p className="text-gray-600 text-sm sm:text-base lg:text-lg mt-0.5">
                إدارة ومتابعة جميع الدورات التدريبية الخاصة بك
              </p>
            </div>
          </div>
        </div>

        {/* Courses List */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-6">
          <div className="h-1 bg-blue-600" />
          <div className="p-4 sm:p-6">
            {/* Stream the Firestore-backed course list so this page shell
                paints immediately instead of the whole route blocking. */}
            <Suspense fallback={<CoursesGridSkeleton />}>
              <InstructorCourse searchParams={searchParams} />
            </Suspense>
          </div>
        </div>

        {/* Add New Course Button - At Bottom */}
        <div className="flex justify-center pb-6">
          {/* Single prefetching link-button (was a Button asChild wrapping a
              NavigationButton, i.e. nested buttons). NavigationButton now is a
              styled <Link>, so the outer wrapper is gone. */}
          <NavigationButton
            href={`/course-upload/new`}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200 rounded-xl flex items-center gap-2 px-8 py-6"
          >
            <PlusCircle className="h-5 w-5" />
            <span className="font-semibold text-base sm:text-lg">
              إضافة دورة جديدة
            </span>
          </NavigationButton>
        </div>
      </div>
    </div>
  );
}
