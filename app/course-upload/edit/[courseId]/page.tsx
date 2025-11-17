import { fetchCourseDetails } from "@/data/courses";
import CourseDashboard from "@/components/CourseDashboard";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  // ✅ Get user info from const cookieStore = await cookies();
const token = cookieStore.get("firebaseAuthToken")?.value;
const decodedToken = await adminAuth.verifyIdToken(token);
const userId = decodedToken.uid;  // ✅ Direct cookie reading

  // ✅ Redirect if not authenticated
  if (!userId) {
    redirect("/login");
  }

  try {
    const { courseId } = await params;

    // ✅ Fetch course
    const Course = await fetchCourseDetails(courseId);

    if (!Course) {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
            <h1 className="text-xl font-bold text-red-800 mb-2">
              لم يتم العثور على الدورة
            </h1>
            <p className="text-red-600">معرف الدورة: {courseId}</p>
            <p className="text-sm text-red-500 mt-2">
              تأكد من صحة الرابط وحاول مرة أخرى
            </p>
          </div>
        </div>
      );
    }

    // ✅ Check if user owns this course
    if (Course.createdBy !== userId) {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h1 className="text-xl font-bold text-yellow-800 mb-2">
              غير مصرح
            </h1>
            <p className="text-yellow-600">
              ليس لديك صلاحية لتعديل هذه الدورة
            </p>
          </div>
        </div>
      );
    }

    // ✅ Clean course data (your old way)
    function cleanCourseData(course: any) {
      return {
        ...course,
        // Convert Firestore Timestamps to ISO strings
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

    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mt-6 mb-4">تعديل الدورة</h1>

        <p className="text-sm text-gray-600 mb-4">المستخدم: {userEmail}</p>

        <div className="bg-white rounded-lg shadow-md p-6">
          <CourseDashboard defaultValues={CleanCourse} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Failed to load course:", error);

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h1 className="text-xl font-bold text-red-800 mb-2">
            خطأ في التحميل
          </h1>
          <p className="text-red-600">
            حدث خطأ أثناء تحميل الدورة. حاول مرة أخرى لاحقاً.
          </p>
        </div>
      </div>
    );
  }
}