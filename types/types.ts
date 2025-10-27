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
  orderInSection?: number;
  isVisible?: boolean;
  isFreePreview?: boolean;
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
  duration?: number;

  // ===== Status & Approval =====
  status?: CourseStatus;
  isApproved?: boolean;
  isRejected?: boolean;

  // ===== Content =====
  thumbnailUrl?: string;
  images?: string[];
  videos?: CourseVideo[];
  files?: CourseFile[]; // Using the more detailed CourseFile
  learningPoints?: string[];
  requirements?: string[];

  // ===== Metadata =====
  instructor?: string;
  createdBy?: string;
  rating?: number;
  studentsCount?: number;
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
  };
  pagination?: {
    pageSize?: number;
    lastDocId?: string;
  };
}
