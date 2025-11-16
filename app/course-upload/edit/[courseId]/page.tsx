import { fetchCourseDetails } from "@/data/courses";
import CourseDashboard from "@/components/CourseDashboard";

export default async function EditCoursePage({
  params,
}: {
  params: { courseId: string };
}) {
  try {
    const { courseId } = await params;

    // ✅ Add detailed logging
    console.log("=== COURSE EDIT PAGE ===");
    console.log("Course ID:", courseId);
    console.log("Environment:", process.env.NODE_ENV);

    // ✅ Fetch course with error handling
    const Course = await fetchCourseDetails(courseId);

    console.log("Course fetched:", Course ? "SUCCESS" : "NULL");

    if (!Course) {
      console.error("❌ Course not found for ID:", courseId);

      return (
        <div className="container mx-auto px-4 py-8">
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
            <h1 className="text-xl font-bold text-red-800 mb-2">
              Course Not Found
            </h1>
            <p className="text-red-600">
              Could not find course with ID: {courseId}
            </p>
            <p className="text-sm text-red-500 mt-2">
              Please check the URL and try again.
            </p>
            <pre className="mt-4 text-xs bg-red-100 p-2 rounded">
              Course ID: {courseId}
            </pre>
          </div>
        </div>
      );
    }

    // ✅ Clean course data
    function cleanCourseData(course: any) {
      return {
        ...course,
        createdAt: course.createdAt?.toDate
          ? course.createdAt.toDate().toISOString()
          : course.createdAt || null,
        updatedAt: course.updatedAt?.toDate
          ? course.updatedAt.toDate().toISOString()
          : course.updatedAt || null,
        approvedAt: course.approvedAt?.toDate
          ? course.approvedAt.toDate().toISOString()
          : course.approvedAt || null,
        rejectedAt: course.rejectedAt?.toDate
          ? course.rejectedAt.toDate().toISOString()
          : course.rejectedAt || null,
      };
    }

    const CleanCourse = cleanCourseData(Course);

    console.log("✅ Course cleaned successfully, title:", CleanCourse.title);

    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mt-6 mb-4">تعديل الدورة</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <CourseDashboard defaultValues={CleanCourse} />
        </div>
      </div>
    );
  } catch (error) {
    // ✅ Enhanced error logging
    console.error("=== COURSE EDIT PAGE ERROR ===");
    console.error("Error type:", error?.constructor?.name);
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error)
    );
    console.error("Full error:", error);
    console.error("Stack:", error instanceof Error ? error.stack : "No stack");

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h1 className="text-xl font-bold text-red-800 mb-2">
            Error Loading Course
          </h1>
          <p className="text-red-600 mb-4">
            An unexpected error occurred while loading the course.
          </p>
          <div className="bg-red-100 p-4 rounded text-sm font-mono">
            <p className="font-bold mb-2">Error Details:</p>
            <p className="text-red-800">
              {error instanceof Error ? error.message : String(error)}
            </p>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Check Vercel function logs for more details.
          </p>
        </div>
      </div>
    );
  }
}
