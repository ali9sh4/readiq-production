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

// ✅ UPDATED METADATA
export const metadata: Metadata = {
  metadataBase: new URL("https://readiq.us"),
  title: {
    default: "ReadIQ - اقْرَأْ | منصة التعليم الإلكتروني في العراق",
    template: "%s | ReadIQ - اقْرَأْ",
  },
  description:
    "أفضل منصة تعليمية عربية في العراق. دورات احترافية في البرمجة، التصميم، والتسويق الرقمي مع دعم محلي وطرق دفع تناسب العراق",
  keywords: [
    "دورات تعليمية",
    "تعليم عن بعد",
    "دورات عراقية",
    "تعليم إلكتروني",
    "ReadIQ",
    "اقرأ",
    "دورات برمجة",
    "دورات تصميم",
    "التعليم في العراق",
    "دورات أونلاين",
  ],
  authors: [{ name: "ReadIQ" }],
  creator: "ReadIQ",
  publisher: "ReadIQ",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "ar_IQ",
    url: "https://readiq.us",
    siteName: "ReadIQ - اقْرَأْ",
    title: "ReadIQ - منصة التعليم الإلكتروني في العراق",
    description: "أفضل منصة تعليمية عربية في العراق. دورات احترافية بالعربية",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReadIQ - منصة التعليم الإلكتروني في العراق",
    description: "أفضل منصة تعليمية عربية في العراق",
  },
  alternates: {
    canonical: "https://readiq.us",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "nOdTSzDzvmfr3bX1KZIaLuiSneMILNhtdi5Lq_1zVRI",
  },
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
