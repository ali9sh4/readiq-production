"use client";

import { useState, useEffect } from "react";
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
  { href: "/user_dashboard", label: "الرئيسية", icon: Home },
  { href: "/user_dashboard/profile", label: "الملف الشخصي", icon: User },
  { href: "/user_dashboard/certificates", label: "الشهادات", icon: Award },
];

/* ----------------------------------------------------------
   UNIVERSAL TABLET DETECTION (iPad + Samsung + Xiaomi + etc.)
----------------------------------------------------------- */
function isTabletDevice() {
  if (typeof window === "undefined") return false;

  const w = window.innerWidth;
  const h = window.innerHeight;

  const isTouch = window.matchMedia("(pointer: coarse)").matches;

  return (
    isTouch &&
    (w >= 600 || h >= 600) && // not phones
    w < 1400 &&
    h < 1400 // not desktops
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const pathname = usePathname();
  const auth = useAuth();

  /* Detect tablet on mount */
  useEffect(() => {
    setIsTablet(isTabletDevice());
  }, []);

  /* Auto close menu on route change */
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  /* ESC to close */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  /* Disable scroll when sidebar open on phones */
  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 600) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [sidebarOpen]);

  const closeSidebar = () => setSidebarOpen(false);
  const openSidebar = () => setSidebarOpen(true);

  /* ----------------------------------------------------------
     Authentication Handling
  ----------------------------------------------------------- */
  if (!auth.isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="p-6 sm:p-8 text-center max-w-md w-full">
          <CardContent>
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg sm:text-xl font-semibold mb-2">
              يرجى تسجيل الدخول
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
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

  /* ----------------------------------------------------------
     LAYOUT
  ----------------------------------------------------------- */
  return (
    <div className="min-h-screen flex bg-background" dir="rtl">
      {/* Overlay (phones only) */}
      {sidebarOpen && !isTablet && (
        <div
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 right-0 z-50 w-[260px] bg-card border-l border-border
          transition-transform duration-300 ease-out p-0

          ${isTablet ? "translate-x-0 static" : ""}

          ${
            sidebarOpen
              ? "translate-x-0"
              : "translate-x-full sm:translate-x-0 sm:static"
          }
        `}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h1 className="text-lg font-bold text-foreground">لوحة التحكم</h1>

            {/* X button for phones only */}
            {!isTablet && (
              <button
                className="p-2 sm:hidden rounded-lg"
                onClick={closeSidebar}
              >
                <X className="h-5 w-5 text-foreground" />
              </button>
            )}
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {auth.user.photoURL ? (
                  <Image
                    src={auth.user.photoURL}
                    alt="User"
                    width={48}
                    height={48}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <AvatarFallback className="bg-muted">
                    {auth.user.displayName?.charAt(0) || "ع"}
                  </AvatarFallback>
                )}
              </Avatar>

              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {auth.user.displayName || "مستخدم"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {auth.user.email}
                </p>
              </div>
            </div>
          </div>

          {/* NAVIGATION */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link key={item.href} href={item.href} onClick={closeSidebar}>
                  <div
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer
                      transition-colors

                      ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-foreground"
                      }
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* FOOTER */}
          <div className="p-3 border-t border-border space-y-2">
            <Link href="/" onClick={closeSidebar}>
              <Button variant="ghost" className="w-full justify-start">
                <Settings className="h-4 w-4 ml-2" />
                العودة للموقع
              </Button>
            </Link>

            <Button
              variant="ghost"
              className="w-full justify-start text-red-600"
              onClick={() => {
                closeSidebar();
                auth.logOut();
              }}
            >
              <LogOut className="h-4 w-4 ml-2" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header (HIDDEN on tablets + desktop) */}
        {!isTablet && (
          <header className="sm:hidden bg-card border-b border-border px-4 py-3 sticky top-0 z-30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-foreground" />
                <h1 className="text-lg font-bold text-foreground">
                  لوحة التحكم
                </h1>
              </div>

              <button className="p-2 rounded-lg" onClick={openSidebar}>
                <Menu className="h-5 w-5 text-foreground" />
              </button>
            </div>
          </header>
        )}

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
