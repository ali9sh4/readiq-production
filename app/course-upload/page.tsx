import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { PlusCircleIcon } from "lucide-react";
import Link from "next/link";

export default function Courses (){
    return (
        <div  className="container mx-auto px-4 py-8" >
            <Breadcrumbs
        items={[
          {
            href: "/",
            label: "الرئيسية",
          },
          {
           
            label: "لوحة إدارة الكورسات",
          },
       
        ]}
      />
            <h1 className="text-2xl font-bold text-gray-800 mt-4 mb-6">لوحة ادارة الكورسات</h1>

            <Button asChild className="inline-flex items-center pl-2 gap-2 mt-4">
                <Link href="/course-upload/new" className="flex items-center">
                    <PlusCircleIcon className="ml-2 h-5 w-5" /> 
                    <span>إضافة كورس جديد</span>
                </Link>
            </Button>
        </div>
        )


}