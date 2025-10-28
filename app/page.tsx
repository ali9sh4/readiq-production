import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, BookOpen, Users, Star, PlusCircle } from "lucide-react";
import PublicCoursesCardList from "@/components/publicCoursesCardList";
type SearchParams = Promise<{
  cursor?: string;
  category?: string;
  level?: string;
}>;

export default async function Home({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  // ✅ Get featured courses for homepage

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-sky-900 to-sky-950 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">
            اقْرَأْ واكتشف عالماً جديداً من المعرفة
          </h1>
          <p className="text-xl mb-8 max-w-3xl mx-auto leading-relaxed">
            منصة القراءة العربية الرائدة - اكتشف آلاف الكتب والدورات التعليمية
            وطور مهاراتك مع أفضل المحتوى العربي
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              asChild
              size="lg"
              className="bg-white text-sky-900 hover:bg-gray-300 font-semibold"
            >
              <Link href="/courses">
                تصفح الدورات
                <ArrowLeft className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-white text-sky-900 hover:bg-gray-300 font-semibold"
            >
              <Link href="/course-upload/new">
                أضف دورة جديدة
                <PlusCircle className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-8 rounded-xl shadow-sm border border-sky-200">
              <BookOpen className="h-12 w-12 text-sky-900 mx-auto mb-4" />

              <p className="text-gray-600 font-medium">دورة تعليمية</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-8 rounded-xl shadow-sm border border-emerald-200">
              <Users className="h-12 w-12 text-emerald-700 mx-auto mb-4" />
              <h3 className="text-3xl font-bold text-gray-900 mb-2">1,000+</h3>
              <p className="text-gray-600 font-medium">طالب نشط</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-8 rounded-xl shadow-sm border border-amber-200">
              <Star className="h-12 w-12 text-amber-600 mx-auto mb-4" />
              <h3 className="text-3xl font-bold text-gray-900 mb-2">4.9</h3>
              <p className="text-gray-600 font-medium">تقييم المنصة</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Courses Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              الدورات المميزة
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              اختر من مجموعة متنوعة من الدورات التعليمية عالية الجودة
            </p>
          </div>

          {/* Display Courses */}

          <>
            <PublicCoursesCardList searchParams={searchParams} />
          </>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 bg-gradient-to-r from-sky-900 to-sky-950 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            انضم إلى مجتمع اقْرَأْ اليوم
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto leading-relaxed">
            ابدأ رحلتك في التعلم والتطوير مع منصة اقْرَأْ - حيث المعرفة تلتقي
            بالابداع
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              asChild
              size="lg"
              className="bg-white text-sky-900 hover:bg-gray-100 font-semibold"
            >
              <Link href="/courses">استكشف الدورات</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-sky-900 font-semibold"
            >
              <Link href="/auth/register">إنشاء حساب جديد</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
