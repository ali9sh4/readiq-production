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
  BookOpen,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Image from "next/image";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/user_dashboard", label: "الرئيسية", icon: Home },
  { href: "/user_dashboard/profile", label: "الملف الشخصي", icon: User },
  { href: "/user_dashboard/certificates", label: "الشهادات", icon: Award },
];

// Sidebar Content Component (reused for mobile and desktop)
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
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
            <Link key={item.href} href={item.href} onClick={onNavigate}>
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
        <Link href="/" onClick={onNavigate}>
          <Button variant="ghost" className="w-full justify-start">
            <Settings className="h-4 w-4 ml-2" />
            العودة للموقع
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600"
          onClick={() => {
            onNavigate?.();
            auth.logOut();
          }}
        >
          <LogOut className="h-4 w-4 ml-2" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [open, setOpen] = useState(false);
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
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      {/* Desktop Sidebar - Hidden on mobile, visible on sm+ */}
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
        {/* Mobile Header with Sheet */}
        <header className="sm:hidden bg-white border-b px-4 py-3 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <h1 className="text-lg font-bold text-gray-900">لوحة التحكم</h1>
            </div>

            {/* Mobile Menu Sheet */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0">
                <SheetHeader className="p-6 border-b">
                  <SheetTitle>لوحة التحكم</SheetTitle>
                </SheetHeader>
                <SidebarContent onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
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
