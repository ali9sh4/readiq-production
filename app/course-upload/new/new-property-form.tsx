'use client';

import { SaveNewProperty } from "@/app/course-upload/action";
import CourseForm from "@/components/ui/property-form";
import { useAuth } from "@/context/authContext";
import { CourseDataSchema } from "@/validation/propertySchema";
import { PlusCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation"; // ✅ Correct import
import { toast } from "sonner";
import z from "zod";

export default function NewPropertyForm() {
    const auth = useAuth();
    const router = useRouter(); // ✅ Use the hook

    const handleSubmit = async (data: z.infer<typeof CourseDataSchema>) => {
        const token = await auth?.user?.getIdToken();
        if (!token) {
            console.error("User is not authenticated. Please log in.");
            return;
        }   
       
        const response = await SaveNewProperty({...data , token })
        if (!!response.error){
            toast.error("حدث خطأ أثناء حفظ الدورة: " ,{
                description: response.message || "يرجى المحاولة مرة أخرى.",
            });
            return;
        }
        
        toast.success("تم حفظ الدورة بنجاح!", {
            description: "يمكنك الآن إدارة الدورة من لوحة التحكم.",
        });
        
        router.push("/course-upload"); // ✅ Now this will work

        console.log({response});
    }

    return (
        <div>
            <CourseForm
                submitButtonLabel={
                    <div dir="rtl" className="flex items-center gap-2">
                        <PlusCircleIcon className="w-4 h-4" />
                        <span>إنشاء دورة جديدة</span>
                    </div>
                } 
                handleSubmit={handleSubmit}
            />
        </div>
    );
}