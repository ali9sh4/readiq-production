import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { AuthProvider } from "@/context/authContext";
import { AuthButton } from "@/components/Authbutton";
import { Toaster } from "sonner";
import { BookOpen, PlusCircle, User } from "lucide-react";
import WalletBalance from "@/components/WalletBalance";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "اقْرَأْ - منصة القراءة",
  description: "منصة القراءة العربية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <AuthProvider>
          <nav className="bg-gradient-to-r from-sky-900 to-sky-950 text-white p-4 shadow-xl border-b border-sky-800/50">
            <div className="container mx-auto flex items-center justify-between">
              {/* Logo Section */}
              <Link href="/" className="flex items-center gap-3 group">
                <span className="text-4xl font-extrabold tracking-wide text-white group-hover:text-sky-200 transition-all duration-300 drop-shadow-lg">
                  اقْرَأْ
                </span>
                <span className="text-sm text-sky-200 font-light opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                  منصة القراءة العربية
                </span>
              </Link>

              {/* Navigation Links */}
              <ul className="flex items-center gap-3">
                <li>
                  <Link
                    href="/wallet/topup" // or "/user_dashboard/wallet"
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold border border-white/20 hover:border-white/30 hover:scale-105"
                  >
                    <WalletBalance />
                  </Link>
                </li>

                <li>
                  <Link
                    href="/user_dashboard"
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold border border-white/20 hover:border-white/30 hover:scale-105"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>دوراتي</span>
                  </Link>
                </li>

                <li>
                  <Link
                    href="/course-upload"
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-sky-900 hover:bg-gray-100 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold hover:scale-105"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>إنشاء دورة</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/user_dashboard/profile"
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold border border-white/20 hover:border-white/30 hover:scale-105"
                  >
                    <User className="h-4 w-4" />
                    <span>ملفي الشخصي</span>
                  </Link>
                </li>
                <li>
                  <AuthButton />
                </li>
              </ul>
            </div>
          </nav>

          <main className="min-h-screen">
            {children}
            <Toaster richColors closeButton />
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
