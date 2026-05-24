import type { Metadata } from "next";
import LegalPage from "@/lib/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Rubik (روبيك) collects, uses, and protects your personal information.",
  alternates: { canonical: "https://www.rubiktech.org/privacy-policy" },
};

export default function Page() {
  return <LegalPage file="privacy-policy" />;
}
