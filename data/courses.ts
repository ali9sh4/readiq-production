import { db, getTotalPages } from "@/firebase/service";
import { Course, CourseResponse, GetCourseOptions } from "@/types/types";
import "server-only";

export const getCourses = async (
  options?: GetCourseOptions
): Promise<CourseResponse> => {
  try {
    const pageSize = options?.pagination?.pageSize || 8;
    const lastDocId = options?.pagination?.lastDocId;
    const { category, level, language, userId, isApproved, isRejected } =
      options?.filters || {};

    let CoursesQuery = db.collection("courses").orderBy("updatedAt", "desc");

    if (userId) {
      CoursesQuery = CoursesQuery.where("createdBy", "==", userId);
    }
    if (isApproved !== undefined) {
      CoursesQuery = CoursesQuery.where("isApproved", "==", isApproved);
    }
    if (isRejected !== undefined) {
      CoursesQuery = CoursesQuery.where("isRejected", "==", isRejected);
    }

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

    // ✅ FIXED: Properly handle potential ID conflicts
    const courses: Course[] = CoursesSnapShot.docs
      .slice(0, pageSize)
      .map((doc) => {
        const docData = doc.data();

        // ✅ Remove any 'id' field from document data to prevent conflicts
        const { id: dataFieldId, ...cleanData } = docData;

        // 🔍 Debug log to see if there are ID conflicts
        if (dataFieldId && dataFieldId !== doc.id) {
          console.warn(
            `⚠️ ID conflict detected for course "${docData.title}":`,
            {
              firestoreId: doc.id,
              dataFieldId: dataFieldId,
              using: doc.id,
            }
          );
        }

        return {
          id: doc.id, // ✅ Always use Firestore document ID
          ...cleanData, // ✅ Spread everything except the conflicting 'id'
        } as Course;
      });

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

// ✅ FIXED: Handle potential ID conflicts in single course fetch
export const fetchCourseDetails = async (
  courseId: string
): Promise<Course | null> => {
  try {
    // ✅ Validate courseId
    if (!courseId || typeof courseId !== "string" || courseId.trim() === "") {
      console.error(
        "❌ Invalid courseId provided to fetchCourseDetails:",
        courseId
      );
      return null;
    }

    const courseSnapshot = await db
      .collection("courses")
      .doc(courseId.trim())
      .get();

    // ✅ Check if document exists
    if (!courseSnapshot.exists) {
      console.warn("⚠️ Course not found:", courseId);
      return null;
    }

    const docData = courseSnapshot.data();

    if (!docData) {
      console.warn("⚠️ Course document has no data:", courseId);
      return null;
    }

    // ✅ Remove any 'id' field from document data to prevent conflicts
    const { id: dataFieldId, ...cleanData } = docData;

    // 🔍 Debug log to see if there are ID conflicts
    if (dataFieldId && dataFieldId !== courseSnapshot.id) {
      console.warn(
        `⚠️ ID conflict detected in fetchCourseDetails for "${docData.title}":`,
        {
          firestoreId: courseSnapshot.id,
          dataFieldId: dataFieldId,
          using: courseSnapshot.id,
        }
      );
    }

    const course: Course = {
      id: courseSnapshot.id, // ✅ Always use Firestore document ID
      ...cleanData, // ✅ Spread everything except the conflicting 'id'
    } as Course;

    return course;
  } catch (error) {
    console.error("❌ Error in fetchCourseDetails:", error);
    return null;
  }
};

// ✅ BONUS: Add a function to clean up existing courses with ID conflicts
export const debugCourseIds = async () => {
  try {
    const snapshot = await db.collection("courses").limit(10).get();

    const conflicts = snapshot.docs
      .map((doc) => {
        const docData = doc.data();
        return {
          firestoreId: doc.id,
          dataFieldId: docData.id,
          hasConflict: docData.id && docData.id !== doc.id,
          title: docData.title,
        };
      })
      .filter((course) => course.hasConflict);

    if (conflicts.length > 0) {
      console.warn("🚨 Found courses with ID conflicts:", conflicts);
    } else {
      console.log("✅ No ID conflicts found in courses");
    }

    return conflicts;
  } catch (error) {
    console.error("Error checking course ID conflicts:", error);
    return [];
  }
};

// ✅ BONUS: Function to fix a specific course ID conflict
export const fixCourseIdConflict = async (courseId: string) => {
  try {
    const courseRef = db.collection("courses").doc(courseId);
    const courseDoc = await courseRef.get();

    if (!courseDoc.exists) {
      throw new Error(`Course ${courseId} not found`);
    }

    const docData = courseDoc.data();

    if (docData?.id && docData.id !== courseId) {
      // Remove the conflicting 'id' field from document data
      const { id: conflictingId, ...cleanData } = docData;

      await courseRef.update(cleanData);

      console.log(`✅ Fixed ID conflict for course ${courseId}:`, {
        removed: conflictingId,
        firestoreId: courseId,
      });

      return true;
    }

    return false; // No conflict found
  } catch (error) {
    console.error(`Error fixing course ID conflict for ${courseId}:`, error);
    throw error;
  }
};
