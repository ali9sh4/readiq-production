import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BookOpen,
  Users,
  Star,
  Mail,
  Phone,
  Instagram,
  Facebook,
  Twitter,
} from "lucide-react";
import { getCourses } from "@/data/courses";
import HomeCoursesSection from "@/components/HomeCoursesSection";

export default async function Home() {
  const data = await getCourses({
    pagination: {
      pageSize: 1000,
    },
    filters: {
      isApproved: true,
      isRejected: false,
      status: "published",
    },
  });
  const courses = data.courses ? data.courses || [] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-sky-900 to-sky-950 text-white py-12 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6">
            اقْرَأْ واكتشف عالماً جديداً من المعرفة
          </h1>
          <p className="text-base sm:text-lg md:text-xl mb-6 md:mb-8 max-w-3xl mx-auto leading-relaxed px-4">
            منصة القراءة العربية الرائدة - اكتشف آلاف الكتب والدورات التعليمية
            وطور مهاراتك مع أفضل المحتوى العربي
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              asChild
              size="lg"
              className="bg-white text-sky-900 hover:bg-gray-300 font-semibold"
            >
              <Link href="/courses">استكشف الدورات</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-white text-sky-900 hover:bg-gray-300 font-semibold"
            >
              <Link href="/auth/register">ابدأ التعلم الآن</Link>
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
              <h3 className="text-3xl font-bold text-gray-900 mb-2">
                {courses.length}+
              </h3>
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
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              الدورات المميزة
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto px-4">
              اختر من مجموعة متنوعة من الدورات التعليمية عالية الجودة
            </p>
          </div>

          <HomeCoursesSection initialCourses={courses} />
        </div>
      </section>

      {/* Footer Section */}
      <footer className="bg-gradient-to-r from-sky-950 to-sky-900 text-white pt-12 pb-6">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 max-w-5xl mx-auto">
            {/* About Section */}
            <div className="text-center md:text-right">
              <h3 className="text-2xl font-bold mb-4">اقْرَأْ</h3>
              <p className="text-sky-100 leading-relaxed">
                منصتك التعليمية الأولى في العراق. نوفر دورات عالية الجودة لتطوير
                مهاراتك وتحقيق أهدافك المهنية
              </p>
            </div>

            {/* Contact Info */}
            <div className="text-center md:text-right">
              <h4 className="text-lg font-semibold mb-4">تواصل معنا</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2 justify-center md:justify-start">
                  <Mail className="w-5 h-5 text-sky-300" />
                  <a
                    href="mailto:alisuhailshihab@gmail.com"
                    className="text-sky-100 hover:text-white transition break-all"
                  >
                    alisuhailshihab@gmail.com
                  </a>
                </li>
                <li className="flex items-center gap-2 justify-center md:justify-start">
                  <Phone className="w-5 h-5 text-sky-300" />
                  <a
                    href="tel:07702706976"
                    className="text-sky-100 hover:text-white transition"
                  >
                    07702706976
                  </a>
                </li>
                <li className="flex items-center gap-2 justify-center md:justify-start">
                  <Phone className="w-5 h-5 text-sky-300" />
                  <a
                    href="tel:07886552919"
                    className="text-sky-100 hover:text-white transition"
                  >
                    07886552919
                  </a>
                </li>
              </ul>
            </div>

            {/* Social Media */}
            <div className="text-center md:text-right">
              <h4 className="text-lg font-semibold mb-4">تابعنا</h4>
              <div className="flex gap-4 justify-center md:justify-start">
                <a
                  href="#"
                  className="w-10 h-10 bg-sky-800 hover:bg-sky-700 rounded-full flex items-center justify-center transition relative group"
                  aria-label="Instagram"
                >
                  <Instagram className="w-5 h-5" />
                  <span className="absolute -top-8 bg-sky-700 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
                    قريباً
                  </span>
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-sky-800 hover:bg-sky-700 rounded-full flex items-center justify-center transition relative group"
                  aria-label="Facebook"
                >
                  <Facebook className="w-5 h-5" />
                  <span className="absolute -top-8 bg-sky-700 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
                    قريباً
                  </span>
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-sky-800 hover:bg-sky-700 rounded-full flex items-center justify-center transition relative group"
                  aria-label="Twitter"
                >
                  <Twitter className="w-5 h-5" />
                  <span className="absolute -top-8 bg-sky-700 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
                    قريباً
                  </span>
                </a>
              </div>
              <div className="mt-6">
                <p className="text-sm text-sky-200 mb-2">طرق الدفع المتوفرة:</p>
                <div className="flex gap-2 flex-wrap justify-center md:justify-start">
                  <div className="bg-sky-800 px-3 py-1 rounded text-sm">
                    ZainCash
                  </div>
                  <div className="bg-sky-800 px-3 py-1 rounded text-sm">
                    المحفظة
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-sky-800 pt-6 mt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sky-200 text-sm">
                © {new Date().getFullYear()} اقْرَأْ. جميع الحقوق محفوظة
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
