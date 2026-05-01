// ORPHANED 2026-05-01 — not imported anywhere. Email/password sign-in was hidden from UI in favor of Google-only. File kept on disk for fast rollback. Scheduled for deletion after one week of stable Google-only operation. See docs/MOBILE_PROJECT_STATE.md "Auth migration" entry.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";

import ContWithGoogleButton from "@/components/ContWithGoogleButton";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { registerFormSchema } from "@/validation/registerFormSchema";
import RegisterAction from "./action";

type FormData = z.infer<typeof registerFormSchema>;

// Password requirements checker
const passwordRequirements = [
  { label: "8 أحرف على الأقل", test: (p: string) => p.length >= 8 },
  {
    label: "حرف وارقام",
    test: (p: string) => /[a-zA-Z]/.test(p) && /\d/.test(p),
  },
];

export default function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: "",
      password: "",
      passwordConfirm: "",
      name: "",
    },
  });

  const watchPassword = form.watch("password");

  const handleSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const response = await RegisterAction(data);

      toast.success("تم إنشاء الحساب بنجاح! 🎉", {
        description: "مرحباً بك في المنصة",
      });
      router.push("/");
    } catch (error: any) {
      toast.error("فشل إنشاء الحساب", {
        description: error.message || "حدث خطأ غير متوقع",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <fieldset
            disabled={form.formState.isSubmitting}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم الكامل</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="أدخل اسمك الكامل"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>البريد الإلكتروني</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="example@email.com"
                      disabled={isLoading}
                      dir="ltr"
                      className="text-left"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>كلمة المرور</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="أدخل كلمة المرور"
                        disabled={isLoading}
                        dir="ltr"
                        className="text-left pl-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password Requirements Checklist */}
            {watchPassword && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  متطلبات كلمة المرور:
                </p>
                {passwordRequirements.map((req, index) => {
                  const isMet = req.test(watchPassword);
                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-2 text-sm transition-colors ${
                        isMet ? "text-green-600" : "text-muted-foreground"
                      }`}
                    >
                      {isMet ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      <span>{req.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <FormField
              control={form.control}
              name="passwordConfirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تأكيد كلمة المرور</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="أعد إدخال كلمة المرور"
                        disabled={isLoading}
                        dir="ltr"
                        className="text-left pl-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="mt-2 w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري إنشاء الحساب...
                </>
              ) : (
                "إنشاء حساب"
              )}
            </Button>
          </fieldset>
        </form>
      </Form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            أو المتابعة باستخدام
          </span>
        </div>
      </div>

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
    </div>
  );
}
