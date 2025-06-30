  "use server";

import { adminAuth, db } from "@/firebase/service";
import { CourseDataSchema } from "@/validation/propertySchema";
import z from "zod";

export const SaveNewProperty = async (
  data: z.infer<typeof CourseDataSchema> & { token: string }
) => {
  const { token, ...CourseData } = data;
  const verifiedToken = await adminAuth.verifyIdToken(token);

  if (!verifiedToken) {
    return {
      error: true,
      message: "Please log in again.",
    };
  }

  const validation = CourseDataSchema.safeParse(CourseData);
  if (!validation.success) {
    return {
      error: true,
      message: validation.error.issues[0].message ?? "Invalid data provided.",
    };
  }
  const courseToSave = {
    ...CourseData,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: verifiedToken.uid, // Track who created it
    isApproved: false,
    isRejected: false,
  };
  const courseRef = await db.collection("courses").add(courseToSave);
  return {
    success: true,
    courseId: courseRef.id,
  };
};

//in the future you need to use v9 (modular) SDK you import it from firebase/firestore,
