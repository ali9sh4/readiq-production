"use server";
import { checkUserEnrollments } from "@/app/actions/enrollment_action";
import { getCourseById } from "@/app/course-upload/action";
import CoursePreview from "@/components/CoursePreview";
import CoursePlayer from "@/components/ui/CoursePlayer";
import { getCurrentUser } from "@/data/auth-server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// ✅ Helper function to clean Firestore data
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

    // Clean nested arrays (videos, files)
    videos:
      course.videos?.map((video: any) => ({
        ...video,
        uploadedAt: video.uploadedAt?.toDate
          ? video.uploadedAt.toDate().toISOString()
          : video.uploadedAt || null,
      })) || [],

    files:
      course.files?.map((file: any) => ({
        ...file,
        uploadedAt: file.uploadedAt?.toDate
          ? file.uploadedAt.toDate().toISOString()
          : file.uploadedAt || null,
      })) || [],
  };
}

export default async function WatchCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  // 1. Get course
  const result = await getCourseById(courseId);
  if (!result.success || !result.course) {
    redirect("/courses");
  }

  const cleanedCourse = cleanCourseData(result.course);

  // 2. Get authentication
  const cookieStore = await cookies();
  const token = cookieStore.get("firebaseAuthToken")?.value;

  if (!token) {
    // ✅ No token - show preview for guests
    return <CoursePreview course={cleanedCourse} />;
  }

  const authResult = await getCurrentUser({ token });

  if (!authResult.success || !authResult.user) {
    // ✅ Invalid token - show preview
    return <CoursePreview course={cleanedCourse} />;
  }

  // 3. Check enrollment
  const user = authResult.user;
  const isAdmin = authResult.isAdmin || false;
  const isInstructor = cleanedCourse.createdBy === user.uid;
  const enrollmentResult = await checkUserEnrollments(user.uid, [courseId]);
  const isEnrolled = enrollmentResult.enrollments?.[courseId] || false;
  if (isAdmin) {
    // ✅ Admin has full access to ALL courses
    return <CoursePlayer course={cleanedCourse} isEnrolled={true} />;
  }

  // 4. Render based on enrollment status
  if (isInstructor) {
    return <CoursePlayer course={cleanedCourse} isEnrolled={true} />;
  }
  if (isEnrolled) {
    // ✅ Enrolled - full access
    return <CoursePlayer course={cleanedCourse} isEnrolled={true} />;
  }

  // ✅ Not enrolled - show preview with enroll option
  return <CoursePreview course={cleanedCourse} />;
}
