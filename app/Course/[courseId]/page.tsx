"use server";
import { checkUserEnrollments } from "@/app/actions/enrollment_action";
import { checkIfFavorited } from "@/app/actions/favorites_actions";
import { getCourseById } from "@/app/course-upload/action";
import CoursePreview from "@/components/CoursePreview";
import CoursePlayer from "@/components/ui/CoursePlayer";
import { getCurrentUser } from "@/data/auth-server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, BookOpen } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";

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
export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseId: string }>;
}): Promise<Metadata> {
  const { courseId } = await params;

  // Fetch course data
  const result = await getCourseById(courseId);

  if (!result.success || !result.course) {
    return {
      title: "الدورة غير موجودة | Rubik",
      description: "لا يمكن العثور على هذه الدورة",
    };
  }

  const course = result.course;

  // Calculate price to display
  let displayPrice = course.price || 0;
  if (course.salePrice && course.salePrice < displayPrice) {
    displayPrice = course.salePrice;
  }

  return {
    title: `${course.title} | Rubik - روبيك`,
    description:
      course.description ||
      course.subtitle ||
      `تعلم ${course.title} على منصة RUBIK`,
    keywords: [
      course.title,
      course.category,
      "دورة تعليمية",
      "تعليم عن بعد",
      "دورات عراقية",
      course.instructorName || "Rubik",
    ],
    openGraph: {
      title: course.title,
      description: course.description || course.subtitle || "",
      type: "article",
      url: `https://www.rubiktech.org/course/${courseId}`, // also fix double slashes
      siteName: "Rubik",
      locale: "ar_IQ",
      images: course.thumbnailUrl
        ? [
            {
              url: course.thumbnailUrl,
              width: 1200,
              height: 630,
              alt: course.title,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: course.title,
      description: course.description || course.subtitle || "",
      images: course.thumbnailUrl ? [course.thumbnailUrl] : [],
    },
    alternates: {
      canonical: `https://www.rubiktech.org/course/${courseId}`,
    },
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
    return <CourseNotFound />;
  }

  const cleanedCourse = cleanCourseData(result.course);

  // 2. Get authentication
  const cookieStore = await cookies();
  const token = cookieStore.get("firebaseAuthToken")?.value;
  let isFavorited = false;

  if (!token) {
    // ✅ Check if deleted for guests
    if (cleanedCourse.isDeleted === true) {
      return <CourseDeleted />;
    }
    return <CoursePreview course={cleanedCourse} initialIsFavorited={false} />;
  }

  const authResult = await getCurrentUser({ token });

  if (!authResult.success || !authResult.user) {
    // ✅ Check if deleted for invalid tokens
    if (cleanedCourse.isDeleted === true) {
      return <CourseDeleted />;
    }
    return <CoursePreview course={cleanedCourse} initialIsFavorited={false} />;
  }

  const favResult = await checkIfFavorited(token, courseId);
  isFavorited = favResult.isFavorited;

  // 3. Check enrollment
  const user = authResult.user;
  const isAdmin = authResult.isAdmin || false;
  const isInstructor = cleanedCourse.createdBy === user.uid;

  // ✅ Admin bypass - full access even to deleted courses
  if (isAdmin) {
    return <CoursePlayer course={cleanedCourse} isEnrolled={true} />;
  }

  // ✅ Now check if deleted (after admin check)
  if (cleanedCourse.isDeleted === true) {
    return <CourseDeleted />;
  }

  const enrollmentResult = await checkUserEnrollments(user.uid, [courseId]);
  const isEnrolled = enrollmentResult.enrollments?.[courseId] || false;

  // 4. Render based on enrollment status
  if (isInstructor) {
    return <CoursePlayer course={cleanedCourse} isEnrolled={true} />;
  }
  if (isEnrolled) {
    return <CoursePlayer course={cleanedCourse} isEnrolled={true} />;
  }

  return (
    <CoursePreview course={cleanedCourse} initialIsFavorited={isFavorited} />
  );
}

// ✅ NEW: Error component for deleted courses
function CourseDeleted() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50"
      dir="rtl"
    >
      <div className="text-center p-8 max-w-md">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          الدورة غير متاحة
        </h1>
        <p className="text-gray-600 mb-8">
          هذه الدورة لم تعد متاحة. تم حذفها من قبل المدرب.
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/">تصفح الدورات</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/user_dashboard">لوحة التحكم</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ✅ NEW: Error component for non-existent courses
function CourseNotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50"
      dir="rtl"
    >
      <div className="text-center p-8 max-w-md">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-10 h-10 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          الدورة غير موجودة
        </h1>
        <p className="text-gray-600 mb-8">
          لا يمكن العثور على هذه الدورة. ربما تم حذفها أو الرابط غير صحيح.
        </p>
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link href="/">تصفح جميع الدورات</Link>
        </Button>
      </div>
    </div>
  );
}
