"use client";

import Link from "next/link";
import { BookOpen, PlusCircle, User, Menu, X } from "lucide-react";
import { AuthButton } from "@/components/Authbutton";
import WalletBalance from "@/components/WalletBalance";
import { useAuth } from "@/context/authContext";
import { useState } from "react";

export default function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-sky-900 text-white shadow-xl border-b border-sky-800/50 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 lg:gap-3">
            <span className="text-2xl lg:text-4xl font-extrabold">اقْرَأْ</span>
            <span className="hidden sm:block text-xs lg:text-sm text-sky-200 opacity-80">
              منصة القراءة العربية
            </span>
          </Link>

          {/* Desktop Nav — Hidden on mobile */}
          <ul className="hidden sm:flex items-center gap-2 lg:gap-3">
            {user && (
              <li>
                <Link
                  href="/wallet/topup"
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 
                  hover:bg-white/20 backdrop-blur-sm rounded-lg border border-white/20"
                >
                  <WalletBalance />
                </Link>
              </li>
            )}

            <li>
              <Link
                href="/user_dashboard"
                className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 
                backdrop-blur-sm rounded-lg border border-white/20"
              >
                <BookOpen className="h-4 w-4 hidden sm:inline-block" />
                <span>دوراتي</span>
              </Link>
            </li>

            <li>
              <Link
                href="/course-upload"
                className="flex items-center gap-2 px-3 py-2 bg-white text-sky-900 
                rounded-lg shadow-md hover:bg-gray-100"
              >
                <PlusCircle className="h-4 w-4 hidden sm:inline-block" />
                <span>إنشاء دورة</span>
              </Link>
            </li>

            <li>
              <Link
                href="/user_dashboard/profile"
                className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 
                backdrop-blur-sm rounded-lg border border-white/20"
              >
                <User className="h-4 w-4 hidden sm:inline-block" />
                <span>ملفي الشخصي</span>
              </Link>
            </li>

            <li>
              <AuthButton />
            </li>
          </ul>

          {/* Mobile Hamburger button */}
          <button
            className="sm:hidden p-2 text-white"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {open && (
          <div className="sm:hidden flex flex-col gap-3 pb-4 animate-in fade-in slide-in-from-top-2">
            {user && (
              <Link
                href="/wallet/topup"
                className="flex items-center gap-2 px-3 py-3 bg-white/10 rounded-lg border border-white/20"
                onClick={() => setOpen(false)}
              >
                <WalletBalance />
              </Link>
            )}

            <Link
              href="/user_dashboard"
              className="flex items-center gap-2 px-3 py-3 bg-white/10 rounded-lg border border-white/20"
              onClick={() => setOpen(false)}
            >
              <BookOpen size={18} />
              دوراتي
            </Link>

            <Link
              href="/course-upload"
              className="flex items-center gap-2 px-3 py-3 bg-white text-sky-900 rounded-lg shadow-md"
              onClick={() => setOpen(false)}
            >
              <PlusCircle size={18} />
              إنشاء دورة
            </Link>

            <Link
              href="/user_dashboard/profile"
              className="flex items-center gap-2 px-3 py-3 bg-white/10 rounded-lg border border-white/20"
              onClick={() => setOpen(false)}
            >
              <User size={18} />
              ملفي الشخصي
            </Link>

            <div onClick={() => setOpen(false)}>
              <AuthButton />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
