"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/authContext";
import { Home, User, Award, BookOpen, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import NavigationButton from "@/components/NavigationButton";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/user_dashboard", label: "الرئيسية", icon: Home, value: "home" },
  {
    href: "/user_dashboard/profile",
    label: "الملف الشخصي",
    icon: User,
    value: "profile",
  },
  {
    href: "/user_dashboard/certificates",
    label: "الشهادات",
    icon: Award,
    value: "certificates",
  },
  {
    href: "/user_dashboard/createdCourses",
    label: "دوراتي المنشأة",
    icon: BookOpen,
    value: "createdCourses",
  },
  {
    href: "/user_dashboard/updatePassword",
    label: "تحديث كلمة المرور",
    icon: Settings,
    value: "updatePassword",
  },
];

// Sidebar Content Component (desktop only)
function SidebarContent() {
  const pathname = usePathname();
  const auth = useAuth();

  return (
    <div className="flex flex-col h-full">
      {/* User Info */}
      <div className="p-6 border-b bg-blue-50">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 ring-2 ring-white shadow-lg">
            {auth.user?.photoURL ? (
              <Image
                src={auth.user.photoURL}
                alt="User"
                width={56}
                height={56}
                className="rounded-full object-cover"
              />
            ) : (
              <AvatarFallback className="text-xl bg-blue-600 text-white font-semibold">
                {auth.user?.displayName?.charAt(0) || "ع"}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">
              {auth.user?.displayName || "مستخدم"}
            </p>
            <p className="text-xs text-gray-600 truncate">{auth.user?.email}</p>
            {!!auth?.CustomClaims?.admin && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white mt-1.5">
                👑 مدير
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`
                  flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 cursor-pointer
                  ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg"
                      : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                <span className="font-semibold text-sm">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t space-y-2">
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start">
            <Settings className="h-4 w-4 ml-2" />
            العودة للموقع
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600"
          onClick={() => auth.logOut()}
        >
          <LogOut className="h-4 w-4 ml-2" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const auth = useAuth();

  // Determine active tab based on current path
  const getActiveTab = () => {
    if (pathname === "/user_dashboard") return "home";
    if (pathname === "/user_dashboard/profile") return "profile";
    if (pathname === "/user_dashboard/certificates") return "certificates";
    if (pathname.startsWith("/user_dashboard/createdCourses"))
      return "createdCourses";
    if (pathname === "/user_dashboard/updatePassword") return "updatePassword"; // ✅ Add this

    return "home";
  };

  if (!auth.isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden sm:block w-[280px] bg-white border-l border-gray-100 shadow-xl">
        <div className="sticky top-0 h-screen">
          <div className="p-6 border-b">
            <h1 className="text-xl font-bold text-gray-900">لوحة التحكم</h1>
          </div>
          <SidebarContent />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Tabs - Only visible on mobile */}
        <div className="sm:hidden bg-white border-b sticky top-16 z-20 px-3 pt-3">
          <Tabs value={getActiveTab()} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-50 border border-gray-200 rounded-xl h-12 p-1 shadow-sm">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.value} href={item.href} className="w-full">
                    <TabsTrigger
                      value={item.value}
                      className="w-full text-xs font-semibold text-gray-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden xs:inline">{item.label}</span>
                    </TabsTrigger>
                  </Link>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
