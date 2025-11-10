"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
} from "firebase/firestore";
import { useAuth } from "@/context/authContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Eye, Clock } from "lucide-react";
import type { TopupRequest } from "@/types/wallets";
import {
  approveTopupRequest,
  rejectTopupRequest,
} from "@/app/actions/wallet_actions";
import { db } from "@/firebase/client";

export default function AdminTopupApprovalPage() {
  const auth = useAuth();
  const user = auth.user;

  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [selectedRequest, setSelectedRequest] = useState<TopupRequest | null>(
    null
  );
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    if (!user) return;
    const allTopUpRequestsQuery = query(
      collection(db, "topup_requests"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(
      allTopUpRequestsQuery,
      (snapshot) => {
        const topupRequest = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as TopupRequest[];
        setRequests(topupRequest);
        setLoading(false);
      },
      (error) => {
        console.log("errro fetching toUpRequests"); // Typo + missing setLoading
        setLoading(false); // ADD THIS
      }
    );
    return () => {
      unsubscribe();
    };
  }, [user]);

  const handleApprove = async (requestId: string) => {
    if (!confirm("هل تريد الموافقة على هذا الطلب؟")) return;

    try {
      setProcessingId(requestId);
      const token = await user?.getIdToken();
      if (!token) return;

      const result = await approveTopupRequest(token, requestId, adminNotes);

      if (result.success) {
        // Remove from list
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        setSelectedRequest(null);
        setAdminNotes("");
        alert("تمت الموافقة على الطلب بنجاح!");
      } else {
        alert(result.error || "فشل في الموافقة");
      }
    } catch (error) {
      console.error("Approve error:", error);
      alert("حدث خطأ");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    if (!rejectionReason.trim()) {
      alert("يرجى إدخال سبب الرفض");
      return;
    }

    try {
      setProcessingId(selectedRequest.id);
      const token = await user?.getIdToken();
      if (!token) return;

      const result = await rejectTopupRequest(
        token,
        selectedRequest.id,
        rejectionReason
      );

      if (result.success) {
        // Remove from list
        setRequests((prev) => prev.filter((r) => r.id !== selectedRequest.id));
        setShowRejectModal(false);
        setSelectedRequest(null);
        setRejectionReason("");
        alert("تم رفض الطلب");
      } else {
        alert(result.error || "فشل في الرفض");
      }
    } catch (error) {
      console.error("Reject error:", error);
      alert("حدث خطأ");
    } finally {
      setProcessingId(null);
    }
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
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-6 h-6" />
              طلبات الإيداع المعلقة
            </CardTitle>
            <Badge variant="outline">{requests.length} طلب قيد الانتظار</Badge>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">جاري التحميل...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">لا توجد طلبات معلقة</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-lg text-blue-600">
                            {request.amount.toLocaleString()} د.ع
                          </p>
                          <Badge>{"topup requests"}</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">المستخدم:</p>
                            <p className="font-medium">{request.userName}</p>
                            <p className="text-xs text-gray-400">
                              {request.userEmail}
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-gray-400">
                          تاريخ الطلب: {formatDate(request.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(request.id)}
                          disabled={processingId === request.id}
                          className="gap-2 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          موافقة
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowRejectModal(true);
                          }}
                          disabled={processingId === request.id}
                          className="gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          رفض
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رفض الطلب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                يرجى إدخال سبب الرفض. سيتم إرسال هذا السبب إلى المستخدم.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="reject-reason">سبب الرفض</Label>
              <Input
                id="reject-reason"
                type="text"
                placeholder="مثال: الإيصال غير واضح"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false);
                setRejectionReason("");
              }}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || processingId !== null}
            >
              {processingId ? "جاري الرفض..." : "تأكيد الرفض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
