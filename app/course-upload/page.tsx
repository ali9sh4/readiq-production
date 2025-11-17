import InstructorCourse from "@/components/instructorCourse";
import { Button } from "@/components/ui/button";
import { PlusCircleIcon, BookOpen } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { adminAuth } from "@/firebase/service";
import { redirect } from "next/navigation";

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
  // 🔥 ADD THIS: Check authentication
  const cookieStore = await cookies();
  const token = cookieStore.get("firebaseAuthToken")?.value;

  // If no token, show login message
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            يرجى تسجيل الدخول
          </h1>
          <p className="text-gray-600 mb-6">
            يجب عليك تسجيل الدخول لعرض دوراتك
          </p>
          <Button asChild>
            <Link href="/sign-in">تسجيل الدخول</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Verify token and get user
  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (error) {
    // Invalid token, redirect to login
    redirect("/sign-in");
  }

  const userId = decodedToken.uid;

  // NOW we have the user ID! Pass it to InstructorCourse
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Action Bar */}
        <div className="flex justify-center mb-8">
          <Button
            asChild
            size="lg"
            className="bg-gradient-to-r from-sky-200 via-blue-200 to-indigo-200 hover:from-sky-300 hover:via-blue-300 hover:to-indigo-300 text-sky-900 shadow-md transition-all duration-300 rounded-2xl border border-sky-300/50 hover:border-sky-400/60 group relative overflow-hidden"
          >
            <Link
              href="/course-upload/new"
              className="flex items-center gap-3 px-10 py-5 relative z-10"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <PlusCircleIcon className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-bold text-xl">إضافة دورة جديدة</span>
            </Link>
          </Button>
        </div>

        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 bg-gradient-to-br from-sky-900 to-sky-950 rounded-xl flex items-center justify-center shadow-lg">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                دوراتك المنشورة
              </h1>
              <p className="text-gray-600 text-lg mt-1">
                إدارة ومتابعة جميع الدورات التدريبية الخاصة بك
              </p>
            </div>
          </div>
        </div>

        {/* Courses List */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-sky-900 via-sky-700 to-sky-950" />
          <div className="p-6">
            <InstructorCourse searchParams={params} userId={userId} />
          </div>
        </div>
      </div>
    </div>
  );
}