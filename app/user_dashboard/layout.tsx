"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/authContext";
import {
  Home,
  User,
  Award,
  Menu,
  X,
  BookOpen,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Image from "next/image";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  {
    href: "/user_dashboard",
    label: "الرئيسية",
    icon: Home,
  },
  {
    href: "/user_dashboard/profile",
    label: "الملف الشخصي",
    icon: User,
  },
  {
    href: "/user_dashboard/certificates",
    label: "الشهادات",
    icon: Award,
  },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const auth = useAuth();

  if (!auth.isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 text-center">
          <CardContent>
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">يرجى تسجيل الدخول</h2>
            <p className="text-gray-600 mb-4">
              تحتاج إلى تسجيل الدخول للوصول إلى لوحة التحكم
            </p>
            <Link href="/login">
              <Button>تسجيل الدخول</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 flex"
      dir="rtl"
    >
      {/* Mobile Menu Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed inset-y-0 right-0 z-50 w-[280px] sm:w-80 lg:w-72 xl:w-80 bg-white shadow-2xl transform transition-all duration-300 ease-out lg:translate-x-0 lg:static lg:inset-0 border-l border-gray-100
        ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
      `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">
              لوحة التحكم
            </h1>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* User Info */}
          <div className="p-4 sm:p-6 border-b bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-100/50 via-transparent to-transparent"></div>
            <div className="relative flex items-center space-x-3 space-x-reverse">
              <Avatar className="h-12 w-12 sm:h-14 sm:w-14 ring-2 ring-white shadow-lg">
                {auth.user.photoURL && (
                  <Image
                    src={auth.user.photoURL}
                    alt="صورة المستخدم"
                    width={56}
                    height={56}
                    className="rounded-full object-cover"
                  />
                )}
                <AvatarFallback className="text-lg sm:text-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold">
                  {auth.user.displayName?.charAt(0) || "ع"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-bold text-gray-900 truncate">
                  {auth.user.displayName || "مستخدم"}
                </p>
                <p className="text-xs text-gray-600 truncate">
                  {auth.user.email}
                </p>
                {!!auth?.CustomClaims?.admin && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-500 to-indigo-600 text-white mt-1.5 shadow-sm">
                    👑 مدير
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 sm:p-4 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={`
                    group flex items-center space-x-3 space-x-reverse px-4 py-3.5 rounded-2xl transition-all duration-200 cursor-pointer
                    ${
                      isActive
                        ? "bg-gradient-to-l from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                        : "text-gray-700 hover:bg-gradient-to-l hover:from-gray-50 hover:to-blue-50 hover:text-blue-600 hover:shadow-md active:scale-95"
                    }
                  `}
                  >
                    <div
                      className={`p-1.5 rounded-lg ${
                        isActive ? "bg-white/20" : "group-hover:bg-blue-50"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 transition-transform group-hover:scale-110 ${
                          isActive
                            ? "text-white"
                            : "text-gray-600 group-hover:text-blue-600"
                        }`}
                      />
                    </div>
                    <span
                      className={`font-semibold text-sm sm:text-base ${
                        isActive ? "text-white" : ""
                      }`}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <div className="mr-auto">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer Actions */}
          <div className="p-3 sm:p-4 border-t bg-gray-50/50 space-y-2">
            <Link href="/">
              <Button
                variant="ghost"
                className="w-full justify-start space-x-reverse hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 group py-3 rounded-xl"
              >
                <div className="p-1.5 rounded-lg group-hover:bg-blue-100 transition-colors">
                  <Settings className="h-4 w-4 ml-2" />
                </div>
                <span className="font-medium">العودة للموقع</span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start space-x-reverse text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200 group py-3 rounded-xl active:scale-95"
              onClick={auth.logOut}
            >
              <div className="p-1.5 rounded-lg group-hover:bg-red-100 transition-colors">
                <LogOut className="h-4 w-4 ml-2" />
              </div>
              <span className="font-medium">تسجيل الخروج</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white/80 backdrop-blur-lg shadow-sm border-b border-gray-100/50 px-4 py-3 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">لوحة التحكم</h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="hover:bg-blue-50 active:scale-95 transition-all duration-200 rounded-xl p-2"
            >
              <Menu className="h-5 w-5 text-gray-700" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
