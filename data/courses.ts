import { db, getTotalPages } from "@/firebase/service";
import { Course, CourseResponse, GetCourseOptions } from "@/types/types";
import "server-only";

export const getCourses = async (
  options?: GetCourseOptions
): Promise<CourseResponse> => {
  try {
    const pageSize = options?.pagination?.pageSize || 8;
    const lastDocId = options?.pagination?.lastDocId;
    const { category, level, language } = options?.filters || {};

    let CoursesQuery = db.collection("courses").orderBy("updatedAt", "desc");

    if (category) {
      CoursesQuery = CoursesQuery.where("category", "==", category);
    }
    if (level) {
      CoursesQuery = CoursesQuery.where("level", "==", level);
    }
    if (language) {
      CoursesQuery = CoursesQuery.where("language", "==", language);
    }

    // ✅ Safe cursor pagination
    if (lastDocId) {
      try {
        const lastDoc = await db.collection("courses").doc(lastDocId).get();
        if (lastDoc.exists) {
          CoursesQuery = CoursesQuery.startAfter(lastDoc);
        } else {
          console.warn("Cursor document does not exist:", lastDocId);
        }
      } catch (cursorError) {
        console.warn("Invalid cursor, ignoring:", cursorError);
        // Continue without cursor
      }
    }
    const totalPages = await getTotalPages(CoursesQuery, pageSize);

    const CoursesSnapShot = await CoursesQuery.limit(pageSize + 1).get();

    // ✅ Properly type the courses array
    const courses: Course[] = CoursesSnapShot.docs
      .slice(0, pageSize)
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Course, "id">), // Type assertion for Firestore data
      }));

    const hasMore = CoursesSnapShot.docs.length > pageSize;
    const nextCursor =
      courses.length > 0 ? courses[courses.length - 1].id : null;

    return {
      success: true,
      courses,
      hasMore,
      nextCursor,
      totalPages,
    };
  } catch (error) {
    console.error("Error fetching courses:", error);
    return {
      success: false,
      courses: [],
      hasMore: false,
      nextCursor: null,
      error: "Failed to fetch courses",
    };
  }
};
