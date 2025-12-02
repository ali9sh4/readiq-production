// /app/forget-password/page.tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ForgetPasswordPageForm from "./forget-password-form";

export default function ForgetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-right">
          <CardTitle className="text-2xl">نسيت كلمة المرور</CardTitle>
          <CardDescription>
            أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgetPasswordPageForm />
        </CardContent>
      </Card>
    </div>
  );
}
