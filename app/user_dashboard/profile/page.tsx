"use client";

import { useState } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  User,
  Mail,
  Shield,
  Calendar,
  Settings,
  Edit,
  Save,
  X,
  AlertCircle,
} from "lucide-react";
import Image from "next/image";
import { updateProfile } from "firebase/auth";
import { updateUserProfile } from "@/lib/services/userService";

export default function DashboardProfile() {
  const auth = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(auth.user?.displayName || "");

  const handleSave = async () => {
    if (!auth.user) return;
    try {
      await updateProfile(auth.user, { displayName });
      await updateUserProfile(auth.user.uid, { displayName });
      setIsEditing(false);
      alert("✅ تم تحديث الاسم المعروض بنجاح");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    }
  };

  if (!auth.isClient) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-6 sm:h-8 bg-gray-200 rounded animate-pulse"></div>
        <Card className="animate-pulse">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gray-200 rounded-full"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 sm:h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="flex items-center justify-center p-4 sm:p-8">
        <Card className="p-4 sm:p-6 text-center max-w-md w-full">
          <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-red-700 mb-2">
            غير مسجل الدخول
          </h3>
          <p className="text-sm sm:text-base text-gray-600">
            يرجى تسجيل الدخول لعرض الملف الشخصي
          </p>
        </Card>
      </div>
    );
  }

  const handleCancel = () => {
    setDisplayName(auth.user?.displayName || "");
    setIsEditing(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "غير محدد";
    return new Date(dateString).toLocaleDateString("en-US");
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header - FIXED */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          الملف الشخصي
        </h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">
          إدارة معلوماتك الشخصية وإعداداتك
        </p>
      </div>

      {/* Profile Information Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-l from-blue-50 to-indigo-50 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg sm:text-xl">
                المعلومات الشخصية
              </CardTitle>
              <CardDescription className="text-sm">
                بياناتك الأساسية في المنصة
              </CardDescription>
            </div>
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="self-start sm:self-auto"
              >
                <Edit className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                <span className="text-sm">تعديل</span>
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>
                  <Save className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                  <span className="text-sm">حفظ</span>
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  <X className="w-3 h-3 sm:w-4 sm:h-4 ml-2" />
                  <span className="text-sm">إلغاء</span>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
            {/* Profile Picture */}
            <div className="flex flex-col items-center space-y-3 sm:space-y-4">
              <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-white shadow-lg">
                {auth.user.photoURL && (
                  <Image
                    src={auth.user.photoURL}
                    alt="صورة المستخدم"
                    width={128}
                    height={128}
                    className="rounded-full object-cover"
                  />
                )}
                <AvatarFallback className="text-2xl sm:text-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  {auth.user.displayName?.charAt(0) || "ع"}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                {!!auth.CustomClaims?.admin && (
                  <Badge className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs sm:text-sm">
                    <Shield className="w-3 h-3 ml-1" />
                    مدير المنصة
                  </Badge>
                )}
              </div>
            </div>

            {/* Profile Details */}
            <div className="flex-1 space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Display Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm">الاسم المعروض</span>
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="أدخل اسمك المعروض"
                    />
                  ) : (
                    <p className="text-sm sm:text-base text-gray-900 bg-gray-50 px-3 py-2 rounded-lg break-words">
                      {auth.user.displayName || "غير محدد"}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm">
                      البريد الإلكتروني
                    </span>
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 bg-gray-50 px-3 py-2 rounded-lg break-all">
                    {auth.user.email}
                  </p>
                  <p className="text-xs text-gray-500">
                    لا يمكن تغيير البريد الإلكتروني
                  </p>
                </div>

                {/* Account Creation Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm">
                      تاريخ إنشاء الحساب
                    </span>
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                    {formatDate(auth.user.metadata?.creationTime)}
                  </p>
                </div>

                {/* Last Sign In */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm">آخر تسجيل دخول</span>
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                    {formatDate(auth.user.metadata?.lastSignInTime)}
                  </p>
                </div>
              </div>

              {/* Account Status */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700">
                  حالة الحساب
                </label>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200 text-xs"
                  >
                    نشط
                  </Badge>
                  {auth.user.emailVerified && (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                    >
                      البريد الإلكتروني مُتحقق
                    </Badge>
                  )}
                  {!!auth.CustomClaims?.admin && (
                    <Badge
                      variant="outline"
                      className="bg-purple-50 text-purple-700 border-purple-200 text-xs"
                    >
                      صلاحيات الإدارة
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            إعدادات الحساب
          </CardTitle>
          <CardDescription className="text-sm">
            إجراءات متقدمة لإدارة حسابك
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Button
              variant="outline"
              className="h-14 sm:h-16 flex flex-col gap-1.5 sm:gap-2 text-center justify-center"
              onClick={() => {
                alert("سيتم إضافة هذه الميزة قريباً");
              }}
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">تغيير كلمة المرور</span>
            </Button>

            <Button
              variant="outline"
              className="h-14 sm:h-16 flex flex-col gap-1.5 sm:gap-2 text-center justify-center"
              onClick={() => {
                alert("سيتم إضافة هذه الميزة قريباً");
              }}
            >
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">إعدادات الخصوصية</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
