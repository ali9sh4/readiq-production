// lib/services/userDoc.ts
//
// SDK-agnostic helpers for the `users/{uid}` Firestore document.
// Both the client SDK (`createOrUpdateUser` in `userService.ts`) and the
// admin SDK (`POST /api/me` in `app/api/me/route.ts`) build new user docs
// from this shape, so the field defaults live in exactly one place.
// Timestamps stay SDK-specific at each call site (client `serverTimestamp()`
// vs admin `FieldValue.serverTimestamp()`).

export interface NewUserDocInput {
  uid: string;
  email: string | null | undefined;
  displayName: string | null | undefined;
  photoURL: string | null | undefined;
}

export interface NewUserDocFields {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  // Optional, user-entered contact phone (canonical local "07XXXXXXXXX" form;
  // see lib/validation/phone.ts). Google sign-in never provides a phone, so it
  // is OMITTED from new docs — set later via the web profile or admin editor.
  // Never written at signup, so account creation is unaffected.
  phone?: string;
  createdCourses: string[];
  enrolledCourses: string[];
  walletBalance: number;
  coursesCompleted: number;
  language: "ar" | "en";
  notifications: boolean;
  // Instructor earnings (see docs/INSTRUCTOR_PAYOUTS.md). Set on every new
  // user since any user may later publish a course. `revenueSharePercent`
  // is the instructor's share of a sale; editable per-instructor. All sale
  // and payout code defensively defaults a missing value, so legacy user
  // docs without these fields behave as 70 / 0 / 0.
  revenueSharePercent: number;
  earningsTotal: number;
  payoutsTotal: number;
}

// The instructor's default share of a sale, in percent. The launch deal;
// renegotiated per-instructor later by editing `users/{uid}.revenueSharePercent`.
export const DEFAULT_REVENUE_SHARE_PERCENT = 70;

export function buildNewUserDocFields(input: NewUserDocInput): NewUserDocFields {
  return {
    uid: input.uid,
    email: input.email || "",
    displayName: input.displayName || "",
    photoURL: input.photoURL || null,
    createdCourses: [],
    enrolledCourses: [],
    walletBalance: 0,
    coursesCompleted: 0,
    language: "ar",
    notifications: true,
    revenueSharePercent: DEFAULT_REVENUE_SHARE_PERCENT,
    earningsTotal: 0,
    payoutsTotal: 0,
  };
}
