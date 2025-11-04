"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/authContext";
import { getWalletBalance } from "@/app/actions/wallet_actions";
import { Wallet } from "lucide-react";

export default function WalletBalance() {
  const { user, getToken } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBalance();
    }
  }, [user]);

  const fetchBalance = async () => {
    try {
      const token = await getToken();
      if (!token) return;

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
