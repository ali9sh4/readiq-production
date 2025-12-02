// /components/UpdatePasswordForm.tsx
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
import { Loader2, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/authContext";
import { toast } from "sonner";
import {
  EmailAuthCredential,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
    newPassword: z
      .string()
      .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
      .regex(/[a-zA-Z]/, "يجب أن تحتوي على حرف واحد على الأقل")
      .regex(/\d/, "يجب أن تحتوي على رقم واحد على الأقل"),
    passwordConfirm: z.string().min(1, "تأكيد كلمة المرور مطلوب"),
  })
  .refine((data) => data.newPassword === data.passwordConfirm, {
    message: "كلمات المرور غير متطابقة",
    path: ["passwordConfirm"],
  });

type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;

export default function UpdatePasswordForm() {
  const auth = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      passwordConfirm: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof updatePasswordSchema>) => {
    const user = auth?.user;
    if (!user?.email) {
      toast.error("يرجى تسجيل الدخول");
      return;
    }

    try {
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, data.currentPassword)
      );
      await updatePassword(user, data.newPassword);
      toast.success("تم تحديث كلمة المرور بنجاح");
      form.reset();
    } catch (error: any) {
      console.error("Password update error:", error);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password"
      ) {
        toast.error("كلمة المرور الحالية غير صحيحة");
      } else if (error.code === "auth/weak-password") {
        toast.error("كلمة المرور الجديدة ضعيفة جداً");
      } else if (error.code === "auth/requires-recent-login") {
        toast.error("يرجى تسجيل الخروج ثم الدخول مرة أخرى");
      } else {
        toast.error("حدث خطأ أثناء تحديث كلمة المرور");
      }
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h3 className="font-semibold text-blue-900">
              نصائح لكلمة مرور قوية
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• استخدم 8 أحرف على الأقل</li>
              <li>• اجمع بين الأحرف والأرقام</li>
              <li>• لا تستخدم كلمات مرور سهلة التخمين</li>
            </ul>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <fieldset
            className="flex flex-col gap-4"
            disabled={form.formState.isSubmitting}
          >
            {/* Current Password */}
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-right block">
                    كلمة المرور الحالية *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="أدخل كلمة المرور الحالية"
                      className="text-right"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* New Password */}
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-right block">
                    كلمة المرور الجديدة *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="أدخل كلمة المرور الجديدة"
                      className="text-right"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Confirm Password */}
            <FormField
              control={form.control}
              name="passwordConfirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-right block">
                    تأكيد كلمة المرور الجديدة *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="أعد إدخال كلمة المرور الجديدة"
                      className="text-right"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full gap-2"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري التحديث...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  تحديث كلمة المرور
                </>
              )}
            </Button>
          </fieldset>
        </form>
      </Form>
    </div>
  );
}
