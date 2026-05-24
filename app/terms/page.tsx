import type { Metadata } from "next";
import LegalPage from "@/lib/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description:
    "The terms and conditions governing your use of Rubik (روبيك).",
  alternates: { canonical: "https://www.rubiktech.org/terms" },
};

export default function Page() {
  return <LegalPage file="terms-and-conditions" />;
}
