import Link from "next/link";
import {
  Mail,
  Phone,
  Instagram,
  Facebook,
  Twitter,
  CheckCircle,
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-white pt-10 pb-6">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 max-w-5xl mx-auto mb-8">
          {/* Brand */}
          <div className="text-center md:text-right space-y-3">
            <div className="flex items-center justify-center md:justify-start gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/rubik-logo.png" alt="Rubik" className="h-10 w-10" />
              <h3 className="text-xl font-bold">Rubik</h3>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              منصة تعليمية عربية، تهدف لتقديم محتوى علمي و عملي عالي الجودة
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
                  href="mailto:privacy@rubiktech.org"
                  className="flex items-center justify-center md:justify-start gap-2 hover:text-white transition"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
                    <Mail className="h-4 w-4" />
                  </div>
                  <span>privacy@rubiktech.org</span>
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
              © {new Date().getFullYear()} Rubik – جميع الحقوق محفوظة.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/support"
                className="hover:text-gray-300 transition"
              >
                الدعم
              </Link>
              <span>•</span>
              <Link
                href="/privacy-policy"
                className="hover:text-gray-300 transition"
              >
                سياسة الخصوصية
              </Link>
              <span>•</span>
              <Link
                href="/terms"
                className="hover:text-gray-300 transition"
              >
                الشروط والأحكام
              </Link>
              <span>•</span>
              <Link
                href="/cookie-policy"
                className="hover:text-gray-300 transition"
              >
                سياسة ملفات تعريف الارتباط
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
