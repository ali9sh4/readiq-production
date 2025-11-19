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
      {/* Page Header - Enhanced */}
      <div className="relative bg-blue-600 rounded-3xl p-6 sm:p-8 text-white shadow-2xl overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-lg">
            <User className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold drop-shadow-lg">
              الملف الشخصي
            </h1>
            <p className="text-purple-50 mt-1 text-sm sm:text-base">
              إدارة معلوماتك الشخصية وإعداداتك
            </p>
          </div>
        </div>
      </div>

      {/* Profile Information Card */}
      <div className="bg-white rounded-3xl shadow-xl border-2 border-gray-100 overflow-hidden">
        <div className="bg-blue-50 px-6 py-6 sm:px-8 sm:py-8 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                المعلومات الشخصية
              </h2>
              <p className="text-gray-600 text-sm sm:text-base">
                بياناتك الأساسية في المنصة
              </p>
            </div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="self-start sm:self-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
              >
                <Edit className="w-4 h-4" />
                <span className="text-sm font-semibold">تعديل</span>
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-4 py-2.5 flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span className="text-sm font-semibold">حفظ</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl px-4 py-2.5 flex items-center gap-2 transition-all duration-200 active:scale-95"
                >
                  <X className="w-4 h-4" />
                  <span className="text-sm font-semibold">إلغاء</span>
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col lg:flex-row gap-8 sm:gap-10">
            {/* Profile Picture */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative group">
                <Avatar className="w-28 h-28 sm:w-36 sm:h-36 ring-4 ring-blue-100 shadow-2xl transition-transform group-hover:scale-105">
                  {auth.user.photoURL && (
                    <Image
                      src={auth.user.photoURL}
                      alt="صورة المستخدم"
                      width={144}
                      height={144}
                      className="rounded-full object-cover"
                    />
                  )}
                  <AvatarFallback className="text-3xl sm:text-4xl bg-blue-600 text-white font-bold">
                    {auth.user.displayName?.charAt(0) || "ع"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                  <span className="text-white font-bold">✓</span>
                </div>
              </div>
              <div className="text-center">
                {!!auth.CustomClaims?.admin && (
                  <div className="bg-purple-600 text-white px-4 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-lg flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    مدير المنصة
                  </div>
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
        </div>
      </div>

      {/* Account Actions - Enhanced */}
      <div className="bg-white rounded-3xl shadow-xl border-2 border-gray-100 overflow-hidden">
        <div className="bg-green-50 px-6 py-6 sm:px-8 sm:py-8 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              إعدادات الحساب
            </h2>
          </div>
          <p className="text-gray-600 text-sm sm:text-base">
            إجراءات متقدمة لإدارة حسابك
          </p>
        </div>
        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => {
                alert("سيتم إضافة هذه الميزة قريباً");
              }}
              className="group bg-blue-50 border-2 border-blue-100 hover:border-blue-400 rounded-2xl p-5 transition-all duration-300 hover:shadow-lg active:scale-95 cursor-pointer"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <span className="font-semibold text-gray-800 text-sm sm:text-base">
                  تغيير كلمة المرور
                </span>
              </div>
            </button>

            <button
              onClick={() => {
                alert("سيتم إضافة هذه الميزة قريباً");
              }}
              className="group bg-purple-50 border-2 border-purple-100 hover:border-purple-400 rounded-2xl p-5 transition-all duration-300 hover:shadow-lg active:scale-95 cursor-pointer"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="font-semibold text-gray-800 text-sm sm:text-base">
                  إعدادات الخصوصية
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
