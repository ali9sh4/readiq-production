"use server";

import { updateCourseAction } from "@/data/courses";
import { CourseDataSchema } from "@/validation/propertySchema";
import { adminAuth, db } from "@/firebase/service";
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
/*
export const deleteImage = async (imagePath: string, UserToken: string) => {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(UserToken);
    if (!verifiedToken) {
      return {
        error: true,
        message: "Please log in again.",
      };
    }
    const bucket = adminStorage.bucket();
    const file = bucket.file(imagePath);
    const [exists] = await file.exists();
    if (!exists) {
      return {
        success: true,
        message: "Image already deleted",
      };
    }
    await file.delete();
    console.log("✅ Image deleted successfully:", imagePath);
    return {
      success: true,
      message: "Image deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting image:", error);
    return false;
  }
}; 
*/
export const SaveImages = async (
  {
    courseId,
    images,
  }: {
    courseId: string;
    images: string[];
  },
  token: string
) => {
  const verifiedToken = await adminAuth.verifyIdToken(token);
  if (!verifiedToken) {
    return {
      error: true,
      message: "Please log in again.",
    };
  }
  const schema = z.object({
    courseId: z.string(),
    images: z.array(z.string()),
  });
  const validation = schema.safeParse({ courseId, images });
  if (!validation.success) {
    return {
      error: true,
      message: validation.error.issues[0]?.message ?? "Invalid data provided.",
    };
  }
  await db.collection("courses").doc(courseId).update({
    images,
  });
};
