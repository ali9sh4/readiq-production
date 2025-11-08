"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/context/authContext";
import { getWalletBalance } from "@/app/actions/wallet_actions";
import { Wallet } from "lucide-react";
import { adminAuth } from "@/firebase/service";

export default function WalletBalance() {
  const { user, getToken } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = useAuth();
  useEffect(() => {}, []);

  useEffect(() => {
    if (user) {
      fetchBalance();
    }
  }, [user]);

  const fetchBalance = async () => {
    try {
      const token = await auth.user?.getIdToken();
      if (!token) {
        throw new Error("يرجى تسجيل الدخول أولاً");
      }
      const result = await getWalletBalance(token);

      if (result.success) {
        setBalance(result.balance || 0);
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <span>محفظتي</span>
      <Wallet className="h-4 w-4" />
      {loading ? (
        <span>...</span>
      ) : (
        <span>{balance?.toLocaleString() || 0} د.ع</span>
      )}
    </>
  );
}
