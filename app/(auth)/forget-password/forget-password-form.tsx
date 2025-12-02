// /app/forget-password/forget-password-form.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { auth } from "@/firebase/client";
import { sendPasswordResetEmail } from "firebase/auth";
import { toast } from "sonner";
import { Loader2, Mail, CheckCircle } from "lucide-react";

const forgetPasswordSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
});

type ForgetPasswordFormData = z.infer<typeof forgetPasswordSchema>;

export default function ForgetPasswordPageForm() {
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<ForgetPasswordFormData>({
    resolver: zodResolver(forgetPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgetPasswordFormData) => {
    try {
      await sendPasswordResetEmail(auth, data.email);
      setEmailSent(true);
      toast.success(
        "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني"
      );
    } catch (error: any) {
      console.error("Password reset error:", error);

      if (error.code === "auth/user-not-found") {
        toast.error("البريد الإلكتروني غير مسجل");
      } else if (error.code === "auth/invalid-email") {
        toast.error("البريد الإلكتروني غير صالح");
      } else if (error.code === "auth/too-many-requests") {
        toast.error("تم إرسال عدد كبير من الطلبات. يرجى المحاولة لاحقاً");
      } else {
        toast.error("حدث خطأ. يرجى المحاولة مرة أخرى");
      }
    }
  };

  // ✅ Show success message after email sent
  if (emailSent) {
    return (
      <div className="text-center space-y-4 py-6" dir="rtl">
        <div className="flex justify-center">
          <div className="bg-green-100 rounded-full p-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            تم إرسال البريد الإلكتروني!
          </h3>
          <p className="text-sm text-gray-600">
            تحقق من بريدك الإلكتروني واتبع التعليمات لإعادة تعيين كلمة المرور
          </p>
        </div>

        {/* Spam warning with icon */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-right">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-yellow-900">
                💡 لم تجد البريد الإلكتروني؟
              </p>
              <ul className="text-xs text-yellow-800 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600">•</span>
                  <span>
                    تحقق من مجلد{" "}
                    <strong>الرسائل غير المرغوب فيها (Spam)</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600">•</span>
                  <span>قد يستغرق وصول البريد بضع دقائق</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600">•</span>
                  <span>تأكد من كتابة البريد الإلكتروني بشكل صحيح</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => setEmailSent(false)}
          className="w-full gap-2"
        >
          <Mail className="h-4 w-4" />
          إرسال مرة أخرى
        </Button>

        <div className="pt-2">
          <a href="/login" className="text-sm text-blue-600 hover:underline">
            العودة لتسجيل الدخول
          </a>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-right block">
                  البريد الإلكتروني *
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder="example@email.com"
                    className="text-right"
                    disabled={form.formState.isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full gap-2"
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                إرسال رابط إعادة التعيين
              </>
            )}
          </Button>
        </form>
      </Form>

      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          تذكرت كلمة المرور؟{" "}
          <a
            href="/login"
            className="text-blue-600 hover:underline font-medium"
          >
            تسجيل الدخول
          </a>
        </p>
      </div>
    </div>
  );
}
