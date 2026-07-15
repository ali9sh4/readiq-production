// lib/services/userService.ts
import { db } from "@/firebase/client";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  FieldValue
} from "firebase/firestore";
import { User } from "firebase/auth";
import { buildNewUserDocFields } from "@/lib/services/userDoc";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  // Optional, user-entered contact phone, canonical local "07XXXXXXXXX" form.
  // See lib/validation/phone.ts. Editable by the user (web profile) or an admin.
  phone?: string;
  // WhatsApp marketing opt-in (optional, web capture only — see PhoneConsentCard
  // and the profile page). `marketingConsentAt` is an audit record stamped with a
  // Firestore server timestamp ONLY when consent flips false→true; it is typed
  // `Timestamp | FieldValue` because the write passes serverTimestamp(), while
  // reads return a Timestamp. `phonePromptDismissed` is the "don't ask again" flag.
  marketingConsent?: boolean;
  marketingConsentAt?: Timestamp | FieldValue;
  phonePromptDismissed?: boolean;
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
        ...buildNewUserDocFields({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (process.env.NODE_ENV !== "production") {
        console.log("✅ New user created in Firestore:", user.uid);
      }
    } else {
      // Existing user - only update auth-related fields
      await updateDoc(userRef, {
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || null,
        updatedAt: serverTimestamp(),
      });
      if (process.env.NODE_ENV !== "production") {
        console.log("✅ User updated in Firestore:", user.uid);
      }
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