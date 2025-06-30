import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { fetchCourseDetails } from "@/data/courses";
import NewPropertyForm from "../../new/new-property-form";

export default async function EditCoursePage({
  params,
}: {
  params: { courseId: string };
}) {
  try {
    // ✅ Use the actual courseId from params
    const Course = await fetchCourseDetails(params.courseId);
    console.log("Course Details:", Course);

    return (
      <div className="container mx-auto px-4 py-8">
        <div>
          <h1>{Course?.id}</h1>
          <h1>{Course?.title}</h1>
        </div>
        <Breadcrumbs
          items={[
            {
              href: "/course-upload",
              label: "لوحة إدارة الكورسات",
            },
            {
              label: "تعديل دورة",
            },
          ]}
        />
        <h1 className="text-3xl font-bold mt-6 mb-4">تعديل الدورة</h1>

        <div className="bg-white rounded-lg shadow-md p-6">
          <NewPropertyForm />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Failed to load course:", error);

    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h1 className="text-xl font-bold text-red-800 mb-2">
          Error Loading Course
        </h1>
        <p className="text-red-600">
          Could not find course with ID: {params.courseId}
        </p>
        <p className="text-sm text-red-500 mt-2">
          Please check the URL and try again.
        </p>
      </div>
    );
  }
}
