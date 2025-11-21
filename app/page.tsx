import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Users,
  Star,
  Mail,
  Phone,
  Instagram,
  Facebook,
  Twitter,
  CheckCircle,
  ArrowLeft,
  PlayCircle,
  GraduationCap,
  Clock,
  Target,
  Sparkles,
} from "lucide-react";
import { getCourses } from "@/data/courses";
import HomeCoursesSection from "@/components/HomeCoursesSection";
import NavigationButton from "@/components/NavigationButton";
import CTASection from "@/components/CTASection";

export default async function Home() {
  const data = await getCourses({
    pagination: { pageSize: 20 },
    filters: {
      isApproved: true,
      isRejected: false,
      status: "published",
    },
  });

  const courses = data.courses ?? [];
  console.log("🔍 Server fetched courses:", courses.length); // Server logs

  const totalCourses = 20; // Hardcoded total courses for display

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-sky-900 text-white">
        {/* Subtle background shapes - reduced opacity on tablets for better text clarity */}
        <div className="pointer-events-none absolute inset-0 opacity-20 md:opacity-10">
          <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-emerald-400 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-sky-500 blur-3xl" />
        </div>

        {/* Dark overlay for better text contrast on tablets */}
        <div className="pointer-events-none absolute inset-0 bg-sky-950/30 md:bg-sky-950/50"></div>

        <div className="relative z-10">
          <div className="container mx-auto px-4 md:px-6 py-8 md:py-12 lg:py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
              {/* Text side */}
              <div className="text-center md:text-right space-y-5 md:space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>منصة عربية حديثة للتعلم أونلاين</span>
                </div>

                <div className="space-y-4">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight text-white drop-shadow-lg md:drop-shadow-2xl">
                    استثمر في <span className="text-emerald-300">مهاراتك</span>
                    <br className="hidden sm:block" />
                  </h1>
                  <p className="text-base md:text-lg text-white/95 md:text-white max-w-xl mx-auto md:mx-0 leading-relaxed drop-shadow-md md:drop-shadow-xl">
                    دورات عالية الجودة من محاضرين متميزين، مع دعم محلي وطرق دفع
                    تناسب العراق. تعلّم في الوقت الذي يناسبك وبالسرعة التي
                    تفضلها.
                  </p>
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start pt-2">
                  <a href="#courses">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base px-8 h-12 shadow-lg hover:shadow-xl transition-all flex items-center gap-2 justify-center"
                    >
                      استكشف الدورات
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                  </a>

                  <NavigationButton
                    href="/user_dashboard/profile"
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto rounded-xl border-2 border-white/80 bg-transparent text-white hover:bg-white hover:text-sky-900 font-semibold text-base px-8 h-12 transition-all"
                  >
                    ملفي الشخصي
                  </NavigationButton>
                </div>

                {/* Trust row */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6 pt-4 text-sm text-white drop-shadow-md md:drop-shadow-xl">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-300 md:text-emerald-200" />
                    <span className="font-medium">شهادات إنهاء لكل دورة</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-300 md:text-emerald-200" />
                    <span className="font-medium">دعم محلي باللغة العربية</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-300 md:text-emerald-200" />
                    <span className="font-medium">
                      محتوى يتم تحديثه باستمرار
                    </span>
                  </div>
                </div>
              </div>

              {/* Side card / visual */}
              <div className="md:order-first flex justify-center md:justify-end">
                <div className="w-full max-w-md">
                  <div className="relative rounded-3xl bg-sky-950/50 border border-sky-800/70 shadow-2xl px-6 py-6 md:py-7 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500">
                          <BookOpen className="h-6 w-6 text-sky-950" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-semibold text-white text-sm md:text-base">
                            دورات مخصصة للعراق
                          </p>
                          <p className="text-xs text-sky-200">
                            محتوى عملي وقابل للتطبيق مباشرة
                          </p>
                        </div>
                      </div>
                      <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-200 border border-emerald-300/30">
                        متاح الآن
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center text-sky-100">
                      <div className="rounded-2xl bg-sky-900/60 border border-sky-700/70 px-3 py-3">
                        <p className="text-xs text-sky-300 mb-1">عدد الدورات</p>
                        <p className="text-xl font-bold">{totalCourses}+</p>
                      </div>
                      <div className="rounded-2xl bg-sky-900/60 border border-sky-700/70 px-3 py-3">
                        <p className="text-xs text-sky-300 mb-1">طلاب نشطون</p>
                        <p className="text-xl font-bold">1,000+</p>
                      </div>
                      <div className="rounded-2xl bg-sky-900/60 border border-sky-700/70 px-3 py-3">
                        <p className="text-xs text-sky-300 mb-1">تقييم عام</p>
                        <p className="text-xl font-bold flex items-center justify-center gap-1">
                          4.9{" "}
                          <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= STATS ================= */}
      <section className="hidden lg:block bg-white py-12">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 max-w-5xl mx-auto">
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-5 py-5 sm:px-6 sm:py-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-white">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-sky-700/80">دورات متاحة</p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-sky-900">
                    {totalCourses}+
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600">
                محتوى في مجالات متعددة مصمم للسوق العراقي والعربي.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-5 py-5 sm:px-6 sm:py-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-emerald-800/80">طلاب نشطون</p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-emerald-900">
                    1,000+
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600">
                مجتمع متنامٍ من المتعلمين من مختلف المحافظات.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-5 py-5 sm:px-6 sm:py-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white">
                  <Star className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-amber-900/80">تقييم المنصة</p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-amber-900">
                    4.9
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600">
                رضا عالٍ من الطلاب عن جودة المحتوى والتجربة.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-5 sm:px-6 sm:py-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-white">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-gray-700/80">جودة المحتوى</p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                    100%
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600">
                مراجعة يدوية للدورات قبل نشرها لضمان الجودة.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= COURSES ================= */}
      <section id="courses" className="bg-white py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-10 md:mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-900 mb-3">
              <Star className="h-4 w-4" />
              <span>دورات مختارة لك</span>
            </div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
              ابدأ من أكثر الدورات طلباً
            </h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              اختر دورة تناسب هدفك الحالي، سواء كان بداية جديدة أو تطوير مهارة
              موجودة.
            </p>
          </div>

          <HomeCoursesSection initialCourses={courses} />

          <div className="mt-10 text-center">
            <NavigationButton
              href="/user_dashboard"
              size="lg"
              className="rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold px-8 h-12 text-base shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2"
              icon={<ArrowLeft className="h-5 w-5" />}
            >
              عرض دوراتي
            </NavigationButton>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <CTASection />

      {/* ================= FOOTER ================= */}
      <footer className="bg-gray-950 text-white pt-10 pb-6">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 max-w-5xl mx-auto mb-8">
            {/* Brand */}
            <div className="text-center md:text-right space-y-3">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold">اقْرَأْ</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                منصة تعليمية عربية، تهدف لتقديم محتوى عملي وعالي الجودة يناسب
                سوق العمل في العراق والعالم العربي.
              </p>
              <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-gray-400">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span>موثوق من مئات الطلاب والمحاضرين</span>
              </div>
            </div>

            {/* Contact */}
            <div className="text-center md:text-right space-y-3">
              <h4 className="flex items-center justify-center md:justify-start gap-2 text-base font-semibold mb-1">
                <Mail className="h-4 w-4 text-sky-400" />
                تواصل معنا
              </h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a
                    href="mailto:alisuhailshihab@gmail.com"
                    className="flex items-center justify-center md:justify-start gap-2 hover:text-white transition"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
                      <Mail className="h-4 w-4" />
                    </div>
                    <span>alisuhailshihab@gmail.com</span>
                  </a>
                </li>
                <li>
                  <a
                    href="tel:07702706976"
                    className="flex items-center justify-center md:justify-start gap-2 hover:text-white transition"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
                      <Phone className="h-4 w-4" />
                    </div>
                    <span dir="ltr">0770 270 6976</span>
                  </a>
                </li>
                <li>
                  <a
                    href="tel:07886552919"
                    className="flex items-center justify-center md:justify-start gap-2 hover:text-white transition"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
                      <Phone className="h-4 w-4" />
                    </div>
                    <span dir="ltr">0788 655 2919</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Social + payments */}
            <div className="text-center md:text-right space-y-3">
              <h4 className="text-base font-semibold mb-1">تابعنا</h4>
              <div className="flex justify-center md:justify-start gap-3 mb-3">
                <a
                  href="#"
                  aria-label="Instagram"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 hover:bg-gradient-to-br hover:from-pink-500 hover:to-purple-600 transition"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href="#"
                  aria-label="Facebook"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 hover:bg-blue-600 transition"
                >
                  <Facebook className="h-4 w-4" />
                </a>
                <a
                  href="#"
                  aria-label="Twitter"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 hover:bg-sky-500 transition"
                >
                  <Twitter className="h-4 w-4" />
                </a>
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900/70 px-4 py-3 space-y-2">
                <p className="text-sm text-gray-300 font-medium">
                  طرق الدفع المتوفرة:
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 text-sm">
                  <span className="rounded-lg bg-purple-600 px-3 py-1 font-semibold">
                    ZainCash
                  </span>
                  <span className="rounded-lg bg-emerald-600 px-3 py-1 font-semibold">
                    المحفظة
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4 mt-2">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-500">
              <p className="text-center md:text-right">
                © {new Date().getFullYear()} اقْرَأْ – جميع الحقوق محفوظة.
              </p>
              <div className="flex items-center gap-3">
                <Link
                  href="/privacy"
                  className="hover:text-gray-300 transition"
                >
                  سياسة الخصوصية
                </Link>
                <span>•</span>
                <Link href="/terms" className="hover:text-gray-300 transition">
                  الشروط والأحكام
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
