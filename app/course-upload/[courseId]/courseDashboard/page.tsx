import { fetchCourseDetails } from "@/data/courses";
import CourseDashboard from "@/components/CourseDashboard";

export default async function Page({
  params,
}: {
  params: { courseId: string };
}) {
  try {
    const Course = await fetchCourseDetails(params.courseId);
    if (!Course) {
      throw new Error("Course not found");
    }
    function cleanCourseData(course: any) {
      return {
        ...course,
        createdAt:
          course.createdAt?.toDate?.() instanceof Date
            ? course.createdAt.toDate()
            : course.createdAt,
        updatedAt:
          course.updatedAt?.toDate?.() instanceof Date
            ? course.updatedAt.toDate()
            : course.updatedAt,
      };
    }
    const CleanCourse = cleanCourseData(Course);
    return <CourseDashboard courseData={CleanCourse} />;
  } catch (error) {
    console.error("Failed to load course:", error);
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg" dir="rtl">
        <h1 className="text-xl font-bold text-red-800 mb-2">
          خطأ في تحميل الدورة
        </h1>
        <p className="text-red-600">
          لم يتم العثور على دورة بالمعرف: {params.courseId}
        </p>
      </div>
    );
  } // (optional) fetch public course fields here with server action / DB
}
