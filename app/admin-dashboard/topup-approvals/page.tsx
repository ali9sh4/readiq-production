"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
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
import type { TopupRequest } from "@/types/wallet";
import {
  getPendingTopupRequests,
  approveTopupRequest,
  rejectTopupRequest,
} from "@/app/actions/wallet_actions";

export default function AdminTopupApprovalPage() {
  const { user, getToken } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [selectedRequest, setSelectedRequest] = useState<TopupRequest | null>(
    null
  );
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    if (user) {
      
      fetchRequests();
    } else {
      router.push("/login?redirect=/admin/topup-approvals");
    }
  }, [user]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const result = await getPendingTopupRequests(token);

      if (result.success && result.requests) {
        setRequests(result.requests);
      } else if (result.error) {
        console.error(result.error);
        // If not admin, redirect
        if (result.error === "غير مصرح") {
          alert("أنت لست مسؤولاً. سيتم إعادة التوجيه.");
          router.push("/");
        }
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!confirm("هل تريد الموافقة على هذا الطلب؟")) return;

    try {
      setProcessingId(requestId);
      const token = await getToken();
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
      const token = await getToken();
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

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      bank_transfer: "تحويل بنكي",
      zaincash: "زين كاش",
      cash_agent: "وكيل نقدي",
    };
    return labels[method] || method;
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
                          <Badge>{getMethodLabel(request.method)}</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">المستخدم:</p>
                            <p className="font-medium">{request.userName}</p>
                            <p className="text-xs text-gray-400">
                              {request.userEmail}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">رقم العملية:</p>
                            <p className="font-medium">
                              {request.transactionId || "غير محدد"}
                            </p>
                          </div>

                          {request.senderName && (
                            <div>
                              <p className="text-gray-500">اسم المرسل:</p>
                              <p className="font-medium">
                                {request.senderName}
                              </p>
                            </div>
                          )}

                          {request.senderAccount && (
                            <div>
                              <p className="text-gray-500">رقم الحساب:</p>
                              <p className="font-medium">
                                {request.senderAccount}
                              </p>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-gray-400">
                          تاريخ الطلب: {formatDate(request.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowReceiptModal(true);
                          }}
                          className="gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          الإيصال
                        </Button>

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

                    {/* Admin Notes Input */}
                    <div className="mt-4 space-y-2">
                      <Label htmlFor={`notes-${request.id}`}>
                        ملاحظات (اختياري)
                      </Label>
                      <Input
                        id={`notes-${request.id}`}
                        type="text"
                        placeholder="أضف ملاحظات للسجل..."
                        value={
                          selectedRequest?.id === request.id ? adminNotes : ""
                        }
                        onChange={(e) => {
                          setSelectedRequest(request);
                          setAdminNotes(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receipt Modal */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>إيصال التحويل</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <img
                src={selectedRequest.receiptUrl}
                alt="Receipt"
                className="w-full h-auto border rounded-lg"
              />
              <div className="text-sm text-gray-600">
                <p>المبلغ: {selectedRequest.amount.toLocaleString()} د.ع</p>
                <p>رقم العملية: {selectedRequest.transactionId}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReceiptModal(false)}
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
