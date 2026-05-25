import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkDeletionEligibility } from "@/lib/services/accountDeletion";
import DeleteAccountClient from "./DeleteAccountClient";

export const metadata: Metadata = {
  title: "حذف الحساب — Rubik",
  description: "حذف حسابك في Rubik (روبيك) نهائيًا.",
  robots: { index: false, follow: false },
};

export default async function DeleteAccountPage() {
  // middleware.ts has /delete-account in its matcher, so the x-user-id header
  // is populated by the time we get here for any signed-in user. For an
  // unauthenticated visitor the middleware already redirects to "/" before
  // this code runs — the redirect() below is defence-in-depth for the case
  // where the matcher entry is ever removed by accident.
  const uid = (await headers()).get("x-user-id");
  if (!uid) {
    redirect("/login?next=/delete-account");
  }

  const eligibility = await checkDeletionEligibility(uid);

  return (
    <DeleteAccountClient
      blocked={!eligibility.allowed}
      reason={eligibility.reason ?? null}
      walletBalance={eligibility.walletBalance}
    />
  );
}
