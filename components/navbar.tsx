"use client";

import Link from "next/link";
import { BookOpen, PlusCircle, User } from "lucide-react";
import { AuthButton } from "@/components/Authbutton";
import WalletBalance from "@/components/WalletBalance";
import { useAuth } from "@/context/authContext";

export default function Navbar() {
  const { user } = useAuth();

  return (
    <nav className="bg-sky-900 text-white shadow-xl border-b border-sky-800/50 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo Section */}
          <Link href="/" className="flex items-center gap-2 lg:gap-3 group">
            <span className="text-2xl lg:text-4xl font-extrabold tracking-wide text-white group-hover:text-sky-200 transition-all duration-300 drop-shadow-lg">
              اقْرَأْ
            </span>
            <span className="hidden sm:block text-xs lg:text-sm text-sky-200 font-light opacity-80 group-hover:opacity-100 transition-opacity duration-300">
              منصة القراءة العربية
            </span>
          </Link>

          {/* Desktop Navigation - Always visible */}
          <ul className="flex items-center gap-2 lg:gap-3">
            {/* Wallet - Only show if logged in */}
            {user && (
              <li>
                <Link
                  href="/wallet/topup"
                  className="flex items-center gap-1.5 lg:gap-2 px-3 py-2 lg:px-5 lg:py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg lg:rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold border border-white/20 hover:border-white/30 hover:scale-105 text-sm lg:text-base"
                >
                  <WalletBalance />
                </Link>
              </li>
            )}

            <li>
              <Link
                href="/user_dashboard"
                className="flex items-center gap-1.5 lg:gap-2 px-3 py-2 lg:px-5 lg:py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg lg:rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold border border-white/20 hover:border-white/30 hover:scale-105 text-sm lg:text-base"
              >
                <BookOpen className="h-4 w-4 hidden sm:inline-block" />
                <span>دوراتي</span>
              </Link>
            </li>

            <li>
              <Link
                href="/course-upload"
                className="flex items-center gap-1.5 lg:gap-2 px-3 py-2 lg:px-5 lg:py-2.5 bg-white text-sky-900 hover:bg-gray-100 rounded-lg lg:rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold hover:scale-105 text-sm lg:text-base"
              >
                <PlusCircle className="h-4 w-4 hidden sm:inline-block" />
                <span>إنشاء دورة</span>
              </Link>
            </li>

            <li>
              <Link
                href="/user_dashboard/profile"
                className="flex items-center gap-1.5 lg:gap-2 px-3 py-2 lg:px-5 lg:py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg lg:rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold border border-white/20 hover:border-white/30 hover:scale-105 text-sm lg:text-base"
              >
                <User className="h-4 w-4 hidden sm:inline-block" />
                <span>ملفي الشخصي</span>
              </Link>
            </li>

            <li>
              <AuthButton />
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
