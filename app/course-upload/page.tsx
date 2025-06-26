import InstructorCourse from "@/components/instructorCourse";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

import { PlusCircleIcon } from "lucide-react";

import Link from "next/link";

type SearchParams = {
  cursor?: string;
  category?: string;
  level?: string;
  userId?: string; // Optional: If you want to filter by userId
};

export default async function Courses({
  searchParams = {},
}: {
  searchParams?: SearchParams;
}) {
  // ✅ Pass currentUserId to PublicCoursesCardList if needed

  // Combine searchParams with currentUserId if user is logged in

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
      <InstructorCourse searchParams={searchParams} />
    </div>
  );
}

// This page serves as the public view for courses, allowing users to browse available courses.
