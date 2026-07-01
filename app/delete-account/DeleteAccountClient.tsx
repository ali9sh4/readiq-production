"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase/client";
import { deleteMyAccount } from "./actions";
import type { DeletionBlockedReason } from "@/lib/services/accountDeletion";

const SUPPORT_HREF = "mailto:privacy@rubiktech.org";
const CONFIRM_WORD = "حذف";

interface Props {
  blocked: boolean;
  reason: DeletionBlockedReason | null;
  walletBalance: number;
}

function blockedMessage(reason: DeletionBlockedReason | null): string {
  switch (reason) {
    case "ACCOUNT_IS_ADMIN":
      return "هذا الحساب يحمل صلاحيات إدارية ولا يمكن حذفه تلقائيًا. يُرجى التواصل مع الدعم.";
    case "INSTRUCTOR_HAS_COURSES":
      return "لا يمكن حذف هذا الحساب تلقائيًا لأنه مرتبط بدورات تعليمية. يُرجى التواصل مع الدعم لإتمام الحذف يدويًا.";
    case "INSTRUCTOR_HAS_EARNINGS":
      return "لا يمكن حذف هذا الحساب تلقائيًا لأنه يحتوي على سجلات أرباح. يُرجى التواصل مع الدعم.";
    case "INSTRUCTOR_HAS_PACKAGE_PAYOUTS":
      return "لا يمكن حذف هذا الحساب تلقائيًا لوجود مستحقات غير مسددة من مبيعات الحزم. يُرجى التواصل مع الدعم.";
    default:
      return "لا يمكن حذف هذا الحساب تلقائيًا. يُرجى التواصل مع الدعم.";
  }
}

