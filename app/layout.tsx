import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/authContext";
import { Toaster } from "sonner";
import localFont from "next/font/local";
import Navbar from "@/components/navbar";
import Footer from "@/components/Footer";
import NextTopLoader from "nextjs-toploader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.rubiktech.org"),
  title: {
    default: "Rubik - روبيك | منصة التعليم الإلكتروني في العراق",
    template: "%s | Rubik - روبيك",
  },
  description:
    "أفضل منصة تعليمية عربية في العراق. دورات احترافية في البرمجة، التصميم، والتسويق الرقمي مع دعم محلي وطرق دفع تناسب العراق",
  keywords: [
    "دورات تعليمية",
    "تعليم عن بعد",
    "دورات عراقية",
    "تعليم إلكتروني",
    "Rubik",
    "روبيك",
    "دورات برمجة",
    "دورات تصميم",
    "التعليم في العراق",
    "دورات أونلاين",
  ],
  authors: [{ name: "Rubik" }],
  creator: "Rubik",
  publisher: "Rubik",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "ar_IQ",
    url: "https://www.rubiktech.org",
    siteName: "Rubik - روبيك",
    title: "Rubik - منصة التعليم الإلكتروني في العراق",
    description: "أفضل منصة تعليمية عربية في العراق. دورات احترافية بالعربية",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rubik - منصة التعليم الإلكتروني في العراق",
    description: "أفضل منصة تعليمية عربية في العراق",
  },
  alternates: {
    canonical: "https://www.rubiktech.org",
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

// Q2c/Q9 verdict: register only the weights the UI uses (400/700/800/900).
// Files stay on disk in public/fonts/ — registration trim only.
const zainFont = localFont({
  src: [
    {
      path: "../public/fonts/Zain_Regular.otf",
      weight: "400",
      style: "normal",
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
  // Runtime var is deliberately NOT named --font-zain: the @theme key in
  // globals.css uses that name, and matching names create a self-referential
  // CSS variable cycle that silently disables the font.
  variable: "--font-zain-local",
});

const BRAND_YELLOW = "#FDD835"; /* = --brand-yellow-400 in app/globals.css */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${zainFont.variable} ${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="antialiased bg-gray-50">
        <AuthProvider>
          {/* Instant visual feedback for every route transition — critical on
              slow connections where navigation otherwise looks frozen. Brand
              yellow so it reads over the sky-900 navbar. */}
          <NextTopLoader
            color={BRAND_YELLOW}
            height={3}
            showSpinner={false}
            shadow={`0 0 10px ${BRAND_YELLOW},0 0 5px ${BRAND_YELLOW}`}
          />
          <Navbar />
          <main className="min-h-screen">
            {children}
            <Toaster richColors closeButton />
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
