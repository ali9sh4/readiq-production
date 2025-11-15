import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/authContext";
import { Toaster } from "sonner";
import localFont from "next/font/local";
import Navbar from "@/components/navbar";

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

const zainFont = localFont({
  src: [
    {
      path: "../public/fonts/Zain_ExtraLight.otf",
      weight: "200",
      style: "normal",
    },
    {
      path: "../public/fonts/Zain_Light.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/Zain_LightItalic.otf",
      weight: "300",
      style: "italic",
    },
    {
      path: "../public/fonts/Zain_Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Zain_Italic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/Zain_Bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/Zain_ExtraBold.otf",
      weight: "800",
      style: "normal",
    },
    {
      path: "../public/fonts/Zain_Black.otf",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-zain",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={zainFont.variable}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <AuthProvider>
          <Navbar />
          <main className="min-h-screen">
            {children}
            <Toaster richColors closeButton />
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
