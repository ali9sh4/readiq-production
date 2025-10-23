import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { AuthProvider } from "@/context/authContext";
import { AuthButton } from "@/components/Authbutton";
import { Toaster } from "sonner";

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
          <nav className="bg-gradient-to-r from-sky-900 to-sky-950 text-white p-4 h-20 flex items-center justify-between shadow-lg">
            {/* Logo Section */}
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-4xl font-extrabold tracking-wide text-white group-hover:text-sky-300 transition-all duration-300 drop-shadow-lg">
                اقْرَأْ
              </span>
              <span className="text-sm text-sky-200 font-light opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                منصة القراءة العربية
              </span>
            </Link>

            {/* Navigation Links */}
            <ul className="flex items-center gap-6">
              <li>
                <Link
                  href="/user_dashboard"
                  className="px-4 py-2 bg-sky-800 hover:bg-sky-700 rounded-xl shadow-md transition-all duration-300 font-semibold"
                >
                  📚 دوراتي
                </Link>
              </li>
              <li>
                <Link
                  href="/"
                  className="hover:text-sky-200 transition-colors duration-200 font-medium"
                >
                  البحث
                </Link>
              </li>
              <li>
                <AuthButton />
              </li>
            </ul>
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
