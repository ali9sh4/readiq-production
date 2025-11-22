"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/authContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Award,
  Download,
  Share2,
  Calendar,
  BookOpen,
  Trophy,
  AlertCircle,
  Gift,
  Link,
} from "lucide-react";

// Mock certificates data (since there's no certificate system yet)
interface Certificate {
  id: string;
  courseTitle: string;
  instructor: string;
  completionDate: string;
  certificateUrl?: string;
  grade?: string;
  credentialId: string;
}

export default function DashboardCertificates() {
  const auth = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock loading delay
    const timer = setTimeout(() => {
      // For now, set empty certificates since there's no system yet
      setCertificates([]);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleDownload = (certificate: Certificate) => {
    // Mock download functionality
    alert(`تحميل شهادة: ${certificate.courseTitle}`);
  };

  const handleShare = (certificate: Certificate) => {
    // Mock share functionality
    alert(`مشاركة شهادة: ${certificate.courseTitle}`);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header - Enhanced */}
      <div className="relative bg-[#FDD835] rounded-3xl p-6 sm:p-8 text-white shadow-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-lg">
              <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold drop-shadow-lg">
                شهاداتي
              </h1>
              <p className="text-amber-50 mt-1 text-sm sm:text-base">
                جميع الشهادات التي حصلت عليها من الدورات المكتملة
              </p>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/30 shadow-lg">
            <p className="text-xs text-amber-50 mb-1">إجمالي الشهادات</p>
            <p className="text-3xl font-bold">{certificates.length}</p>
          </div>
        </div>
      </div>

      {/* Certificates Grid */}
      {certificates.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {certificates.map((certificate) => (
            <div
              key={certificate.id}
              className="group bg-white rounded-2xl border-2 border-gray-100 shadow-lg hover:shadow-2xl hover:border-blue-200 transition-all duration-300 overflow-hidden hover:scale-[1.02] active:scale-95"
            >
              {/* Certificate Header */}
              <div className="relative overflow-hidden bg-blue-600 p-5 sm:p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30 shadow-lg">
                    <Award className="w-6 h-6 text-amber-300" />
                  </div>
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border border-white/30 text-xs shadow-sm">
                    شهادة إتمام
                  </Badge>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white line-clamp-2 mb-1">
                  {certificate.courseTitle}
                </h3>
                <p className="text-blue-100 text-xs sm:text-sm">
                  {certificate.instructor}
                </p>
              </div>

              {/* Certificate Body */}
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">
                    {formatDate(certificate.completionDate)}
                  </span>
                </div>

                {certificate.grade && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">التقدير:</span>
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200 text-xs font-semibold"
                    >
                      {certificate.grade}
                    </Badge>
                  </div>
                )}

                <div className="text-[10px] sm:text-xs text-gray-500 bg-blue-50 p-2.5 rounded-lg break-all border border-blue-100">
                  <span className="font-mono">
                    ID: {certificate.credentialId}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleDownload(certificate)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-semibold">تحميل</span>
                  </button>
                  <button
                    onClick={() => handleShare(certificate)}
                    className="bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-blue-300 text-gray-700 rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-200 active:scale-95"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="text-sm font-semibold">مشاركة</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Empty State - Enhanced
        <div className="bg-white rounded-3xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="p-8 sm:p-12 lg:p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="relative inline-block mb-6">
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                  <Gift className="w-12 h-12 sm:w-14 sm:h-14 text-amber-500" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-sm">✨</span>
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                لا توجد شهادات بعد
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-8 leading-relaxed">
                أكمل دوراتك الأولى للحصول على شهادات رقمية تثبت إنجازاتك
                التعليمية. كل دورة تكملها ستحصل على شهادة معتمدة يمكنك مشاركتها
                مع أصحاب العمل.
              </p>
              <a href="/user_dashboard">
                <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-8 py-4 font-semibold transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95">
                  العودة للوحة التحكم
                </button>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon Features - Enhanced */}
      <div className="bg-white rounded-3xl shadow-xl border-2 border-blue-100 overflow-hidden">
        <div className="bg-blue-50 px-6 py-6 sm:px-8 sm:py-8 border-b border-blue-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-lg">🚀</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              ميزات قادمة
            </h2>
          </div>
          <p className="text-gray-600 text-sm sm:text-base">
            ميزات جديدة ستتوفر قريباً لتحسين تجربة الشهادات
          </p>
        </div>
        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="group bg-blue-50 border-2 border-blue-100 hover:border-blue-300 rounded-2xl p-4 transition-all duration-300 hover:shadow-lg cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm sm:text-base mb-1">
                    مشاركة على LinkedIn
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600">
                    شارك شهاداتك مباشرة على ملفك المهني
                  </p>
                </div>
              </div>
            </div>

            <div className="group bg-green-50 border-2 border-green-100 hover:border-green-300 rounded-2xl p-4 transition-all duration-300 hover:shadow-lg cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm sm:text-base mb-1">
                    شهادات رقمية محققة
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600">
                    تحقق من صحة الشهادات عبر البلوك تشين
                  </p>
                </div>
              </div>
            </div>

            <div className="group bg-purple-50 border-2 border-purple-100 hover:border-purple-300 rounded-2xl p-4 transition-all duration-300 hover:shadow-lg cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm sm:text-base mb-1">
                    نظام النقاط والإنجازات
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600">
                    اجمع نقاط واحصل على شارات خاصة
                  </p>
                </div>
              </div>
            </div>

            <div className="group bg-orange-50 border-2 border-orange-100 hover:border-orange-300 rounded-2xl p-4 transition-all duration-300 hover:shadow-lg cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm sm:text-base mb-1">
                    تصاميم شهادات متنوعة
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600">
                    اختر من بين تصاميم مختلفة للشهادات
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
