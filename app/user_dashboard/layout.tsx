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
];

// Sidebar Content Component (desktop only)
function SidebarContent() {
  const pathname = usePathname();
  const auth = useAuth();

  return (
    <div className="flex flex-col h-full">
      {/* User Info */}
      <div className="p-6 border-b bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-50">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 ring-2 ring-blue-200 shadow-lg hover:ring-blue-300 transition-all">
            {auth.user?.photoURL ? (
              <Image
                src={auth.user.photoURL}
                alt="User"
                width={56}
                height={56}
                className="rounded-full object-cover"
              />
            ) : (
              <AvatarFallback className="text-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white font-semibold">
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
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white mt-1.5 shadow-sm">
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
                  transform active:scale-[0.98] select-none
                  ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-500/20"
                      : "text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:text-blue-600 hover:shadow-md active:shadow-inner"
                  }
                `}
              >
                <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                <span className="font-semibold text-sm">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t space-y-2">
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start hover:bg-gray-100 active:scale-[0.98] transition-transform">
            <Settings className="h-4 w-4 ml-2" />
            العودة للموقع
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 active:scale-[0.98] transition-transform"
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
    return "home";
  };

  if (!auth.isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="p-8 text-center max-w-md w-full">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex" dir="rtl">
      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden sm:block w-[280px] bg-white border-l border-gray-200 shadow-2xl">
        <div className="sticky top-0 h-screen">
          <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-indigo-600">
            <h1 className="text-xl font-bold text-white">لوحة التحكم</h1>
          </div>
          <SidebarContent />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Tabs - Only visible on mobile */}
        <div className="sm:hidden bg-white border-b sticky top-16 z-20 px-3 pt-3 pb-2">
          <Tabs value={getActiveTab()} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl h-12 p-1 shadow-md">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = getActiveTab() === item.value;
                return (
                  <Link key={item.value} href={item.href} className="w-full">
                    <TabsTrigger
                      value={item.value}
                      className={`w-full text-xs font-semibold text-gray-600 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95
                        data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-600 data-[state=active]:to-blue-700
                        data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/40
                        data-[state=active]:ring-2 data-[state=active]:ring-blue-500/30
                        hover:bg-blue-50 hover:text-blue-600`}
                    >
                      <Icon className={`h-4 w-4 transition-transform ${isActive ? "scale-110" : ""}`} />
                      <span className="hidden xs:inline">{item.label}</span>
                    </TabsTrigger>
                  </Link>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden pb-safe">
          {children}
        </main>
      </div>
    </div>
  );
}
