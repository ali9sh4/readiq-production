import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchCourseDetails } from "@/data/courses";
import { adminAuth, db } from "@/firebase/service";
import CourseDashboard from "@/components/CourseDashboard";
import PhoneNudgeBanner from "@/components/PhoneNudgeBanner";

// Anyone on the course edit page is a course creator, so the phone nudge here
// is gated on phone alone (no separate instructor check). Takes the caller's
// already-verified uid; a read failure is non-fatal and simply hides the nudge.
async function getNeedsPhone(uid: string): Promise<boolean> {
  try {
    const userSnap = await db.collection("users").doc(uid).get();
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
  const { courseId } = await params;

  // Ownership gate. Verify the caller, then confirm they own this course (or
  // are an admin) before rendering the editor — closes a cross-tenant read
  // leak. Verify INSIDE the try but redirect OUTSIDE it: redirect() throws
  // NEXT_REDIRECT, which a catch must never swallow (the bug this page had).
  const token = (await cookies()).get("firebaseAuthToken")?.value;
  if (!token) redirect("/login");

  let verified;
  try {
    verified = await adminAuth.verifyIdToken(token);
  } catch {
    verified = null;
  }
  if (!verified) redirect("/login");

  const Course = await fetchCourseDetails(courseId);
  if (!Course) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h1 className="text-xl font-bold text-red-800 mb-2">
          Error Loading Course
        </h1>
        <p className="text-red-600">
          Could not find course with ID: {courseId}
        </p>
        <p className="text-sm text-red-500 mt-2">
          Please check the URL and try again.
        </p>
      </div>
    );
  }

  // Authenticated-but-not-owner bounces to home, matching the middleware
  // admin-area convention. Admin via the custom claim, like the write-side
  // guards on the course-mutation actions.
  if (Course.createdBy !== verified.uid && verified.admin !== true) {
    redirect("/");
  }

  const needsPhone = await getNeedsPhone(verified.uid);

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
