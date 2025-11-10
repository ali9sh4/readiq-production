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

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "wallets", user.uid),
      (doc) => {
        setBalance(doc.data()?.balance || 0);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching wallet balance:", error);
        setBalance(0);
        setLoading(false);
      }
    );

    // Return cleanup function from useEffect, not from onSnapshot
    return () => unsubscribe();
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      <Wallet className="h-4 w-4 text-blue-600" />
      <span>محفظتي:</span>
      {loading ? (
        <span>...</span>
      ) : (
        <span className="font-semibold">
          {balance?.toLocaleString() || 0} د.ع
        </span>
      )}
    </div>
  );
}
