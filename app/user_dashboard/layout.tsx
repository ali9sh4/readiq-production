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
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Mobile Menu Overlay - Only for mobile (< 768px) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar - Only visible on mobile (< 768px) */}
      <div
        className={`
        fixed inset-y-0 right-0 z-50 w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out md:hidden
        ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
      `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h1 className="text-xl font-bold text-gray-900">لوحة التحكم</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* User Info */}
          <div className="p-6 border-b bg-gradient-to-l from-blue-50 to-indigo-50">
            <div className="flex items-center space-x-3 space-x-reverse">
              <Avatar className="h-12 w-12">
                {auth.user.photoURL && (
                  <Image
                    src={auth.user.photoURL}
                    alt="صورة المستخدم"
                    width={48}
                    height={48}
                    className="rounded-full object-cover"
                  />
                )}
                <AvatarFallback className="text-lg">
                  {auth.user.displayName?.charAt(0) || "ع"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {auth.user.displayName || "مستخدم"}
                </p>
                <p className="text-xs text-gray-600 truncate">
                  {auth.user.email}
                </p>
                {!!auth?.CustomClaims?.admin && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                    مدير
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}>
                  <div
                    className={`
                    flex items-center space-x-3 space-x-reverse px-4 py-3 rounded-xl transition-all duration-200
                    ${
                      isActive
                        ? "bg-blue-50 text-blue-700 border-l-4 border-blue-700"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                    }
                  `}
                  >
                    <Icon
                      className={`h-5 w-5 ${isActive ? "text-blue-700" : ""}`}
                    />
                    <span className="font-medium">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer Actions */}
          <div className="p-4 border-t space-y-2">
            <Link href="/">
              <Button
                variant="ghost"
                className="w-full justify-start space-x-reverse"
              >
                <Settings className="h-4 w-4 ml-2" />
                العودة للموقع
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start space-x-reverse text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={auth.logOut}
            >
              <LogOut className="h-4 w-4 ml-2" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </div>

      {/* Tablet/Desktop Horizontal Navigation - Visible on tablets and up (>= 768px) */}
      <div className="hidden md:block bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Title & User Info */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">لوحة التحكم</h1>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                <Avatar className="h-8 w-8">
                  {auth.user.photoURL && (
                    <Image
                      src={auth.user.photoURL}
                      alt="صورة المستخدم"
                      width={32}
                      height={32}
                      className="rounded-full object-cover"
                    />
                  )}
                  <AvatarFallback className="text-sm">
                    {auth.user.displayName?.charAt(0) || "ع"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-gray-700">
                  {auth.user.displayName || "مستخدم"}
                </span>
              </div>
            </div>

            {/* Horizontal Navigation */}
            <nav className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={`flex items-center gap-2 ${
                        isActive
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "text-gray-700 hover:text-blue-600 hover:bg-blue-50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                );
              })}

              <div className="h-6 w-px bg-gray-200 mx-2"></div>

              <Link href="/">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  <span>الموقع</span>
                </Button>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={auth.logOut}
              >
                <LogOut className="h-4 w-4" />
                <span>خروج</span>
              </Button>
            </nav>
          </div>
        </div>
      </div>

      {/* Mobile Header - Only visible on mobile (< 768px) */}
      <header className="md:hidden bg-white shadow-sm border-b px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">لوحة التحكم</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Page Content */}
      <main className="container mx-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
