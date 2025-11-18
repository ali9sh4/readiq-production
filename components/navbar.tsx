"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, PlusCircle, User, Menu, X } from "lucide-react";
import { AuthButton } from "@/components/Authbutton";
import WalletBalance from "@/components/WalletBalance";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="bg-gradient-to-r from-sky-900 to-sky-950 text-white shadow-xl border-b border-sky-800/50 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo Section */}
          <Link
            href="/"
            className="flex items-center gap-2 md:gap-3 group"
            onClick={closeMobileMenu}
          >
            <span className="text-2xl md:text-4xl font-extrabold tracking-wide text-white group-hover:text-sky-200 transition-all duration-300 drop-shadow-lg">
              اقْرَأْ
            </span>
            <span className="hidden sm:block text-xs md:text-sm text-sky-200 font-light opacity-80 group-hover:opacity-100 transition-opacity duration-300">
              منصة القراءة العربية
            </span>
          </Link>

          {/* Desktop Navigation - Show on large screens only */}
          <ul className="hidden lg:flex items-center gap-3">
            <li>
              <Link
                href="/wallet/topup"
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold border border-white/20 hover:border-white/30 hover:scale-105"
              >
                <WalletBalance />
              </Link>
            </li>

            <li>
              <Link
                href="/user_dashboard"
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold border border-white/20 hover:border-white/30 hover:scale-105"
              >
                <BookOpen className="h-4 w-4" />
                <span>دوراتي</span>
              </Link>
            </li>

            <li>
              <Link
                href="/course-upload"
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-sky-900 hover:bg-gray-100 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold hover:scale-105"
              >
                <PlusCircle className="h-4 w-4" />
                <span>إنشاء دورة</span>
              </Link>
            </li>

            <li>
              <Link
                href="/user_dashboard/profile"
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold border border-white/20 hover:border-white/30 hover:scale-105"
              >
                <User className="h-4 w-4" />
                <span>ملفي الشخصي</span>
              </Link>
            </li>

            <li>
              <AuthButton />
            </li>
          </ul>

          {/* Mobile Menu Button - Show on tablets and mobile */}
          <button
            onClick={toggleMobileMenu}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="القائمة"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Menu - Show on tablets and mobile */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeMobileMenu}
      />

      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-gradient-to-br from-sky-900 to-sky-950 shadow-2xl z-50 lg:hidden transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Mobile Menu Header */}
          <div className="flex items-center justify-between p-6 border-b border-sky-800/50">
            <h2 className="text-2xl font-bold text-white">القائمة</h2>
            <button
              onClick={closeMobileMenu}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="إغلاق"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Mobile Navigation Links */}
          <div className="flex-1 overflow-y-auto p-6">
            <ul className="space-y-4">
              <li>
                <Link
                  href="/wallet/topup"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-300 font-semibold border border-white/20"
                >
                  <WalletBalance />
                </Link>
              </li>

              <li>
                <Link
                  href="/user_dashboard"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-300 font-semibold border border-white/20"
                >
                  <BookOpen className="h-5 w-5" />
                  <span>دوراتي</span>
                </Link>
              </li>

              <li>
                <Link
                  href="/course-upload"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3 px-4 py-3 bg-white text-sky-900 hover:bg-gray-100 rounded-xl transition-all duration-300 font-semibold"
                >
                  <PlusCircle className="h-5 w-5" />
                  <span>إنشاء دورة</span>
                </Link>
              </li>

              <li>
                <Link
                  href="/user_dashboard/profile"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-300 font-semibold border border-white/20"
                >
                  <User className="h-5 w-5" />
                  <span>ملفي الشخصي</span>
                </Link>
              </li>

              <li className="pt-4 border-t border-sky-800/50">
                <AuthButton />
              </li>
            </ul>
          </div>

          {/* Mobile Menu Footer */}
          <div className="p-6 border-t border-sky-800/50">
            <p className="text-sm text-sky-200 text-center">
              منصة القراءة العربية
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}
