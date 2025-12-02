// /app/user_dashboard/updatePassword/page.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { adminAuth } from "@/firebase/service";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import UpdatePasswordForm from "@/components/UpdatePasswordForm";

export default async function UpdatePasswordPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("firebaseAuthToken")?.value;

  if (!token) {
    redirect("/login");
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (error) {
    console.log("Invalid token, redirecting to login.", error);
    redirect("/login");
  }

  // ✅ Get user and check provider
  const userRecord = await adminAuth.getUser(decodedToken.uid);
  const isPasswordProvider = userRecord.providerData.some(
    (provider) => provider.providerId === "password"
  );

  // ✅ If user signed in with Google, they can't change password
  if (!isPasswordProvider) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              غير متاح
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">
              لقد قمت بتسجيل الدخول باستخدام Google. لا يمكنك تغيير كلمة المرور
              لأنك لا تملك واحدة.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              إذا كنت تريد استخدام كلمة مرور، يمكنك إنشاء حساب جديد باستخدام
              البريد الإلكتروني وكلمة المرور.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ User has password provider - show the form
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>تحديث كلمة المرور</CardTitle>
        </CardHeader>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
