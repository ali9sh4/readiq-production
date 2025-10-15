// app/course/[courseId]/watch/page.tsx
import { getCourseById } from "@/app/course-upload/action";
import CoursePlayer from "@/components/ui/CoursePlayer";
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
  const result = await getCourseById(courseId);

  if (!result.success || !result.course) {
    redirect("/courses");
  }

  // ✅ Clean the data HERE on the server before passing to client
  const cleanedCourse = cleanCourseData(result.course);

  // TODO: Check if user is enrolled
  // const isEnrolled = await checkEnrollment(userId, courseId);

  return <CoursePlayer course={cleanedCourse} isEnrolled={true} />;
}
