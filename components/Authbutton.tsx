"use client";
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar } from "./ui/avatar";
import Image from "next/image";
import { AvatarFallback } from "@radix-ui/react-avatar";
import { User } from "lucide-react";

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
              {!!auth.user.photoURL && (
                <Image
                  src={auth.user.photoURL || "/default-avatar.png"}
                  alt={`${auth.user.displayName} avatar`}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
              )}
              <AvatarFallback className="bg-gray-200 flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </AvatarFallback>
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
        <div className="flex gap-4 items-center" dir="rtl">
          <Link
            href="/login"
            className="text-white hover:text-sky-200 transition-colors duration-200 font-medium"
          >
            تسجيل الدخول
          </Link>
          <div className="h-6 w-[1px] bg-white/30"></div>
          <Link
            href="/register"
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 font-medium"
          >
            تسجيل جديد
          </Link>
        </div>
      )}
    </div>
  );
};
