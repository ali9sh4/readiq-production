"use server";

import { updateCourseAction } from "@/data/courses";
import { adminAuth } from "@/firebase/service";
import { CourseDataSchema } from "@/validation/propertySchema";
import z from "zod";

export const UpdateCourse = async (
  data: z.infer<typeof CourseDataSchema> & {
    id: string; // Required, not optional
    token: string; // Consistent with SaveNewProperty
  }
) => {
  const { id, token, ...courseToUpdate } = data;

  // Verify authentication
  const verifiedToken = await adminAuth.verifyIdToken(token);
  if (!verifiedToken) {
    return {
      error: true,
      message: "Please log in again.",
    };
  }

  // Validate course data
  const validation = CourseDataSchema.safeParse(courseToUpdate);
  if (!validation.success) {
    return {
      error: true,
      message: validation.error.issues[0].message ?? "Invalid data provided.",
    };
  }

  // Update course
  const result = await updateCourseAction(id, courseToUpdate);
  if (result.success) {
    return {
      success: true,
      message: "Course updated successfully",
      courseId: result.courseId,
    };
  } else {
    return {
      error: true,
      message: result.message || "Failed to update course",
    };
  }
};
