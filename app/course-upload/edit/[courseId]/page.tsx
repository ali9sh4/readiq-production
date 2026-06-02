import { cookies } from "next/headers";
import { fetchCourseDetails } from "@/data/courses";
import { adminAuth, db } from "@/firebase/service";
import CourseDashboard from "@/components/CourseDashboard";
import PhoneNudgeBanner from "@/components/PhoneNudgeBanner";

// Anyone on the course edit page is a course creator, so the phone nudge here
// is gated on phone alone (no separate instructor check). Read server-side the
// same way app/user_dashboard/page.tsx does; a read failure is non-fatal and
// simply hides the nudge.
async function getNeedsPhone(): Promise<boolean> {
  try {
    const token = (await cookies()).get("firebaseAuthToken")?.value;
    if (!token) return false;
    const verified = await adminAuth.verifyIdToken(token);
    const userSnap = await db.collection("users").doc(verified.uid).get();
    const phone = userSnap.exists ? userSnap.data()?.phone : undefined;
    return !(typeof phone === "string" && phone.trim());
  } catch {
    return false;
  }
}

export default async function EditCoursePage({
  params,
}: {
  params: { courseId: string };
}) {
  try {
    const { courseId } = await params;
    // ✅ Use the actual courseId from params
    const [Course, needsPhone] = await Promise.all([
      fetchCourseDetails(courseId),
      getNeedsPhone(),
    ]);
    if (!Course) {
      throw new Error("Course not found");
    }
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
        <PhoneNudgeBanner needsPhone={needsPhone} className="mb-6" />

        <h1 className="text-3xl font-bold mt-6 mb-4">تعديل الدورة</h1>

        <div className="bg-white rounded-lg shadow-md p-6">
          <CourseDashboard defaultValues={CleanCourse} />
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

/*
the old way 
<EditCourseForm
            id={params.courseId}
            title={Course.title}
            subtitle={Course?.subtitle}
            category={Course?.category}
            price={Course?.price}
            description={Course?.description}
            level={Course?.level}
            language={Course?.language}
            duration={Course?.duration}
            requirements={Course?.requirements}
            learningPoints={Course?.learningPoints}
            images={Course?.images}
          />

*/
