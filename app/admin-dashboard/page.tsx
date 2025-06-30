"use client";

///// Add a modal for rejection reason
//const handleReject = async (courseId: string) => {
//const reason = prompt("سبب الرفض:");
//await rejectCourse(courseId, token, reason);
//};

import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/firebase/client";
import { useAuth } from "@/context/authContext";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { approveCourse } from "./action";
import { Course, FirestoreTimestamp } from "@/types/types";

export default function AdminDashboard() {
  const { user, isLoading } = useAuth();
  const [pendingCourses, setPendingCourses] = useState<Course[]>([]);
  const [approvedCourses, setApprovedCourses] = useState<Course[]>([]);
  const [rejectedCourses, setRejectedCourses] = useState<Course[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "pending" | "approved" | "rejected"
  >("pending");

  // Initialize Firestore

  // Real-time listeners for courses
  useEffect(() => {
    if (!user || isLoading) return;

    // Query for all courses since you don't use status field
    const allCoursesQuery = query(
      collection(db, "courses"),
      orderBy("createdAt", "desc")
    );
    // Filter in JavaScript after getting all data

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
      } // ✅ Fixed: removed the extra closing brace
    );
    return () => {
      unsubscribe();
    };
  }, [user, isLoading, db]);

  const formatDate = (timestamp: FirestoreTimestamp | Date | null) => {
    if (!timestamp) return "غير محدد";
    if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
      return timestamp.toDate().toLocaleDateString("ar-SA");
    }
    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString("ar-SA");
    }
    return "غير محدد";
  };

  const getLevelText = (level: string) => {
    const levels = {
      beginner: "مبتدئ",
      intermediate: "متوسط",
      advanced: "متقدم",
      all_levels: "جميع المستويات",
    };
    return levels[level as keyof typeof levels] || level;
  };

  const getLanguageText = (language: string) => {
    const languages = {
      arabic: "العربية",
      english: "الإنجليزية",
      french: "الفرنسية",
      spanish: "الإسبانية",
    };
    return languages[language as keyof typeof languages] || language;
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
      <Breadcrumbs
        items={[
          { label: "الرئيسية", href: "/" },
          { label: "لوحة التحكم الإدارية" },
        ]}
      />

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">
          لوحة التحكم الإدارية
        </h1>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      </div>

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
        </nav>
      </div>

      {/* Course List */}
      <div className="space-y-6">
        {getCurrentCourses().length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">
              {activeTab === "pending" && "لا توجد دورات قيد المراجعة"}
              {activeTab === "approved" && "لا توجد دورات معتمدة"}
              {activeTab === "rejected" && "لا توجد دورات مرفوضة"}
            </p>
          </div>
        ) : (
          getCurrentCourses().map((course) => (
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
                    {course.image && (
                      <img
                        src={course.image}
                        alt={course.title}
                        className="w-24 h-24 object-cover rounded-lg mr-4"
                      />
                    )}
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
                      <p className="text-gray-900">${course.price}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">
                        المستوى:
                      </span>
                      <p className="text-gray-900">
                        {getLevelText(course.level)}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">اللغة:</span>
                      <p className="text-gray-900">
                        {getLanguageText(course.language)}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">المدة:</span>
                      <p className="text-gray-900">{course.duration} ساعة</p>
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
                </div>
              </div>

              {/* Action Buttons */}
              {activeTab === "pending" && (
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                  <Button
                    onClick={async () => {
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
                      setActionLoading(course.id);
                      try {
                        const token = await user.getIdToken();
                        const result = await approveCourse(
                          course.id,
                          false,
                          token
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

                  <Button variant="outline" className="mr-auto">
                    <Eye className="h-4 w-4 ml-2" />
                    عرض التفاصيل
                  </Button>
                </div>
              )}

              {activeTab === "approved" && (
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                  <Button
                    onClick={async () => {
                      setActionLoading(course.id);
                      try {
                        const token = await user.getIdToken();
                        const result = await approveCourse(
                          course.id,
                          false,
                          token
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

                  <Button variant="outline">
                    <Eye className="h-4 w-4 ml-2" />
                    عرض التفاصيل
                  </Button>
                </div>
              )}

              {activeTab === "rejected" && (
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                  <Button
                    onClick={async () => {
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

                  <Button variant="outline">
                    <Eye className="h-4 w-4 ml-2" />
                    عرض التفاصيل
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
