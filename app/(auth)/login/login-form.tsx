"use client";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/authContext";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

export default function LoginForm() {
  const router = useRouter();
  const auth = useAuth();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    const success = await auth?.loginWithEmail(data.email, data.password);
    router.refresh();

    if (success) {
      toast.success("تم تسجيل الدخول بنجاح");
      router.push("/");
    } else {
      // The error is already set in the auth context
      // You can use it or show a generic message
      toast.error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    }
  };

  return (
    <div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <fieldset
            disabled={form.formState.isSubmitting}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="البريد الإلكتروني" {...field} />
                    </FormControl>
                  </FormItem>
                );
              }}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="كلمة المرور"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                );
              }}
            />

            <Button type="submit" className="mt-2">
              login
            </Button>

            {/* Better spacing for forgot password link */}
            <div className="text-center text-sm mt-4">
              <span className="text-muted-foreground">
                هل نسيت كلمة المرور؟{" "}
              </span>
              <Link
                href="/forget-password"
                className="underline hover:text-primary"
              >
                اعادة تعيين كلمة المرور
              </Link>
            </div>
          </fieldset>
        </form>
      </Form>
    </div>
  );
}
