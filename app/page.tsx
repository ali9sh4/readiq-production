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

export default async function Home() {
  const data = await getCourses({
    pagination: { pageSize: 1000 },
    filters: {
      isApproved: true,
      isRejected: false,
      status: "published",
    },
  });

  const courses = data.courses ?? [];
  const totalCourses = courses.length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-900 via-sky-900 to-sky-950 text-white">
        {/* Subtle background shapes */}
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-emerald-400 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-sky-500 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-14 md:py-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-center">
              {/* Text side */}
              <div className="text-center md:text-right space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs sm:text-sm font-medium text-sky-100 backdrop-blur-md">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>منصة عربية حديثة للتعلم أونلاين</span>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
                    استثمر في{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-l from-emerald-300 to-cyan-200">
                 {" "} مهاراتك
                    </span>
                    <br className="hidden sm:block" />
                    وتعلّم بذكاء ومرونة
                  </h1>
                  <p className="text-sm sm:text-base md:text-lg text-sky-100/90 max-w-xl mx-auto md:mx-0 leading-relaxed">
                    دورات عالية الجودة من محاضرين متميزين، مع دعم محلي وطرق دفع
                    تناسب العراق. تعلّم في الوقت الذي يناسبك وبالسرعة التي
                    تفضلها.
                  </p>
                </div>

                {/* CTAs */}
                {/* <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center md:justify-start pt-2">
                  <Button
                    asChild
                    size="lg"
                    className="w-full sm:w-auto rounded-xl bg-gradient-to-l from-emerald-400 to-sky-400 text-sky-950 font-bold text-sm sm:text-base px-6 sm:px-8 py-4 shadow-lg hover:shadow-xl hover:from-emerald-500 hover:to-sky-500 transition-all"
                  >
                    <Link href="/courses" className="flex items-center gap-2">
                      ابدأ رحلتك الآن
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </Button>

                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto rounded-xl border border-sky-200/70 bg-transparent text-sky-50 hover:bg-white hover:text-sky-900 font-semibold text-sm sm:text-base px-6 sm:px-8 py-4 transition-all"
                  >
                    <Link href="/courses" className="flex items-center gap-2">
                      <PlayCircle className="h-4 w-4" />
                      استكشف الدورات
                    </Link>
                  </Button>
                </div> */}

                {/* Trust row */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 sm:gap-6 pt-4 sm:pt-6 text-xs sm:text-sm text-sky-100/90">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-300" />
                    <span>شهادات إنهاء لكل دورة</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-300" />
                    <span>دعم محلي باللغة العربية</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-300" />
                    <span>محتوى يتم تحديثه باستمرار</span>
                  </div>
                </div>
              </div>

              {/* Side card / visual */}
              <div className="md:order-first flex justify-center md:justify-end">
                <div className="w-full max-w-md">
                  <div className="relative rounded-3xl bg-sky-950/50 border border-sky-800/70 shadow-2xl px-5 sm:px-6 py-6 sm:py-7 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-400">
                          <BookOpen className="h-6 w-6 text-sky-950" />
                        </div>
                        <div className="space-y-0.5 text-sm">
                          <p className="font-semibold text-white">
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

                    <div className="grid grid-cols-3 gap-3 text-center text-xs sm:text-sm text-sky-100">
                      <div className="rounded-2xl bg-sky-900/60 border border-sky-700/70 px-2 py-3">
                        <p className="text-xs text-sky-300 mb-1">عدد الدورات</p>
                        <p className="text-lg sm:text-xl font-bold">
                          {totalCourses}+
                        </p>
                      </div>
                      <div className="rounded-2xl bg-sky-900/60 border border-sky-700/70 px-2 py-3">
                        <p className="text-xs text-sky-300 mb-1">طلاب نشطون</p>
                        <p className="text-lg sm:text-xl font-bold">1,000+</p>
                      </div>
                      <div className="rounded-2xl bg-sky-900/60 border border-sky-700/70 px-2 py-3">
                        <p className="text-xs text-sky-300 mb-1">تقييم عام</p>
                        <p className="text-lg sm:text-xl font-bold flex items-center justify-center gap-1">
                          4.9{" "}
                          <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                        </p>
                      </div>
                    </div>

                    {/* <div className="rounded-2xl bg-sky-900/70 border border-sky-700/80 px-3 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                      <div className="space-y-0.5">
                        <p className="font-medium text-white">
                          ابدأ من الصفر أو طوّر مسارك المهني
                        </p>
                        <p className="text-sky-200 text-[11px] sm:text-xs">
                          دورات في البرمجة، الصحة، الأعمال، التصميم والمزيد.
                        </p>
                      </div>
                      <Link
                        href="/courses"
                        className="rounded-xl bg-emerald-400/90 px-3 py-2 text-xs font-semibold text-sky-950 hover:bg-emerald-300 transition"
                      >
                        تصفح الدورات
                      </Link>
                    </div> */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= STATS ================= */}
      

      {/* ================= FEATURES ================= */}
      <section className="bg-gray-50 py-10 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-1.5 text-xs sm:text-sm font-medium text-sky-900 mb-3">
              <Sparkles className="h-4 w-4" />
              <span>لماذا تختار اقْرَأْ؟</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              كل ما تحتاجه لتطوّر مهاراتك في مكان واحد
            </h2>
            <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
              صممنا المنصة لتكون بسيطة، واضحة، ومناسبة لسرعة الإنترنت وأجهزة
              المستخدمين في العراق.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="rounded-2xl bg-white border border-gray-100 px-5 py-6 sm:px-6 sm:py-7 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900">
                محاضرون متميزون
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                تعلم من خبراء عراقيين وعرب لديهم خبرة عملية حقيقية في تخصصاتهم.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 px-5 py-6 sm:px-6 sm:py-7 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900">
                مرونة كاملة في التعلم
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                شاهد الدروس من الجوال أو اللابتوب، وقت ما تريد، وبالسرعة التي
                تناسبك.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 px-5 py-6 sm:px-6 sm:py-7 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900">
                محتوى عملي واضح
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                تركيز على التطبيقات العملية والأمثلة الواقعية بدل الكلام النظري
                فقط.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 px-5 py-6 sm:px-6 sm:py-7 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 text-white">
                <Star className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900">
                تجربة مريحة وبسيطة
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                واجهة عربية، مرتبة وبسيطة، بدون عناصر مزعجة أو معقدة.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 px-5 py-6 sm:px-6 sm:py-7 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 text-white">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900">
                مجتمع متعلمين ومحاضرين
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                تواصل مع محاضرين وطلاب آخرين، وابقَ على اطلاع بآخر الدورات
                والتحديثات.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 px-5 py-6 sm:px-6 sm:py-7 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-500 text-white">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900">
                أسعار وطرق دفع مناسبة
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                أسعار مدروسة وطرق دفع محلية مثل ZainCash والمحفظة داخل المنصة.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= COURSES ================= */}
      <section className="bg-white py-10 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-xs sm:text-sm font-medium text-emerald-900 mb-3">
              <Star className="h-4 w-4" />
              <span>دورات مختارة لك</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              ابدأ من أكثر الدورات طلباً
            </h2>
            <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
              اختر دورة تناسب هدفك الحالي، سواء كان بداية جديدة أو تطوير مهارة
              موجودة.
            </p>
          </div>

          <HomeCoursesSection initialCourses={courses} />

          {/* <div className="mt-10 text-center">
            <Button
              asChild
              size="lg"
              className="rounded-xl bg-gradient-to-l from-sky-600 to-emerald-600 text-white font-semibold px-8 py-4 text-sm sm:text-base shadow-lg hover:shadow-xl hover:from-sky-700 hover:to-emerald-700 transition-all"
            >
              <Link href="/courses" className="flex items-center gap-2">
                عرض جميع الدورات
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div> */}
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="bg-gradient-to-b from-sky-900 via-sky-900 to-sky-950 text-white py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center space-y-5">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
              جاهز لتخطو الخطوة الأولى نحو مستقبل أفضل؟
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-sky-100/90 leading-relaxed">
              أنشئ حسابك خلال ثوانٍ، وابدأ بالتعلم من أفضل المحاضرين في العراق
              والعالم العربي، مع دعم كامل وواجهة عربية بسيطة.
            </p>
            {/* <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto rounded-xl bg-white text-sky-900 font-bold text-sm sm:text-base px-8 py-4 shadow-xl hover:bg-sky-50 transition-all"
              >
                <Link href="/auth/register" className="flex items-center gap-2">
                  سجل مجاناً الآن
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full sm:w-auto rounded-xl border border-sky-200/70 bg-transparent text-sky-50 hover:bg-white hover:text-sky-900 font-semibold text-sm sm:text-base px-8 py-4 transition-all"
              >
                <Link href="/courses">تصفح الدورات</Link>
              </Button>
            </div> */}
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="bg-gray-950 text-white pt-8 sm:pt-10 pb-6">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 max-w-5xl mx-auto mb-8">
            {/* Brand */}
            <div className="text-center md:text-right space-y-3">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold">اقْرَأْ</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                منصة تعليمية عربية، تهدف لتقديم محتوى عملي وعالي الجودة يناسب
                سوق العمل في العراق والعالم العربي.
              </p>
              <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-gray-400">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span>موثوق من مئات الطلاب والمحاضرين</span>
              </div>
            </div>

            {/* Contact */}
            <div className="text-center md:text-right space-y-3">
              <h4 className="flex items-center justify-center md:justify-start gap-2 text-sm sm:text-base font-semibold mb-1">
                <Mail className="h-4 w-4 text-sky-400" />
                تواصل معنا
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-gray-400">
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
                    <span>0770 270 6976</span>
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
                    <span>0788 655 2919</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Social + payments */}
            <div className="text-center md:text-right space-y-3">
              <h4 className="text-sm sm:text-base font-semibold mb-1">
                تابعنا
              </h4>
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
                <p className="text-xs sm:text-sm text-gray-300 font-medium">
                  طرق الدفع المتوفرة:
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 text-xs sm:text-sm">
                  <span className="rounded-lg bg-gradient-to-l from-purple-600 to-pink-600 px-3 py-1 font-semibold">
                    ZainCash
                  </span>
                  <span className="rounded-lg bg-gradient-to-l from-emerald-600 to-teal-600 px-3 py-1 font-semibold">
                    المحفظة داخل المنصة
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4 mt-2">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-[11px] sm:text-xs text-gray-500">
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
