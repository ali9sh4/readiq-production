import { z } from "zod";

export const registerFormSchema = z
  .object({
    name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
    email: z.string().email("البريد الإلكتروني غير صالح"),
    password: z
      .string()
      .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
      .regex(/[a-zA-Z]/, "يجب أن تحتوي على حرف واحد على الأقل")
      .regex(/\d/, "يجب أن تحتوي على رقم واحد على الأقل"),
    passwordConfirm: z.string().min(1, "تأكيد كلمة المرور مطلوب"),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "كلمة المرور غير متطابقة",
    path: ["passwordConfirm"],
  });
