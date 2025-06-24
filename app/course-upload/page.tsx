
import PublicCoursesCardList from "@/components/publicCoursesCardList";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { PlusCircleIcon } from "lucide-react";
import Link from "next/link";

type SearchParams = {
  cursor?: string;
  category?: string;
  level?: string;
};

export default async function Courses({
  searchParams = {}
}: {
  searchParams?: SearchParams;
}) {
  // ✅ Remove duplicate data fetching - let PublicCoursesCardList handle it

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          {
            href: "/",
            label: "الرئيسية",
          },
          {
            label: "الدورات المتاحة", // ✅ Updated title for public view
          },
        ]}
      />
      
      <div className="flex justify-between items-center mt-4 mb-6">
        {/* ✅ Optional: Add course upload button if user is instructor */}
        <Button asChild className="inline-flex items-center gap-2">
          <Link href="/course-upload/new" className="flex items-center">
            <PlusCircleIcon className="h-5 w-5" /> 
            <span>إضافة كورس جديد</span>
          </Link>
        </Button>
      </div>
      
      {/* ✅ Pass searchParams to enable pagination */}
      <PublicCoursesCardList searchParams={searchParams} />
    </div>
  );
}
  
// This page serves as the public view for courses, allowing users to browse available courses. 