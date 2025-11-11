// lib/services/userService.ts
import { db } from "@/firebase/client";
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  Timestamp 
} from "firebase/firestore";
import { User } from "firebase/auth";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  bio?: string;
  website?: string;
  createdCourses: string[];
  enrolledCourses: string[];
  walletBalance: number;
  coursesCompleted: number;
  totalStudents?: number;
  averageRating?: number;
  language: "ar" | "en";
  notifications: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Creates or updates user document in Firestore
 * Uses merge: true to avoid overwriting existing data
 */
export async function createOrUpdateUser(user: User): Promise<void> {
  try {
    const userRef = doc(db, "users", user.uid);
    
    // Check if user already exists
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // New user - create with defaults
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || null,
        createdCourses: [],
        enrolledCourses: [],
        walletBalance: 0,
        coursesCompleted: 0,
        language: "ar",
        notifications: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log("✅ New user created in Firestore:", user.uid);
    } else {
      // Existing user - only update auth-related fields
      await updateDoc(userRef, {
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || null,
        updatedAt: serverTimestamp(),
      });
      console.log("✅ User updated in Firestore:", user.uid);
    }
  } catch (error) {
    console.error("❌ Error creating/updating user:", error);
    throw error;
  }
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("❌ Error getting user profile:", error);
    return null;
  }
}

/**
 * Update user profile fields
 */
export async function updateUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    console.log("✅ User profile updated");
  } catch (error) {
    console.error("❌ Error updating user profile:", error);
    throw error;
  }
}