export default function DeleteAccountClient({
  blocked,
  reason,
  walletBalance,
}: Props) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <main
        dir="rtl"
        className="mx-auto my-12 max-w-xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold">تم حذف الحساب</h1>
        <p className="mt-3 text-zinc-700">
          تم حذف حسابك وبياناتك الشخصية نهائيًا. يمكنك الآن مغادرة هذه الصفحة.
        </p>
      </main>
    );
  }

  if (blocked) {
    return (
      <main
        dir="rtl"
        className="mx-auto my-12 max-w-xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold">حذف الحساب</h1>
        <p className="mt-3 text-zinc-700">{blockedMessage(reason)}</p>
        <a
          href={SUPPORT_HREF}
          className="mt-4 inline-block text-sky-700 underline"
        >
          التواصل مع الدعم
        </a>
      </main>
    );
  }

  const handleDelete = async () => {
    if (typed.trim() !== CONFIRM_WORD) return;
    setBusy(true);
    setErr(null);
    const result = await deleteMyAccount();
    if (result.ok) {
      // Best-effort: also clear client-side Firebase Auth state so the
      // in-memory user object is gone. The server already revoked the
      // refresh token and cleared cookies; this just keeps the UI honest.
      try {
        await signOut(auth);
      } catch {
        // ignore — Auth user is already deleted server-side.
      }
      setDone(true);
      setBusy(false);
      // Send the now-signed-out user back to the home page after a beat.
      setTimeout(() => router.push("/"), 2000);
      return;
    }
    setBusy(false);
    if (result.error === "NOT_ALLOWED") {
      setErr(blockedMessage(result.reason ?? null));
    } else if (result.error === "NOT_AUTHENTICATED") {
      router.push("/login?next=/delete-account");
    } else {
      setErr("تعذّر حذف الحساب. حاول مرة أخرى لاحقًا.");
    }
  };

  return (
    <main
      dir="rtl"
      className="mx-auto my-12 max-w-xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <h1 className="text-xl font-bold text-red-700">حذف الحساب نهائيًا</h1>
      <p className="mt-3 text-zinc-700">
        سيؤدي حذف حسابك إلى فقدان الوصول إلى جميع الدورات التي اشتركت بها، ولا
        يمكن التراجع عن هذا الإجراء.
      </p>
      <section className="mt-6 border-t border-zinc-200 pt-6">
        {/* ما الذي يُحذف — عربي */}
        <h2 className="text-base font-bold text-zinc-800">
          ما الذي يُحذف نهائيًا
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          تُحذف البيانات التالية نهائيًا عند حذف حسابك:
        </p>
        <ul className="mt-2 list-disc space-y-1 pr-5 text-zinc-700">
          <li>الملف الشخصي: الاسم والبريد الإلكتروني والصورة الشخصية</li>
          <li>المحفظة والرصيد</li>
          <li>المفضّلة وسجلّ المشاهدة (تقدّم مشاهدة الفيديو)</li>
          <li>إيصالات الدفع المرفوعة (المخزّنة في Cloudflare R2)</li>
          <li>
            حساب المصادقة في Firebase (بيانات تسجيل الدخول، مع إبطال رموز
            التحديث)
          </li>
        </ul>

        {/* ما الذي يُحتفظ به — عربي */}
        <h2 className="mt-5 text-base font-bold text-zinc-800">
          ما الذي يُحتفظ به
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          سجلات مجهولة الهوية يُحتفظ بها لأغراض المحاسبة والامتثال القانوني
          والضريبي — ولا تبقى مرتبطة بهويتك بعد حذف الحساب:
        </p>
        <ul className="mt-2 list-disc space-y-1 pr-5 text-zinc-700">
          <li>سجلات الاشتراك في الدورات</li>
          <li>معاملات المحفظة</li>
          <li>طلبات شحن الرصيد</li>
          <li>سجلات معاملات الدفع</li>
          <li>مبيعات حزم الدورات</li>
        </ul>
        <p className="mt-3 text-sm text-zinc-700">
          بعد حذف حسابك، لا يمكن ربط هذه السجلات المحتفظ بها باسمك أو بريدك
          الإلكتروني أو أي معلومات تعرّف بك.
        </p>

        {/* English mirror */}
        <div dir="ltr" className="mt-6 border-t border-zinc-200 pt-6 text-left">
          <h2 className="text-base font-bold text-zinc-800">
            What gets deleted
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            The following data is permanently removed when you delete your
            account:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700">
            <li>User profile: name, email, profile photo</li>
            <li>Wallet and balance</li>
            <li>Favorites and watch history (video viewing progress)</li>
            <li>Uploaded payment receipts (stored in Cloudflare R2)</li>
            <li>
              Firebase Authentication account (login credentials; refresh
              tokens revoked)
            </li>
          </ul>

          <h2 className="mt-5 text-base font-bold text-zinc-800">
            What is retained
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Pseudonymous records kept for accounting, legal, and tax compliance
            — no longer linked to your identity after account deletion:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700">
            <li>Course enrollment records</li>
            <li>Wallet transactions</li>
            <li>Top-up requests</li>
            <li>Payment transaction records</li>
            <li>Course package sales</li>
          </ul>
          <p className="mt-3 text-sm text-zinc-700">
            Once your account is deleted, these retained records can no longer
            be linked to your name, email, or any personal identifying
            information.
          </p>
        </div>
      </section>

      {walletBalance > 0 && (
        <p className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">
          تنبيه: يوجد رصيد قدره {walletBalance.toLocaleString("en-US")} د.ع في محفظتك
          سيتم فقدانه. لاسترداده تواصل مع الدعم قبل الحذف.
        </p>
      )}

      <p className="mt-6 text-zinc-800">
        للتأكيد، اكتب كلمة «{CONFIRM_WORD}» في الحقل أدناه:
      </p>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={`اكتب: ${CONFIRM_WORD}`}
        disabled={busy}
        className="mt-2 w-full rounded border border-zinc-300 p-2 text-right"
      />

      {err && <p className="mt-3 text-red-700">{err}</p>}

      <button
        type="button"
        onClick={handleDelete}
        disabled={busy || typed.trim() !== CONFIRM_WORD}
        className={`mt-5 w-full rounded-lg px-4 py-3 font-bold text-white transition ${
          typed.trim() === CONFIRM_WORD && !busy
            ? "bg-red-700 hover:bg-red-800"
            : "cursor-not-allowed bg-red-300"
        }`}
      >
        {busy ? "جارٍ الحذف..." : "حذف حسابي نهائيًا"}
      </button>

      <a
        href={SUPPORT_HREF}
        className="mt-4 block text-center text-sm text-sky-700 underline"
      >
        التواصل مع الدعم بدلاً من ذلك
      </a>
    </main>
  );
}
