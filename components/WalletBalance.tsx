"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/authContext";
import { Wallet } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/client";

export default function WalletBalance() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "wallets", user.uid),
      (doc) => {
        setBalance(doc.data()?.balance || 0);
        setFailed(false);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching wallet balance:", error);
        // Don't render a fake 0 balance on a listener error — show "—"
        // until the snapshot recovers.
        setFailed(true);
        setLoading(false);
      }
    );

    // Return cleanup function from useEffect, not from onSnapshot
    return () => unsubscribe();
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      <Wallet className="h-4 w-4 text-[#FDD835]" />
      <span>محفظتي:</span>
      {loading ? (
        <span className="inline-block h-4 w-12 rounded bg-white/20 animate-pulse" />
      ) : failed ? (
        <span className="font-semibold" title="تعذّر تحميل الرصيد">
          — د.ع
        </span>
      ) : (
        <span className="font-semibold">
          {balance?.toLocaleString("en-US") || 0} د.ع
        </span>
      )}
    </div>
  );
}
