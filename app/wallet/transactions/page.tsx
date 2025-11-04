"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Gift,
  AlertTriangle,
} from "lucide-react";
import type { WalletTransaction } from "@/types/wallet";

export default function TransactionsPage() {
  const { user, getToken } = useAuth();
  const router = useRouter();

  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    } else {
      router.push("/login?redirect=/wallet/transactions");
    }
  }, [user]);

  const fetchTransactions = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      // Import and call server action
      const { getWalletTransactions } = await import(
        "@/app/actions/wallet_actions"
      );
      const result = await getWalletTransactions(token, 50);

      if (result.success && result.transactions) {
        setTransactions(result.transactions);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "topup":
        return <ArrowUpCircle className="w-5 h-5 text-green-600" />;
      case "purchase":
        return <ArrowDownCircle className="w-5 h-5 text-blue-600" />;
      case "refund":
        return <RefreshCw className="w-5 h-5 text-orange-600" />;
      case "bonus":
        return <Gift className="w-5 h-5 text-purple-600" />;
      case "penalty":
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <ArrowDownCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      topup: "إيداع",
      purchase: "شراء",
      refund: "استرجاع",
      bonus: "مكافأة",
      penalty: "خصم",
    };
    return labels[type] || type;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>سجل العمليات</CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">جاري التحميل...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">لا توجد عمليات بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {getTransactionIcon(txn.type)}
                      </div>

                      <div>
                        <p className="font-medium text-gray-900">
                          {txn.description}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(txn.createdAt)}
                        </p>
                        {txn.metadata?.courseTitle && (
                          <p className="text-xs text-gray-400 mt-1">
                            {txn.metadata.courseTitle}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-lg font-bold ${
                          txn.amount > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {txn.amount > 0 ? "+" : ""}
                        {txn.amount.toLocaleString()} د.ع
                      </p>
                      <p className="text-xs text-gray-500">
                        الرصيد: {txn.balanceAfter.toLocaleString()} د.ع
                      </p>
                      <Badge variant="outline" className="mt-1">
                        {getTypeLabel(txn.type)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
