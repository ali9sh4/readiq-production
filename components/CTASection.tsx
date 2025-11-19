"use client";

import { useAuth } from "@/context/authContext";
import NavigationButton from "@/components/NavigationButton";
import { ArrowLeft } from "lucide-react";

export default function CTASection() {
  const { user, isLoading } = useAuth();

  // Don't render if user is logged in
  if (user || isLoading) {
    return null;
  }

  return (
    <section className="relative bg-sky-900 text-white py-12 md:py-16 overflow-hidden">
      {/* Dark overlay for better text contrast on tablets */}
      <div className="pointer-events-none absolute inset-0 bg-sky-950/30 md:bg-sky-950/50"></div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold drop-shadow-lg md:drop-shadow-2xl">
            جاهز لتخطو الخطوة الأولى نحو مستقبل أفضل؟
          </h2>
          <p className="text-base md:text-lg text-sky-100/90 md:text-white leading-relaxed drop-shadow-md md:drop-shadow-xl">
            أنشئ حسابك خلال ثوانٍ، وابدأ بالتعلم من أفضل المحاضرين في العراق
            والعالم العربي، مع دعم كامل وواجهة عربية بسيطة.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <NavigationButton
              href="/register"
              size="lg"
              className="w-full sm:w-auto rounded-xl bg-white text-sky-900 hover:bg-gray-100 font-bold text-base px-8 h-12 shadow-xl transition-all flex items-center gap-2 justify-center"
              icon={<ArrowLeft className="h-5 w-5" />}
            >
              إنشاء حساب
            </NavigationButton>
          </div>
        </div>
      </div>
    </section>
  );
}
