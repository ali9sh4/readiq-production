"use client";

import Link from "next/link";
import { BookOpen, PlusCircle, User, Menu, X, Monitor } from "lucide-react";
import { AuthButton } from "@/components/Authbutton";
import WalletBalance from "@/components/WalletBalance";
import { useAuth } from "@/context/authContext";
import { useState, useEffect } from "react";
import ProtectedLink from "./ProtectedLink";

export default function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleCreateCourseClick = (e: React.MouseEvent) => {
    if (isMobile) {
      e.preventDefault();
      const confirmed = window.confirm(
        "💡 للحصول على أفضل تجربة في إنشاء الدورات، يُنصح باستخدام جهاز iPad أو كمبيوتر محمول.\n\nهل تريد المتابعة على الهاتف؟"
      );
      if (confirmed) {
        window.location.href = "/course-upload";
      }
    }
  };

  return (
    <nav className="bg-sky-900 text-white shadow-xl border-b border-sky-800/50 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 lg:gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center" dir="ltr">
              <span
                className="text-2xl lg:text-4xl font-extrabold"
                style={{ color: "#E53935" }}
              >
                R
              </span>
              <span
                className="text-2xl lg:text-4xl font-extrabold"
                style={{ color: "white" }}
              >
                u
              </span>
              <span
                className="text-2xl lg:text-4xl font-extrabold"
                style={{ color: "white" }}
              >
                b
              </span>
              <span
                className="text-2xl lg:text-4xl font-extrabold"
                style={{ color: "white" }}
              >
                i
              </span>
              <span
                className="text-2xl lg:text-4xl font-extrabold"
                style={{ color: "#FDD835" }}
              >
                k
              </span>
            </div>
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

            <ProtectedLink
              href="/user_dashboard"
              className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 
  backdrop-blur-sm rounded-lg border border-white/20"
            >
              <BookOpen className="h-4 w-4 hidden sm:inline-block" />
              <span>دوراتي</span>
            </ProtectedLink>

            <ProtectedLink
              href="/course-upload"
              onClick={handleCreateCourseClick}
              className="flex items-center gap-2 px-3 py-2 bg-white text-sky-900
  rounded-lg shadow-md hover:bg-gray-100"
            >
              <PlusCircle className="h-4 w-4 hidden sm:inline-block" />
              <span>إنشاء دورة</span>
            </ProtectedLink>
            <ProtectedLink
              href="/user_dashboard/profile"
              className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 
  backdrop-blur-sm rounded-lg border border-white/20"
            >
              <User className="h-4 w-4 hidden sm:inline-block" />
              <span>ملفي الشخصي</span>
            </ProtectedLink>

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

            <ProtectedLink
              href="/user_dashboard"
              className="flex items-center gap-2 px-3 py-3 bg-white/10 rounded-lg border border-white/20"
              onClick={() => setOpen(false)}
            >
              <BookOpen size={18} />
              دوراتي
            </ProtectedLink>

            <ProtectedLink
              href="/course-upload"
              className="flex items-center gap-2 px-3 py-3 bg-white text-sky-900 rounded-lg shadow-md"
              onClick={(e) => {
                setOpen(false);
                handleCreateCourseClick(e);
              }}
            >
              <PlusCircle size={18} />
              إنشاء دورة
            </ProtectedLink>

            <ProtectedLink
              href="/user_dashboard/profile"
              className="flex items-center gap-2 px-3 py-3 bg-white/10 rounded-lg border border-white/20"
              onClick={() => setOpen(false)}
            >
              <User size={18} />
              ملفي الشخصي
            </ProtectedLink>

            <div onClick={() => setOpen(false)}>
              <AuthButton />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
