import Link from "next/link";
import ContWithGoogleButton from "@/components/ContWithGoogleButton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold">إنشاء حساب جديد</CardTitle>
          <CardDescription className="text-base">
            إنشاء الحساب متاح عبر حساب جوجل فقط
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ContWithGoogleButton />

          <p className="text-center text-sm text-muted-foreground">
            لديك حساب بالفعل؟{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              تسجيل الدخول
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
