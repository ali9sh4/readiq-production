"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/authContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Gift,
  AlertTriangle,
} from "lucide-react";
import { TopupRequest, WalletTransaction } from "@/types/wallets";
import {
  getPendingTopupRequestsUSER,
  getWalletTransactions,
} from "@/app/actions/wallet_actions";
import { LoadingButton } from "@/components/ui/loading-button";
import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<
    TopupRequest[]
  >([]);
  const [lastDocId, setLastDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const auth = useAuth();
  const previousTransactions = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    setLoadError(false);
    try {
      const token = await auth.user?.getIdToken();
      if (!token) {
        throw new Error("يرجى تسجيل الدخول أولاً");
      }
      const result = await getWalletTransactions(
        token!,
        20,
        isLoadMore ? lastDocId! : undefined
      );

      if (result.success) {
        setTransactions((prev) =>
          isLoadMore ? [...prev, ...result.transactions] : result.transactions
        );
        setHasMore(result.hasMore);
        setLastDocId(result.lastDocId);
        return;
      }
      setTransactions(result.transactions);
    } catch (error) {
      console.error("خطأ في جلب المعاملات:", error);
      setLoadError(true);
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  const retryLoad = () => {
    setLoading(true);
    previousTransactions();
    pendingRequests();
  };

  const pendingRequests = async () => {
    try {
      const token = await auth.user?.getIdToken();
      if (!token) {
        throw new Error("يرجى تسجيل الدخول أولاً");
      }
      const result = await getPendingTopupRequestsUSER(token);
      if (!result.success) {
        setPendingTransactions([]);
        setLoading(false);
        return;
      }
      setPendingTransactions(result.PendingTransactions ?? []);
      setLoading(false);
    } catch (error) {
      console.error("خطأ في جلب المعاملات:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth.user) {
      previousTransactions();
      pendingRequests();
    }
  }, [auth.user]);

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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>سجل العمليات</CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              // Skeleton rows matching the real transaction row layout
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-9 h-9 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-20" />
                  </div>
                ))}
              </div>
            ) : loadError && transactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-red-600 mb-3">
                  تعذّر تحميل العمليات. تحقق من اتصالك بالإنترنت.
                </p>
                <LoadingButton variant="outline" onClick={retryLoad}>
                  حاول مرة أخرى
                </LoadingButton>
              </div>
            ) : transactions.length === 0 &&
              pendingTransactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">لا توجد عمليات بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Pending requests first */}
                {pendingTransactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {getTransactionIcon("topup")}
                      </div>

                      <div>
                        <p className="font-medium text-gray-900">
                          {txn.amount.toLocaleString("en-US")} د.ع - قيد المعالجة
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(txn.createdAt)}
                        </p>
                        <Badge variant="secondary" className="mt-1">
                          قيد المراجعة
                        </Badge>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-600">
                        +{txn.amount.toLocaleString("en-US")} د.ع
                      </p>
                    </div>
                  </div>
                ))}

                {/* Completed transactions */}
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
                        {txn.amount.toLocaleString("en-US")} د.ع
                      </p>
                      <p className="text-xs text-gray-500">
                        الرصيد: {txn.balanceAfter.toLocaleString("en-US")} د.ع
                      </p>
                      <Badge variant="outline" className="mt-1">
                        {getTypeLabel(txn.type)}
                      </Badge>
                    </div>
                  </div>
                ))}
                {loadError && (
                  <div className="text-center py-2">
                    <p className="text-sm text-red-600 mb-2">
                      تعذّر تحميل المزيد من العمليات.
                    </p>
                  </div>
                )}
                {hasMore && (
                  <div className="text-center pt-2">
                    <LoadingButton
                      variant="outline"
                      className="w-full sm:w-auto"
                      loading={loadingMore}
                      loadingText="جاري التحميل..."
                      onClick={() => previousTransactions(true)}
                    >
                      {loadError ? "حاول مرة أخرى" : "تحميل المزيد"}
                    </LoadingButton>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
