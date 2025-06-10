import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { AuthProvider } from "@/context/authContext";
import { AuthButton } from "@/components/Authbutton";
import './globals.css';

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
          <nav className="bg-gradient-to-r from-sky-900 to-sky-950 text-white p-5 h-20 flex items-center justify-between shadow-lg">
            {/* Logo/Brand */}
            <Link 
              href="/" 
              className="text-3xl font-bold text-white hover:text-sky-200 transition-colors duration-300 tracking-wide drop-shadow-lg"
            >
              <span>اقْرَأْ</span>
            </Link>

            {/* Navigation Items */}
            <ul className="flex gap-8 items-center">
              <li>
                <Link 
                  href="/" 
                  className="text-white hover:text-sky-200 transition-colors duration-200 font-medium"
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
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}