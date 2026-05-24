import type { Metadata } from "next";
import LegalPage from "@/lib/legal/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "How Rubik (روبيك) uses cookies and similar technologies on our Website.",
  alternates: { canonical: "https://www.rubiktech.org/cookie-policy" },
};

export default function Page() {
  return <LegalPage file="cookie-policy" />;
}
