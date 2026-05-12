// types/course.ts

// ===== UTILITY TYPES =====
export type FirestoreTimestamp = {
  toDate: () => Date;
  seconds: number;
  nanoseconds: number;
};

export type CourseStatus = "draft" | "published" | "archived";
export type CourseLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "all_levels";
export type CourseLanguage = "arabic" | "english" | "french" | "spanish";

export type CoursePurchaseMode = "full" | "sectional";
export type EnrollmentAccessScope = "full" | "sectional";
export type EnrollmentStatus = "pending" | "completed" | "failed" | "refunded";
export type EnrollmentType = "free" | "paid";
export type EnrollmentPaymentMethod = "wallet" | "zaincash";

// ===== ENTITY TYPES =====

export interface CourseVideo {
  videoId: string;
  courseId: string;
  assetId: string;
  playbackId: string;
  duration?: number;
  title: string;
  uploadedAt: string;
  order?: number;
  originalFilename?: string;
  description?: string;
  section?: string;
  sectionId?: string;
  isVisible?: boolean;
  isFreePreview?: boolean;
}

export interface CourseSection {
  sectionId: string;
  title: string;
  order: number;
  price?: number;
  salePrice?: number;
  isLocked?: boolean;
}

export interface CourseFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  type: string;
  uploadedAt: string;
  order?: number;
  relatedVideoId?: string;
}

export interface Course {
  // ===== Required Fields =====
  id: string;
  title: string;
  category: string;
  createdAt: string | null;
  updatedAt: string | null;

  // ===== Basic Info (Optional) =====
  subtitle?: string;
  description?: string;
  level?: CourseLevel;
  language?: CourseLanguage;
  price?: number;
  salePrice?: number;
  duration?: number;

  // ===== Purchase Mode (Sectional Purchasing) =====
  // Missing or 'full' = whole-course purchase (legacy behavior).
  // 'sectional' = sections are individually purchasable; `fullCoursePrice`
  // is the optional bundle price for buying everything at once.
  purchaseMode?: CoursePurchaseMode;
  fullCoursePrice?: number;
  sections?: CourseSection[];

  // ===== Status & Approval =====
  status?: CourseStatus;
  isApproved?: boolean;
  isRejected?: boolean;
  rejectionReason?: string | null;

  // ===== Content =====
  thumbnailUrl?: string;
  images?: string[];
  videos?: CourseVideo[];
  files?: CourseFile[]; // Using the more detailed CourseFile
  learningPoints?: string[];
  requirements?: string[];

  // ===== Metadata =====
  instructorName?: string;
  createdBy?: string;
  rating?: number;
  ratingCount?: number;
  enrollmentCount?: number;
  studentsCount?: number;
  // ===== Deletion Fields =====
  deletionStatus?: "none" | "requested" | "approved" | "rejected";
  deletionRequestedAt?: string | null;
  deletionRequestedBy?: string; // instructor userId
  deletionRejectedAt?: string | null;
  deletionRejectionReason?: string | null;
  deletedAt?: string | null;
  deletedBy?: string; // admin userId
  isDeleted?: boolean; // Quick check flag
  restoredAt?: string | null;
  restoredBy?: string;
}

// Enrollment doc shape. Stored at `enrollments/{userId}_{courseId}`.
// Legacy docs predate `accessScope` / `ownedSectionIds` — missing
// `accessScope` means full-course access (the only mode that existed before
// sectional). Bundle buyers on a sectional course get `accessScope: 'full'`
// explicitly; per-section buyers get `accessScope: 'sectional'` and a
// populated `ownedSectionIds`. The gate distinguishes unset vs explicit
// `'full'` for log diagnostics only — both grant.
export interface Enrollment {
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  enrollmentType?: EnrollmentType;
  paymentMethod?: EnrollmentPaymentMethod;
  amount?: number;
  paymentId?: string;
  transactionId?: string;
  enrolledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  accessScope?: EnrollmentAccessScope;
  ownedSectionIds?: string[];
}

// ===== API RESPONSE TYPES =====

export interface CourseResponse {
  success: boolean;
  courses: Course[];
  hasMore: boolean;
  nextCursor: string | null;
  totalPages?: number;
  error?: string;
}

export interface GetCourseOptions {
  filters?: {
    category?: string;
    level?: CourseLevel;
    language?: CourseLanguage;
    isApproved?: boolean;
    isRejected?: boolean;
    userId?: string;
    status?: CourseStatus;
    enrolledUserId?: string;
    isDeleted?: boolean;
  };
  pagination?: {
    pageSize?: number;
    lastDocId?: string;
  };
}
