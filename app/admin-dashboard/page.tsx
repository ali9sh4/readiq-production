"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/client";
import { useAuth } from "@/context/authContext";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit,
  Wallet,
  Trash2,
} from "lucide-react";
import { approveCourse } from "./action";
import {
  approveTopupRequest,
  rejectTopupRequest,
} from "@/app/actions/wallet_actions";
import { Course, FirestoreTimestamp } from "@/types/types";
import type { TopupRequest } from "@/types/wallets";
import Link from "next/link";
import {
  permanentlyDeleteCourse,
  restoreDeletedCourse,
} from "../actions/course_deletion_action";
import { migrateCourses } from "../admin/sync-enrollments/page";

export default function AdminDashboard() {
  const { user, isLoading } = useAuth();
  const [pendingCourses, setPendingCourses] = useState<Course[]>([]);
  const [approvedCourses, setApprovedCourses] = useState<Course[]>([]);
  const [rejectedCourses, setRejectedCourses] = useState<Course[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [deletedCourses, setDeletedCourses] = useState<Course[]>([]); // ✅ ADD THIS
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "pending" | "approved" | "rejected" | "topups" | "deleted"
  >("pending");
  const [searchQuery, setSearchQuery] = useState("");

  // Real-time listener for courses
  useEffect(() => {
    if (!user || isLoading) return;

    const allCoursesQuery = query(
      collection(db, "courses"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      allCoursesQuery,
      (snapshot) => {
        const courses = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Course[];

        const pending = courses.filter(
          (course) => !course.isApproved && !course.isRejected
        );
        const approved = courses.filter((course) => course.isApproved === true);
        const rejected = courses.filter((course) => course.isRejected === true);

        setPendingCourses(pending);
        setApprovedCourses(approved);
        setRejectedCourses(rejected);
      },
      (error) => {
        console.error("Error fetching courses:", error);
      }
    );

    return () => unsubscribe();
  }, [user, isLoading]);

  // Real-time listener for topup requests
  useEffect(() => {
    if (!user || isLoading) return;

    const topupsQuery = query(
      collection(db, "topup_requests"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(
      topupsQuery,
      (snapshot) => {
        const requests = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as TopupRequest[];
        setTopupRequests(requests);
      },
      (error) => {
        console.error("Error fetching topup requests:", error);
        throw new Error("Error fetching topup requests");
      }
    );

    return () => unsubscribe();
  }, [user, isLoading]);
  useEffect(() => {
    if (!user || isLoading) return;

    const deletedQuery = query(
      collection(db, "courses"),
      where("isDeleted", "==", true)
    );

    const unsubscribe = onSnapshot(
      deletedQuery,
      (snapshot) => {
        const courses = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Course[];

        // Sort by deletion date (newest first)
        const sortedCourses = courses.sort((a, b) => {
          const dateA = new Date(a.deletedAt || 0).getTime();
          const dateB = new Date(b.deletedAt || 0).getTime();
          return dateB - dateA;
        });

        setDeletedCourses(sortedCourses);
      },
      (error) => {
        console.error("Error fetching deleted courses:", error);
      }
    );

    return () => unsubscribe();
  }, [user, isLoading]);

  const formatDate = (
    timestamp: FirestoreTimestamp | Date | string | null | undefined
  ) => {
    if (!timestamp) return "غير محدد";

    if (typeof timestamp === "string") {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return "غير محدد";
      return d.toLocaleDateString("en-US");
    }

    if (typeof timestamp === "object" && "toDate" in timestamp) {
      return timestamp.toDate().toLocaleDateString("ar-SA");
    }

    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString("ar-SA");
    }

    return "غير محدد";
  };

  const getCategoryText = (category: string) => {
    const categories = {
      programming: "البرمجة",
      design: "التصميم",
      business: "الأعمال",
      marketing: "التسويق",
      photography: "التصوير",
      music: "الموسيقى",
      health: "الصحة واللياقة",
      teaching: "التدريس",
    };
    return categories[category as keyof typeof categories] || category;
  };

  const getCurrentCourses = () => {
    switch (activeTab) {
      case "pending":
        return pendingCourses;
      case "approved":
        return approvedCourses;
      case "rejected":
        return rejectedCourses;
      default:
        return pendingCourses;
    }
  };

  const filteredCourses = getCurrentCourses().filter((course) =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">جاري التحميل...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">
          يرجى تسجيل الدخول للوصول إلى لوحة الإدارة
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">
          لوحة التحكم الإدارية
        </h1>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div className="mr-4">
              <p className="text-2xl font-bold text-yellow-900">
                {pendingCourses.length}
              </p>
              <p className="text-yellow-700">دورات قيد المراجعة</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="mr-4">
              <p className="text-2xl font-bold text-green-900">
                {approvedCourses.length}
              </p>
              <p className="text-green-700">دورات معتمدة</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <XCircle className="h-8 w-8 text-red-600" />
            <div className="mr-4">
              <p className="text-2xl font-bold text-red-900">
                {rejectedCourses.length}
              </p>
              <p className="text-red-700">دورات مرفوضة</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center">
            <Wallet className="h-8 w-8 text-blue-600" />
            <div className="mr-4">
              <p className="text-2xl font-bold text-blue-900">
                {topupRequests.length}
              </p>
              <p className="text-blue-700">طلبات إيداع</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-100 border border-gray-300 rounded-lg p-6">
          <div className="flex items-center">
            <Trash2 className="h-8 w-8 text-gray-600" />
            <div className="mr-4">
              <p className="text-2xl font-bold text-gray-900">
                {deletedCourses.length}
              </p>
              <p className="text-gray-700">دورات محذوفة</p>
            </div>
          </div>
        </div>
      </div>

      {activeTab !== "topups" && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="بحث في الدورات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "pending"
                ? "border-yellow-500 text-yellow-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            قيد المراجعة ({pendingCourses.length})
          </button>

          <button
            onClick={() => setActiveTab("approved")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "approved"
                ? "border-green-500 text-green-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            معتمدة ({approvedCourses.length})
          </button>

          <button
            onClick={() => setActiveTab("rejected")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "rejected"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            مرفوضة ({rejectedCourses.length})
          </button>

          <button
            onClick={() => setActiveTab("topups")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "topups"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            طلبات الإيداع ({topupRequests.length})
          </button>

          <button
            onClick={() => setActiveTab("deleted")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "deleted"
                ? "border-gray-500 text-gray-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            محذوفة ({deletedCourses.length})
          </button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="space-y-6">
        {/* Topup Requests Tab */}
        {activeTab === "topups" ? (
          topupRequests.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">لا توجد طلبات إيداع معلقة</p>
            </div>
          ) : (
            topupRequests.map((topupRequest) => (
              <div
                key={topupRequest.id}
                className="bg-white border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <p className="text-2xl font-bold text-blue-600">
                        {topupRequest.amount.toLocaleString()} د.ع
                      </p>
                      <Badge className="bg-blue-100 text-blue-800">
                        طلب إيداع
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="font-medium text-gray-500">
                          المستخدم:
                        </span>
                        <p className="text-gray-900">{topupRequest.userName}</p>
                        <p className="text-xs text-gray-400">
                          {topupRequest.userEmail}
                        </p>
                      </div>

                      {topupRequest.senderName && (
                        <div>
                          <span className="font-medium text-gray-500">
                            اسم المرسل:
                          </span>
                          <p className="text-gray-900">
                            {topupRequest.senderName}
                          </p>
                        </div>
                      )}

                      <div>
                        <span className="font-medium text-gray-500">
                          تاريخ الطلب:
                        </span>
                        <p className="text-gray-900">
                          {formatDate(topupRequest.createdAt)}
                        </p>
                      </div>

                      <div>
                        <span className="font-medium text-gray-500">
                          الحالة:
                        </span>
                        <p className="text-gray-900">{topupRequest.status}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                  <Button
                    onClick={async () => {
                      if (!confirm("هل تريد الموافقة على هذا الطلب؟")) return;
                      setActionLoading(topupRequest.id);
                      try {
                        const token = await user.getIdToken();
                        const result = await approveTopupRequest(
                          token,
                          topupRequest.id,
                          ""
                        );

                        if (result.error) {
                          alert(result.error);
                        } else {
                          alert("تمت الموافقة على الطلب بنجاح!");
                        }
                      } catch (error) {
                        console.error("Error:", error);
                        alert("حدث خطأ أثناء الموافقة");
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading === topupRequest.id}
                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4 ml-2" />
                    موافقة
                  </Button>

                  <Button
                    onClick={async () => {
                      const reason = prompt("سبب الرفض:");
                      if (!reason) return;

                      setActionLoading(topupRequest.id);
                      try {
                        const token = await user.getIdToken();
                        const result = await rejectTopupRequest(
                          token,
                          topupRequest.id,
                          reason
                        );

                        if (result.error) {
                          alert(result.error);
                        } else {
                          alert("تم رفض الطلب");
                        }
                      } catch (error) {
                        console.error("Error:", error);
                        alert("حدث خطأ أثناء الرفض");
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading === topupRequest.id}
                    variant="destructive"
                    className="disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4 ml-2" />
                    رفض
                  </Button>
                </div>
              </div>
            ))
          )
        ) : activeTab === "deleted" ? (
          deletedCourses.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">لا توجد دورات محذوفة</p>
            </div>
          ) : (
            deletedCourses.map((course) => (
              <div
                key={course.id}
                className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {course.title}
                      </h3>
                      <Badge className="bg-gray-100 text-gray-800">
                        محذوفة
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="font-medium text-gray-500">
                          التصنيف:
                        </span>
                        <p className="text-gray-900">
                          {getCategoryText(course.category)}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">
                          السعر:
                        </span>
                        <p className="text-gray-900">{course.price} د.ع</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">
                          المحتوى:
                        </span>
                        <p className="text-gray-900">
                          {course.videos?.length || 0} فيديو •{" "}
                          {course.files?.length || 0} ملف
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">
                          الطلاب المسجلين:
                        </span>
                        <p className="text-gray-900">
                          {course.enrollmentCount || 0}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">
                          تاريخ الحذف:
                        </span>
                        <p className="text-gray-900">
                          {formatDate(course.deletedAt)}
                        </p>
                      </div>
                    </div>

                    {/* Info about restoration */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-blue-800 text-sm">
                        💡 استعادة الدورة ستعيدها إلى حالة "مسودة" ويمكن للمدرب
                        إعادة نشرها
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                  <Button
                    onClick={async () => {
                      if (
                        !confirm(
                          `هل تريد استعادة الدورة "${course.title}"؟\n\nسيتم إعادتها كمسودة.`
                        )
                      )
                        return;

                      setActionLoading(course.id);
                      try {
                        const token = await user.getIdToken();
                        const result = await restoreDeletedCourse(
                          course.id,
                          token
                        );

                        if (result.error) {
                          alert(result.error);
                        } else {
                          alert("تم استعادة الدورة بنجاح!");
                        }
                      } catch (error) {
                        console.error("Error:", error);
                        alert("حدث خطأ أثناء الاستعادة");
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading === course.id}
                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4 ml-2" />
                    استعادة الدورة
                  </Button>
                  {/* After the Restore button */}
                  <Button
                    onClick={async () => {
                      if (
                        !confirm(
                          `⚠️ تحذير خطير!\n\nهل تريد حذف الدورة "${course.title}" نهائياً؟\n\n` +
                            `سيتم حذف:\n` +
                            `• ${course.videos?.length || 0} فيديو من Mux\n` +
                            `• ${course.files?.length || 0} ملف من التخزين\n` +
                            `• ${course.enrollmentCount || 0} تسجيل طالب\n` +
                            `• جميع علامات المفضلة\n` + // ✅ ADD THIS
                            `• جميع البيانات من قاعدة البيانات\n\n` +
                            `❌ هذا الإجراء لا يمكن التراجع عنه!`
                        )
                      )
                        return;

                      // Double confirmation
                      const confirmText = prompt(
                        `للتأكيد، اكتب عنوان الدورة:\n"${course.title}"`
                      );

                      if (confirmText !== course.title) {
                        alert("العنوان غير مطابق. تم إلغاء الحذف.");
                        return;
                      }

                      setActionLoading(course.id);
                      try {
                        const token = await user.getIdToken();
                        const result = await permanentlyDeleteCourse(
                          course.id,
                          token
                        );

                        if (result.error) {
                          alert(result.error);
                        } else {
                          alert(
                            `✅ تم الحذف النهائي بنجاح!\n\n` +
                              `تم حذف:\n` +
                              `• ${result.deleted?.videos || 0} فيديو\n` +
                              `• ${result.deleted?.files || 0} ملف\n` +
                              `• ${result.deleted?.enrollments || 0} تسجيل\n` +
                              `• ${result.deleted?.favorites || 0} مفضلة` // ✅ ADD THIS
                          );
                        }
                      } catch (error) {
                        console.error("Error:", error);
                        alert("حدث خطأ أثناء الحذف النهائي");
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading === course.id}
                    variant="destructive"
                    className="bg-red-700 hover:bg-red-800 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 ml-2" />
                    حذف نهائي
                  </Button>

                  <Button variant="outline" asChild>
                    <Link href={`/Course/${course.id}`}>
                      <Eye className="h-4 w-4 ml-2" />
                      عرض التفاصيل
                    </Link>
                  </Button>

                  {/* TODO: Add permanent delete button later */}
                </div>
              </div>
            ))
          )
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">
              {activeTab === "pending" && "لا توجد دورات قيد المراجعة"}
              {activeTab === "approved" && "لا توجد دورات معتمدة"}
              {activeTab === "rejected" && "لا توجد دورات مرفوضة"}
            </p>
          </div>
        ) : (
          filteredCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-1">
                        {course.title}
                      </h3>
                      {course.subtitle && (
                        <p className="text-gray-600 mb-2">{course.subtitle}</p>
                      )}
                      <p className="text-gray-700 text-sm">
                        {course.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <span className="font-medium text-gray-500">
                        التصنيف:
                      </span>
                      <p className="text-gray-900">
                        {getCategoryText(course.category)}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">السعر:</span>
                      <p className="text-gray-900">{course.price} د.ع</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">المدة:</span>
                      <p className="text-gray-900">{course.duration} ساعة</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">
                        المحتوى:
                      </span>
                      <p className="text-gray-900">
                        {course.videos?.length || 0} فيديو •{" "}
                        {course.files?.length || 0} ملف
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">
                        أنشئت بواسطة:
                      </span>
                      <p className="text-gray-900 text-xs">
                        {course.createdBy}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">
                        تاريخ الإنشاء:
                      </span>
                      <p className="text-gray-900">
                        {formatDate(course.createdAt)}
                      </p>
                    </div>
                  </div>

                  {course.learningPoints &&
                    course.learningPoints.some((point) => point.trim()) && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-700 mb-2">
                          ما ستتعلمه:
                        </h4>
                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                          {course.learningPoints
                            .filter((point) => point.trim())
                            .map((point, index) => (
                              <li key={index}>{point}</li>
                            ))}
                        </ul>
                      </div>
                    )}

                  {course.requirements &&
                    course.requirements.some((req) => req.trim()) && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-700 mb-2">
                          المتطلبات:
                        </h4>
                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                          {course.requirements
                            .filter((req) => req.trim())
                            .map((req, index) => (
                              <li key={index}>{req}</li>
                            ))}
                        </ul>
                      </div>
                    )}

                  {course.rejectionReason && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        سبب الرفض:
                      </h4>
                      <p className="text-red-700 text-sm">
                        {course.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              {activeTab === "pending" && (
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                  <Button
                    onClick={async () => {
                      if (!confirm("هل أنت متأكد من اعتماد هذه الدورة؟"))
                        return;
                      setActionLoading(course.id);
                      try {
                        const token = await user.getIdToken();
                        const result = await approveCourse(
                          course.id,
                          true,
                          token
                        );

                        if (result.error) {
                          alert(result.message);
                        } else {
                          console.log("Course approved successfully");
                        }
                      } catch (error) {
                        console.error("Error:", error);
                        alert("حدث خطأ أثناء الموافقة على الدورة");
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading === course.id}
                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4 ml-2" />
                    اعتماد الدورة
                  </Button>

                  <Button
                    onClick={async () => {
                      if (!confirm("هل أنت متأكد من رفض هذه الدورة؟")) return;
                      const reason = prompt("سبب الرفض (اختياري):");
                      if (reason === null) return;
                      setActionLoading(course.id);
                      try {
                        const token = await user.getIdToken();
                        const result = await approveCourse(
                          course.id,
                          false,
                          token,
                          reason || undefined
                        );

                        if (result.error) {
                          alert(result.message);
                        } else {
                          console.log("Course rejected successfully");
                        }
                      } catch (error) {
                        console.error("Error:", error);
                        alert("حدث خطأ أثناء رفض الدورة");
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading === course.id}
                    variant="destructive"
                    className="disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4 ml-2" />
                    رفض الدورة
                  </Button>

                  <Button variant="outline" asChild>
                    <Link href={`/Course/${course.id}`}>
                      <Eye className="h-4 w-4 ml-2" />
                      عرض التفاصيل
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/course-upload/edit/${course.id}`}>
                      <Edit className="h-4 w-4 ml-2" />
                      تعديل
                    </Link>
                  </Button>
                </div>
              )}

              {activeTab === "approved" && (
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                  <Button
                    onClick={async () => {
                      if (!confirm("هل أنت متأكد من رفض هذه الدورة؟")) return;
                      const reason = prompt("سبب الرفض (اختياري):");
                      if (reason === null) return;

                      setActionLoading(course.id);
                      try {
                        const token = await user.getIdToken();
                        const result = await approveCourse(
                          course.id,
                          false,
                          token,
                          reason || undefined
                        );

                        if (result.error) {
                          alert(result.message);
                        } else {
                          console.log("Course rejected successfully");
                        }
                      } catch (error) {
                        console.error("Error:", error);
                        alert("حدث خطأ أثناء رفض الدورة");
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading === course.id}
                    variant="destructive"
                    className="disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4 ml-2" />
                    رفض الدورة
                  </Button>

                  <Button variant="outline" asChild>
                    <Link href={`/Course/${course.id}`}>
                      <Eye className="h-4 w-4 ml-2" />
                      عرض التفاصيل
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/course-upload/edit/${course.id}`}>
                      <Edit className="h-4 w-4 ml-2" />
                      تعديل
                    </Link>
                  </Button>
                </div>
              )}

              {activeTab === "rejected" && (
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                  <Button
                    onClick={async () => {
                      if (!confirm("هل أنت متأكد من اعتماد هذه الدورة؟"))
                        return;
                      setActionLoading(course.id);
                      try {
                        const token = await user.getIdToken();
                        const result = await approveCourse(
                          course.id,
                          true,
                          token
                        );

                        if (result.error) {
                          alert(result.message);
                        } else {
                          console.log("Course approved successfully");
                        }
                      } catch (error) {
                        console.error("Error:", error);
                        alert("حدث خطأ أثناء الموافقة على الدورة");
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading === course.id}
                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4 ml-2" />
                    اعتماد الدورة
                  </Button>

                  <Button variant="outline" asChild>
                    <Link href={`/Course/${course.id}`}>
                      <Eye className="h-4 w-4 ml-2" />
                      عرض التفاصيل
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/course-upload/edit/${course.id}`}>
                      <Edit className="h-4 w-4 ml-2" />
                      تعديل
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Helper component for Badge (if not already imported)
function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        className || "bg-gray-100 text-gray-800"
      }`}
    >
      {children}
    </span>
  );
}
