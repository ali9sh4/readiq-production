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
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-gray-200 rounded-full"></div>
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 rounded w-48"></div>
                <div className="h-4 bg-gray-200 rounded w-64"></div>
              </div>
            </div>
          </CardContent>
        </Card>
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
          <p className="text-gray-600">يرجى تسجيل الدخول لعرض الملف الشخصي</p>
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
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الملف الشخصي</h1>
          <p className="text-gray-600 mt-1">إدارة معلوماتك الشخصية وإعداداتك</p>
        </div>
      </div>

      {/* Profile Information Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-l from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">المعلومات الشخصية</CardTitle>
              <CardDescription>بياناتك الأساسية في المنصة</CardDescription>
            </div>
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="w-4 h-4 ml-2" />
                تعديل
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>
                  <Save className="w-4 h-4 ml-2" />
                  حفظ
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 ml-2" />
                  إلغاء
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Profile Picture */}
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-32 h-32 border-4 border-white shadow-lg">
                {auth.user.photoURL && (
                  <Image
                    src={auth.user.photoURL}
                    alt="صورة المستخدم"
                    width={128}
                    height={128}
                    className="rounded-full object-cover"
                  />
                )}
                <AvatarFallback className="text-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  {auth.user.displayName?.charAt(0) || "ع"}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                {!!auth.CustomClaims?.admin && (
                  <Badge className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                    <Shield className="w-3 h-3 ml-1" />
                    مدير المنصة
                  </Badge>
                )}
              </div>
            </div>

            {/* Profile Details */}
            <div className="flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Display Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    الاسم المعروض
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="أدخل اسمك المعروض"
                    />
                  ) : (
                    <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                      {auth.user.displayName || "غير محدد"}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    البريد الإلكتروني
                  </label>
                  <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                    {auth.user.email}
                  </p>
                  <p className="text-xs text-gray-500">
                    لا يمكن تغيير البريد الإلكتروني
                  </p>
                </div>

                {/* Account Creation Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    تاريخ إنشاء الحساب
                  </label>
                  <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                    {formatDate(auth.user.metadata?.creationTime)}
                  </p>
                </div>

                {/* Last Sign In */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    آخر تسجيل دخول
                  </label>
                  <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                    {formatDate(auth.user.metadata?.lastSignInTime)}
                  </p>
                </div>
              </div>

              {/* Account Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  حالة الحساب
                </label>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200"
                  >
                    نشط
                  </Badge>
                  {auth.user.emailVerified && (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200"
                    >
                      البريد الإلكتروني مُتحقق
                    </Badge>
                  )}
                  {!!auth.CustomClaims?.admin && (
                    <Badge
                      variant="outline"
                      className="bg-purple-50 text-purple-700 border-purple-200"
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
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Settings className="w-5 h-5" />
            إعدادات الحساب
          </CardTitle>
          <CardDescription>إجراءات متقدمة لإدارة حسابك</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-16 flex flex-col gap-2 text-right"
              onClick={() => {
                // Handle password change - for now just show an alert
                alert("سيتم إضافة هذه الميزة قريباً");
              }}
            >
              <Settings className="w-5 h-5" />
              <span>تغيير كلمة المرور</span>
            </Button>

            <Button
              variant="outline"
              className="h-16 flex flex-col gap-2 text-right"
              onClick={() => {
                // Handle privacy settings
                alert("سيتم إضافة هذه الميزة قريباً");
              }}
            >
              <Shield className="w-5 h-5" />
              <span>إعدادات الخصوصية</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
