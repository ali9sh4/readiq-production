"use client";
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import Image from "next/image";
import { User } from "lucide-react";
import NavigationButton from "./NavigationButton";

export const AuthButton = () => {
  const router = useRouter();
  const auth = useAuth();
  if (!auth.isClient) {
    return (
      <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse"></div>
    );
  }
  return (
    <div>
      {auth.user ? (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar>
              {auth.user.photoURL ? (
                <AvatarImage
                  src={auth.user.photoURL}
                  alt={`${auth.user.displayName} avatar`}
                />
              ) : (
                <AvatarFallback className="bg-sky-100 text-sky-600">
                  {(auth.user.displayName ||
                    auth.user.email)?.[0]?.toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="text-right"
            style={{ direction: "rtl" }}
          >
            <DropdownMenuLabel>
              <div>{auth.user.displayName}</div>
              <div className="font-normal text-xs">{auth.user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/">حسابي</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/user_dashboard"> دوراتي المشترك بها</Link>
            </DropdownMenuItem>

            {!!auth.CustomClaims?.admin && (
              <DropdownMenuItem asChild>
                <Link href="/admin-dashboard">لوحة الإدارة</Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem asChild>
              <Link href="/course-upload">إضافة دورة جديدة</Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={async () => {
                await auth.logOut();
                router.refresh();
              }}
            >
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex gap-3 items-center" dir="rtl">
          <NavigationButton
            href="/login"
            className="text-gray-700 hover:text-sky-600 hover:bg-sky-50 border-gray-300 hover:border-sky-400 transition-all duration-200 font-medium px-5 shadow-sm"
            variant="outline"
          >
            تسجيل الدخول
          </NavigationButton>

          <NavigationButton
            href="/register"
            className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white border-0 transition-all duration-200 font-medium px-5 shadow-md hover:shadow-lg"
            variant="default"
          >
            تسجيل جديد
          </NavigationButton>
        </div>
      )}
    </div>
  );
};
