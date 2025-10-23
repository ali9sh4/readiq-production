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

  if (!auth.isClient || loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">
            غير مسجل الدخول
          </h3>
          <p className="text-gray-600">يرجى تسجيل الدخول لعرض الشهادات</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">شهاداتي</h1>
          <p className="text-gray-600 mt-1">
            جميع الشهادات التي حصلت عليها من الدورات المكتملة
          </p>
        </div>
        <div className="flex items-center gap-2 text-amber-600">
          <Trophy className="w-6 h-6" />
          <span className="text-lg font-semibold">
            {certificates.length} شهادة
          </span>
        </div>
      </div>

      {/* Achievement Banner */}
      <Card className="border-0 shadow-lg bg-gradient-to-l from-amber-50 via-yellow-50 to-orange-50">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
                <Award className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  إنجازاتك التعليمية
                </h2>
                <p className="text-gray-600">
                  كل شهادة تمثل خطوة نحو تحقيق أهدافك المهنية
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-amber-600">
                {certificates.length}
              </p>
              <p className="text-amber-700 font-medium">شهادة مكتملة</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificates Grid */}
      {certificates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((certificate) => (
            <Card
              key={certificate.id}
              className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              <CardHeader className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-purple-700 text-white">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/90 to-purple-700/90"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <Award className="w-8 h-8 text-amber-300" />
                    <Badge className="bg-white/20 text-white border-0">
                      شهادة إتمام
                    </Badge>
                  </div>
                  <CardTitle className="text-lg line-clamp-2 text-white">
                    {certificate.courseTitle}
                  </CardTitle>
                  <CardDescription className="text-blue-100">
                    {certificate.instructor}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>
                      تاريخ الإكمال: {formatDate(certificate.completionDate)}
                    </span>
                  </div>

                  {certificate.grade && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">التقدير:</span>
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700 border-green-200"
                      >
                        {certificate.grade}
                      </Badge>
                    </div>
                  )}

                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    <span>معرف الشهادة: {certificate.credentialId}</span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleDownload(certificate)}
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 ml-1" />
                      تحميل
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShare(certificate)}
                    >
                      <Share2 className="w-4 h-4 ml-1" />
                      مشاركة
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Empty State
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <Gift className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                لا توجد شهادات بعد
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                أكمل دوراتك الأولى للحصول على شهادات رقمية تثبت إنجازاتك
                التعليمية. كل دورة تكملها ستحصل على شهادة معتمدة يمكنك مشاركتها
                مع أصحاب العمل.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild>
                  <link href="/">
                    <BookOpen className="w-4 h-4 ml-2" />
                    استكشف الدورات
                  </link>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/dashboard">العودة للوحة التحكم</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coming Soon Features */}
      <Card className="border-0 shadow-lg bg-gradient-to-l from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="text-xl text-blue-900">ميزات قادمة</CardTitle>
          <CardDescription className="text-blue-700">
            ميزات جديدة ستتوفر قريباً لتحسين تجربة الشهادات
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-white rounded-lg">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Share2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">
                  مشاركة على LinkedIn
                </h4>
                <p className="text-sm text-gray-600">
                  شارك شهاداتك مباشرة على ملفك المهني
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-white rounded-lg">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">
                  شهادات رقمية محققة
                </h4>
                <p className="text-sm text-gray-600">
                  تحقق من صحة الشهادات عبر البلوك تشين
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-white rounded-lg">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Trophy className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">
                  نظام النقاط والإنجازات
                </h4>
                <p className="text-sm text-gray-600">
                  اجمع نقاط واحصل على شارات خاصة
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-white rounded-lg">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Download className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">
                  تصاميم شهادات متنوعة
                </h4>
                <p className="text-sm text-gray-600">
                  اختر من بين تصاميم مختلفة للشهادات
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
////<DropdownMenuItem asChild>
//<Link href="/dashboard">لوحة التحكم</Link>
///</DropdownMenuItem>
