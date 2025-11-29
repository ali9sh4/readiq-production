"use server";
import { adminAuth } from "@/firebase/service";
import { registerFormSchema } from "@/validation/registerFormSchema";

export default async function RegisterAction(data: {
  email: string;
  name: string;
  password: string;
  passwordConfirm: string;
}) {
  const validateData = registerFormSchema.safeParse(data);
  if (!validateData.success) {
    return {
      error: true,
      message:
        validateData.error.issues[0]?.message ?? "حدث خطأ اثناء تسجيل الدخول",
    };
  }
  try {
    // ⚠️ CRITICAL: Must await the async operation
    const userRecord = await adminAuth.createUser({
      displayName: data.name,
      email: data.email,
      password: data.password,
    });

    return {
      success: true,
      uid: userRecord.uid,
    };
  } catch (error: any) {
    console.error("Registration error:", error);

    // Handle specific Firebase errors
    if (error.code === "auth/email-already-exists") {
      throw new Error("البريد الإلكتروني مستخدم بالفعل");
    } else if (error.code === "auth/invalid-email") {
      throw new Error("البريد الإلكتروني غير صالح");
    } else if (error.code === "auth/weak-password") {
      throw new Error("كلمة المرور ضعيفة جداً");
    }

    throw new Error("فشل إنشاء الحساب. يرجى المحاولة مرة أخرى");
  }
}
