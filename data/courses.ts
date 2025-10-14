import { db, getTotalPages } from "@/firebase/service";
import { Course, CourseResponse, GetCourseOptions } from "@/types/types";
import { CourseDataSchema } from "@/validation/propertySchema";
import "server-only";
import z from "zod";
import * as admin from "firebase-admin";

const courseRepository = {
  query() {
    return db.collection("courses");
  },
  async update(
    id: string,
    data: z.infer<typeof CourseDataSchema>
  ): Promise<void> {
    try {
      await db
        .collection("courses")
        .doc(id)
        .update({
          ...data,
        });
    } catch (error) {
      console.error("Error updating course:", error);
      throw new Error("Failed to update course");
    }
  },
  async getById(id: string): Promise<Course | null> {
    try {
      if (!id || typeof id !== "string" || id.trim() === "") {
        console.error("Invalid course ID provided:", id);
        return null;
      }
      const doc = await db.collection("courses").doc(id.trim()).get();
      if (!doc.exists) {
        console.warn("Course not found for ID:", id);
        return null;
      }
      const docData = doc.data();
      if (!docData) {
        console.warn("Course document has no data for ID:", id);
        return null;
      }
      const { id: dataFieldId, ...cleanData } = docData;
      if (dataFieldId && dataFieldId !== doc.id) {
        console.warn(`ID conflict detected for course "${cleanData.title}"`);
      }

      const course: Course = {
        id: doc.id,
        ...cleanData,
      } as Course;

      return course;
    } catch (error) {
      console.error("Database error getting course:", error);
      throw new Error("Failed to retrieve course from database");
    }
  },
  async getCursor(
    lastDoc: string | null
  ): Promise<admin.firestore.DocumentSnapshot | null> {
    try {
      if (!lastDoc) {
        return null;
      }
      const doc = await db.collection("courses").doc(lastDoc).get();
      if (!doc.exists) {
        console.warn("Cursor document does not exist:", lastDoc);
        return null;
      }
      return doc;
    } catch (error) {
      console.error("Error getting cursor document:", error);
      throw new Error("Failed to retrieve cursor document");
    }
  },
};

export const getCourses = async (
  options?: GetCourseOptions
): Promise<CourseResponse> => {
  try {
    const pageSize = options?.pagination?.pageSize || 8;
    const lastDocId = options?.pagination?.lastDocId;
    const { category, level, language, userId, isApproved, isRejected } =
      options?.filters || {};

    let CoursesQuery = courseRepository.query().orderBy("updatedAt", "desc");

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
      }
    }

    const totalPages = await getTotalPages(CoursesQuery, pageSize);
    const CoursesSnapShot = await CoursesQuery.limit(pageSize + 1).get();

    // In /data/courses.ts, getCourses function
    const coursesList: Course[] = CoursesSnapShot.docs
      .slice(0, pageSize)
      .map((doc) => {
        const docData = doc.data();
        const { ...cleanData } = docData;

        return {
          ...cleanData,
          id: doc.id,
          // ✅ Convert Firestore Timestamps to strings
          createdAt: cleanData.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: cleanData.updatedAt?.toDate?.()?.toISOString() || null,
          approvedAt: cleanData.approvedAt?.toDate?.()?.toISOString() || null,
          rejectedAt: cleanData.rejectedAt?.toDate?.()?.toISOString() || null,
          title: cleanData.title || "",
          category: cleanData.category || "",
        } as Course;
      });

    const hasMore = CoursesSnapShot.docs.length > pageSize;
    const nextCursor =
      coursesList.length > 0 ? coursesList[coursesList.length - 1].id : null;

    return {
      success: true,
      courses: coursesList,
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

export const updateCourseAction = async (
  courseId: string,
  data: z.infer<typeof CourseDataSchema>
) => {
  try {
    await courseRepository.update(courseId, data);
    return {
      success: true,
      message: "Course updated successfully",
      courseId: courseId,
    };
  } catch (error) {
    console.error("Error updating course:", error);
    return {
      success: false,
      message: "Failed to update course",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const fetchCourseDetails = async (
  id: string
): Promise<Course | null> => {
  try {
    const course = await courseRepository.getById(id);
    return course as Course | null;
  } catch (error) {
    console.error("Error getting course:", error);
    return null;
  }
};

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
      console.warn("Found courses with ID conflicts:", conflicts);
    }

    return conflicts;
  } catch (error) {
    console.error("Error checking course ID conflicts:", error);
    return [];
  }
};

export const fixCourseIdConflict = async (courseId: string) => {
  try {
    const courseRef = db.collection("courses").doc(courseId);
    const courseDoc = await courseRef.get();

    if (!courseDoc.exists) {
      throw new Error(`Course ${courseId} not found`);
    }

    const docData = courseDoc.data();

    if (docData?.id && docData.id !== courseId) {
      const { id: conflictingId, ...cleanData } = docData;

      await courseRef.update(cleanData);

      console.log(`Fixed ID conflict for course ${courseId}:`, {
        removed: conflictingId,
        firestoreId: courseId,
      });

      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error fixing course ID conflict for ${courseId}:`, error);
    throw error;
  }
};
