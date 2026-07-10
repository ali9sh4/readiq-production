import type { Metadata } from "next";
import { Mail, Phone, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "تواصل معنا | Contact Support",
  description:
    "تواصل مع فريق دعم روبيك عبر البريد الإلكتروني أو الهاتف. Contact the Rubik (روبيك) support team by email or phone for help with payments, course access, and account requests.",
  alternates: { canonical: "https://www.rubiktech.org/support" },
};

const contacts = [
  {
    icon: Mail,
    label: "البريد الإلكتروني / Email",
    value: "privacy@rubiktech.org",
    href: "mailto:privacy@rubiktech.org",
    ltr: true,
  },
  {
    icon: Phone,
    label: "الهاتف / Phone",
    value: "0770 270 6976",
    href: "tel:07702706976",
    ltr: true,
  },
  {
    icon: Phone,
    label: "الهاتف / Phone",
    value: "0788 655 2919",
    href: "tel:07886552919",
    ltr: true,
  },
];

export default function Page() {
  return (
    <div dir="rtl" className="bg-white min-h-screen">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Arabic (primary) */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-sky-900 mt-2 mb-6 tracking-tight">
          تواصل معنا / Contact Support
        </h1>
        <p className="text-gray-800 leading-relaxed my-4">
          فريق دعم روبيك (Rubik) موجود لمساعدتك. تواصل معنا عبر البريد الإلكتروني
          أو الهاتف وسنكون سعداء بالرد على استفساراتك.
        </p>

        {/* Contact details */}
        <div className="my-8 grid gap-3 sm:grid-cols-2">
          {contacts.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition hover:border-sky-300 hover:bg-sky-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                <c.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p
                  dir={c.ltr ? "ltr" : undefined}
                  className="truncate text-base font-semibold text-sky-800"
                >
                  {c.value}
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* Response time */}
        <div className="my-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-gray-800 leading-relaxed">
            الرد خلال يوم إلى يومي عمل / We respond within 1–2 business days.
          </p>
        </div>

        {/* Common topics — Arabic */}
        <h2 className="text-xl sm:text-2xl font-bold text-sky-900 mt-10 mb-3">
          المواضيع الشائعة
        </h2>
        <ul className="list-disc ps-6 my-4 space-y-2 text-gray-800">
          <li className="leading-relaxed">
            مشاكل الدفع والمحفظة (شحن الرصيد، تأكيد عمليات الدفع).
          </li>
          <li className="leading-relaxed">
            الوصول إلى الدورات (تفعيل الدورة، مشاكل التشغيل).
          </li>
          <li className="leading-relaxed">طلبات حذف الحساب.</li>
        </ul>

        <hr className="my-8 border-gray-200" />

        {/* English (secondary) */}
        <div dir="ltr" className="text-left">
          <h2 className="text-xl sm:text-2xl font-bold text-sky-900 mt-10 mb-3">
            Contact Support
          </h2>
          <p className="text-gray-800 leading-relaxed my-4">
            The Rubik (روبيك) support team is here to help. Reach us by email or
            phone and we&apos;ll be glad to answer your questions.
          </p>
          <ul className="list-disc pl-6 my-4 space-y-2 text-gray-800">
            <li className="leading-relaxed">
              Email:{" "}
              <a
                href="mailto:privacy@rubiktech.org"
                className="text-sky-700 underline hover:text-sky-900 break-words"
              >
                privacy@rubiktech.org
              </a>
            </li>
            <li className="leading-relaxed">
              Phone:{" "}
              <a
                href="tel:07702706976"
                className="text-sky-700 underline hover:text-sky-900"
              >
                0770 270 6976
              </a>{" "}
              &middot;{" "}
              <a
                href="tel:07886552919"
                className="text-sky-700 underline hover:text-sky-900"
              >
                0788 655 2919
              </a>
            </li>
            <li className="leading-relaxed">
              Response time: within 1–2 business days.
            </li>
          </ul>

          <h3 className="text-lg font-semibold text-sky-800 mt-6 mb-2">
            Common topics
          </h3>
          <ul className="list-disc pl-6 my-4 space-y-2 text-gray-800">
            <li className="leading-relaxed">
              Payment &amp; wallet issues (top-ups, payment confirmation).
            </li>
            <li className="leading-relaxed">
              Course access (activation, playback problems).
            </li>
            <li className="leading-relaxed">Account deletion requests.</li>
          </ul>
        </div>
      </article>
    </div>
  );
}
